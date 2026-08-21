import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CheckboxGroup, RadioGroup, type ChoiceOption } from './ChoiceGroup';

const OPTIONS: ChoiceOption[] = [
  { value: 'mty', label: 'Monterrey', description: 'Cobertura norte.' },
  { value: 'gdl', label: 'Guadalajara' },
  { value: 'cdmx', label: 'Ciudad de México', disabled: true },
];

function CheckboxHarness(props: Partial<React.ComponentProps<typeof CheckboxGroup>>) {
  const [value, setValue] = useState<readonly string[]>(['mty']);
  return (
    <CheckboxGroup
      name="regiones"
      label="Regiones"
      options={OPTIONS}
      value={value}
      onValueChange={setValue}
      {...props}
    />
  );
}

function RadioHarness(props: Partial<React.ComponentProps<typeof RadioGroup>>) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <RadioGroup
      name="prioridad"
      label="Prioridad"
      options={OPTIONS}
      value={value}
      onValueChange={setValue}
      {...props}
    />
  );
}

describe('CheckboxGroup', () => {
  it('adds and removes values while preserving one native checkbox per option', async () => {
    render(<CheckboxHarness />);

    const monterrey = screen.getByRole('checkbox', { name: /Monterrey/ }) as HTMLInputElement;
    const guadalajara = screen.getByRole('checkbox', { name: 'Guadalajara' }) as HTMLInputElement;
    expect(monterrey.checked).toBe(true);

    await userEvent.click(guadalajara);
    expect(guadalajara.checked).toBe(true);
    await userEvent.click(monterrey);
    expect(monterrey.checked).toBe(false);
  });

  it('owns the group label, guidance, invalid state, and disabled options', () => {
    render(
      <CheckboxHarness
        required
        hint="Selecciona todas las regiones aplicables."
        error="Selecciona al menos una región."
      />,
    );

    const group = screen.getByRole('group', { name: 'Regiones' });
    expect(group.getAttribute('aria-required')).toBe('true');
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText('Selecciona todas las regiones aplicables.')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Selecciona al menos una región.');
    expect((screen.getByRole('checkbox', { name: 'Ciudad de México' }) as HTMLInputElement).disabled).toBe(
      true,
    );

    // Native `required` on every checkbox would incorrectly require every option.
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect((checkbox as HTMLInputElement).required).toBe(false);
    }
  });
});

describe('RadioGroup', () => {
  it('selects exactly one native radio and supports horizontal composition', async () => {
    const { container } = render(<RadioHarness orientation="horizontal" />);

    const monterrey = screen.getByRole('radio', { name: /Monterrey/ }) as HTMLInputElement;
    const guadalajara = screen.getByRole('radio', { name: 'Guadalajara' }) as HTMLInputElement;
    await userEvent.click(monterrey);
    expect(monterrey.checked).toBe(true);
    await userEvent.click(guadalajara);
    expect(monterrey.checked).toBe(false);
    expect(guadalajara.checked).toBe(true);
    expect(container.querySelector('.pr-choice-group__options--horizontal')).toBeTruthy();
  });

  it('uses native same-name required semantics', () => {
    const { container } = render(<RadioHarness required />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.every((radio) => radio.name === 'prioridad')).toBe(true);
    expect(radios.every((radio) => radio.required)).toBe(true);
    expect(container.querySelectorAll('.pr-choice-group__required')).toHaveLength(1);
    expect(container.querySelectorAll('.pr-choice__required')).toHaveLength(0);
  });
});
