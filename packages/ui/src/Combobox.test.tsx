import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Combobox, type ComboboxOption } from './Combobox';
import { FormField } from './FormField';

const FLEETS: ComboboxOption[] = [
  { value: '1', label: 'Transportes Ruiz' },
  { value: '2', label: 'Fletes del Norte' },
];

function Harness({ onSearch }: { onSearch: (q: string) => Promise<ComboboxOption[]> }) {
  const [value, setValue] = useState<ComboboxOption | null>(null);
  return <Combobox value={value} onChange={setValue} onSearch={onSearch} debounceMs={0} />;
}

describe('Combobox', () => {
  it('opens a listbox and announces itself as one', async () => {
    render(<Harness onSearch={async () => FLEETS} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy());
    expect(await screen.findAllByRole('option')).toHaveLength(2);
  });

  it('chooses with the pointer and closes', async () => {
    render(<Harness onSearch={async () => FLEETS} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Fletes del Norte'));
    expect(screen.getByRole('combobox').textContent).toContain('Fletes del Norte');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('chooses with the keyboard', async () => {
    render(<Harness onSearch={async () => FLEETS} />);
    await userEvent.click(screen.getByRole('combobox'));
    await screen.findAllByRole('option');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('combobox').textContent).toContain('Fletes del Norte');
  });

  it('lets the newest request win, whatever order the replies arrive in', async () => {
    // "ab" resolves slowly, "abc" quickly. The slow one must not overwrite the fast
    // one just because it landed second.
    const onSearch = vi.fn(async (q: string) => {
      if (q === 'ab') {
        await new Promise((r) => setTimeout(r, 40));
        return [{ value: 'stale', label: 'STALE' }];
      }
      return [{ value: 'fresh', label: 'FRESH' }];
    });
    render(<Harness onSearch={onSearch} />);
    await userEvent.click(screen.getByRole('combobox'));
    const search = await screen.findByPlaceholderText('Buscar…');
    await userEvent.type(search, 'ab');
    await userEvent.type(search, 'c');
    await new Promise((r) => setTimeout(r, 80));
    expect(screen.queryByText('STALE')).toBeNull();
    expect(screen.getByText('FRESH')).toBeTruthy();
  });

  it('puts the clear control outside the trigger, so it can be reached', async () => {
    render(<Harness onSearch={async () => FLEETS} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Transportes Ruiz'));

    const clear = screen.getByRole('button', { name: 'Quitar selección' });
    // A control nested inside the trigger button would be neither focusable nor
    // announced; this one is a sibling.
    expect(screen.getByRole('combobox').contains(clear)).toBe(false);
    await userEvent.click(clear);
    expect(screen.getByRole('combobox').textContent).toContain('Buscar…');
  });

  it('says when it is searching and when there is nothing', async () => {
    render(<Harness onSearch={async () => []} />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByText('Sin resultados')).toBeTruthy();
  });
});

describe('the accessible name', () => {
  it('names the trigger from what it currently reads as', () => {
    // `combobox` is a name-from-author role: text inside it does not name it, so
    // relying on the content leaves the control announced as just "combobox".
    render(<Harness onSearch={async () => FLEETS} />);
    const trigger = screen.getByRole('combobox');
    const labelledBy = trigger.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Buscar…');
  });

  it('is findable by that name, which is how a test or a user reaches it', () => {
    render(<Harness onSearch={async () => FLEETS} />);
    expect(screen.getByRole('combobox', { name: 'Buscar…' })).toBeTruthy();
  });

  it('takes its name and field state from FormField', () => {
    render(
      <FormField label="Flotilla" error="Selecciona una flotilla." required>
        <Combobox value={null} onChange={() => {}} onSearch={async () => FLEETS} />
      </FormField>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Flotilla' });
    expect(trigger.id).toBeTruthy();
    expect(trigger.getAttribute('aria-required')).toBe('true');
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(trigger.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });
});
