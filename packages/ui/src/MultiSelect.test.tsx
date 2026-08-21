import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormField } from './FormField';
import { MultiSelect, type MultiSelectOption } from './MultiSelect';

const ZONES: MultiSelectOption[] = [
  { value: 'mty', label: 'Monterrey', searchText: 'Monterrey MTY Nuevo León' },
  { value: 'gdl', label: 'Guadalajara' },
  { value: 'cdmx', label: 'Ciudad de México' },
];

function Harness({ initial = [] as string[], ...rest }) {
  const [value, setValue] = useState<string[]>(initial);
  return <MultiSelect options={ZONES} value={value} onChange={setValue} {...rest} />;
}

describe('MultiSelect', () => {
  it('opens from the keyboard, which a div with a role has to handle itself', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
  });

  it('keeps selecting without closing, which is the point of a multi', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /Monterrey/ }));
    await userEvent.click(screen.getByRole('option', { name: /Guadalajara/ }));
    expect(screen.getByRole('option', { name: /Monterrey/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('option', { name: /Guadalajara/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('gives each chip a reachable remove button, not a span pretending to be one', async () => {
    render(<Harness initial={['mty']} />);
    const remove = screen.getByRole('button', { name: 'Quitar Monterrey' });
    await userEvent.click(remove);
    expect(screen.queryByRole('button', { name: 'Quitar Monterrey' })).toBeNull();
    // Removing a chip must not also open the menu — the container opens on click.
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('false');
  });

  it('collapses the overflow into a count rather than growing', () => {
    render(<Harness initial={['mty', 'gdl', 'cdmx']} maxVisible={2} />);
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('+1').getAttribute('title')).toBe('Ciudad de México');
  });

  it('filters the list', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(screen.getByPlaceholderText('Buscar…'), 'guad');
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('filters by search metadata without adding that metadata to the visible label', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(screen.getByPlaceholderText('Buscar…'), 'nuevo león');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Monterrey' })).toBeTruthy();
  });

  it('owns the compact filter summary and explicit clear-all contract', async () => {
    render(
      <Harness
        initial={['mty', 'gdl']}
        variant="filter"
        placeholder="Región"
        clearLabel="Todas las regiones"
        options={[
          {
            value: 'mty',
            label: 'Monterrey',
            leading: <span data-testid="region-leading" aria-hidden />,
          },
          ...ZONES.slice(1),
        ]}
        aria-label="Filtrar por región"
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Filtrar por región' });
    expect(trigger.textContent).toContain('Región (2)');
    expect(screen.queryByRole('button', { name: /Quitar/ })).toBeNull();

    await userEvent.click(trigger);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByTestId('region-leading')).toBeTruthy();

    const clear = screen.getByRole('option', { name: 'Todas las regiones' });
    expect(clear.getAttribute('aria-selected')).toBe('false');
    await userEvent.click(clear);

    expect(trigger.textContent).toContain('Región');
    expect(trigger.textContent).not.toContain('(2)');
    expect(clear.getAttribute('aria-selected')).toBe('true');
  });

  it('supports controlled visibility and reports the package-owned search query', async () => {
    const user = userEvent.setup();

    function ControlledMultiSelect() {
      const [open, setOpen] = useState(false);
      const [value, setValue] = useState<string[]>([]);
      const [query, setQuery] = useState('');
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open regions externally
          </button>
          <MultiSelect
            options={ZONES}
            value={value}
            onChange={setValue}
            open={open}
            onOpenChange={setOpen}
            onQueryChange={setQuery}
            aria-label="Controlled regions"
          />
          <button type="button">Outside control</button>
          <output aria-label="Open state">{open ? 'open' : 'closed'}</output>
          <output aria-label="Search query">{query}</output>
        </>
      );
    }

    render(<ControlledMultiSelect />);
    const trigger = screen.getByRole('combobox', { name: 'Controlled regions' });

    await user.click(trigger);
    expect(screen.getByRole('status', { name: 'Open state' }).textContent).toBe('open');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar…' }), 'guad');
    expect(screen.getByRole('status', { name: 'Search query' }).textContent).toBe('guad');

    await user.click(screen.getByRole('option', { name: 'Guadalajara' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(trigger.textContent).toContain('Guadalajara');

    await user.click(screen.getByRole('button', { name: 'Outside control' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('status', { name: 'Open state' }).textContent).toBe('closed');
    expect(screen.getByRole('status', { name: 'Search query' }).textContent).toBe('');

    await user.click(screen.getByRole('button', { name: 'Open regions externally' }));
    expect(screen.getAllByRole('option')).toHaveLength(ZONES.length);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('supports defaultOpen and reports the uncontrolled close transition', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <MultiSelect
        options={ZONES}
        value={[]}
        onChange={() => undefined}
        defaultOpen
        onOpenChange={onOpenChange}
        aria-label="Initially open regions"
      />,
    );

    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox', { name: 'Initially open regions' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('says when there is nothing to show', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(screen.getByPlaceholderText('Buscar…'), 'zzz');
    expect(screen.getByText('Sin resultados')).toBeTruthy();
  });

  it('is inert when disabled', async () => {
    render(<Harness initial={['mty']} disabled />);
    const trigger = screen.getByRole('combobox');
    const remove = screen.getByRole('button', { name: 'Quitar Monterrey' }) as HTMLButtonElement;
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(trigger.getAttribute('tabindex')).toBe('-1');
    expect(remove.disabled).toBe(true);
    await userEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Monterrey')).toBeTruthy();
  });
});

describe('the accessible name', () => {
  it('names the trigger from the chips or the placeholder', () => {
    render(<Harness />);
    expect(screen.getByRole('combobox', { name: 'Seleccionar…' })).toBeTruthy();
  });

  it('follows the selection', () => {
    render(<Harness initial={['mty']} />);
    expect(screen.getByRole('combobox', { name: /Monterrey/ })).toBeTruthy();
  });

  it('takes its name and field state from FormField', () => {
    render(
      <FormField label="Regiones" hint="Selecciona al menos una." required>
        <Harness />
      </FormField>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Regiones' });
    expect(trigger.id).toBeTruthy();
    expect(trigger.getAttribute('aria-required')).toBe('true');
    expect(trigger.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(trigger.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Selecciona al menos una.',
    );
  });
});
