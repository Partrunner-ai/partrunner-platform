import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

const OPTIONS = [
  { value: 'driver', label: 'Conductor' },
  { value: 'fleet', label: 'Flotillero' },
  { value: 'retired', label: 'Retirado', disabled: true },
];

describe('Select', () => {
  it('renders options from the array', () => {
    render(<Select options={OPTIONS} aria-label="Tipo" />);
    const el = screen.getByLabelText('Tipo') as HTMLSelectElement;
    expect([...el.options].map((o) => o.value)).toEqual(['driver', 'fleet', 'retired']);
    expect(el.options[2]!.disabled).toBe(true);
  });

  it('accepts option children instead, for a grouped list', () => {
    render(
      <Select aria-label="Zona">
        <optgroup label="Norte">
          <option value="mty">Monterrey</option>
        </optgroup>
      </Select>,
    );
    expect((screen.getByLabelText('Zona') as HTMLSelectElement).options).toHaveLength(1);
  });

  it('makes the placeholder the empty state, and not a selectable value', () => {
    render(<Select options={OPTIONS} placeholder="Elegir…" aria-label="Tipo" />);
    const el = screen.getByLabelText('Tipo') as HTMLSelectElement;
    // It is chosen when nothing else is…
    expect(el.value).toBe('');
    // …but disabled, so `required` rejects it rather than submitting an empty string
    // that looks deliberate.
    expect(el.options[0]!.disabled).toBe(true);
  });

  it('wires label, error and the field together', () => {
    render(<Select options={OPTIONS} label="Tipo" error="Requerido" />);
    const el = screen.getByLabelText('Tipo');
    expect(el.getAttribute('aria-invalid')).toBe('true');
    const described = el.getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    expect(document.getElementById(described!)?.textContent).toBe('Requerido');
    // An error after a failed submit has to be announced.
    expect(document.getElementById(described!)?.getAttribute('role')).toBe('alert');
  });

  it('hides the hint once there is an error, rather than stacking both', () => {
    const { rerender } = render(<Select options={OPTIONS} label="Tipo" hint="Opcional" />);
    expect(screen.getByText('Opcional')).toBeTruthy();
    rerender(<Select options={OPTIONS} label="Tipo" hint="Opcional" error="Requerido" />);
    expect(screen.queryByText('Opcional')).toBeNull();
    expect(screen.getByText('Requerido')).toBeTruthy();
  });

  it('renders bare when there is nothing to lay out, like Input', () => {
    const { container } = render(<Select options={OPTIONS} aria-label="Tipo" />);
    expect(container.querySelector('.pr-field')).toBeNull();
    // and grows the moment it has a label
    const withLabel = render(<Select options={OPTIONS} label="Tipo" />);
    expect(withLabel.container.querySelector('.pr-field')).not.toBeNull();
  });

  it('reports the chosen value', async () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} aria-label="Tipo" defaultValue="driver" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'fleet');
    expect(onChange).toHaveBeenCalled();
    expect((screen.getByLabelText('Tipo') as HTMLSelectElement).value).toBe('fleet');
  });

  it('carries fullWidth on the element that has to stretch', () => {
    const { container } = render(<Select options={OPTIONS} fullWidth aria-label="Tipo" />);
    expect(container.firstElementChild!.className).toContain('pr-select--block');
  });
});
