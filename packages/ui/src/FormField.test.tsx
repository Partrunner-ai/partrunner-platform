import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField, Label } from './FormField';
import { Input } from './Input';

describe('FormField', () => {
  it('owns the label, id, required state, and help relationship', () => {
    render(
      <FormField label="Ruta" hint="Usa el identificador operativo." required>
        <Input />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Ruta' }) as HTMLInputElement;
    expect(input.id).toBeTruthy();
    expect(input.required).toBe(true);
    const messageId = input.getAttribute('aria-describedby');
    expect(messageId).toBeTruthy();
    expect(document.getElementById(messageId!)?.textContent).toBe('Usa el identificador operativo.');
    expect(document.querySelector('.pr-label__required')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses the child id and preserves caller descriptions while adding the error', () => {
    render(
      <FormField label="Correo" hint="Usa el corporativo." error="Dominio no autorizado.">
        <Input id="correo-operativo" aria-describedby="politica-correo" />
      </FormField>,
    );

    const input = screen.getByLabelText('Correo');
    expect(input.id).toBe('correo-operativo');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText('Usa el corporativo.')).toBeNull();
    const alert = screen.getByRole('alert');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'politica-correo',
      alert.id,
    ]);
  });

  it('forces a disabled child inert without making the caller wire it twice', () => {
    render(
      <FormField label="Placa" disabled>
        <Input />
      </FormField>,
    );

    expect((screen.getByLabelText('Placa') as HTMLInputElement).disabled).toBe(true);
  });

  it('reflects required and disabled state already owned by the child', () => {
    const { container } = render(
      <FormField label="Referencia">
        <Input required disabled />
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'Referencia' }) as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(container.querySelector('.pr-field')?.className).toContain('pr-field--disabled');
    expect(container.querySelector('.pr-label__required')).toBeTruthy();
  });
});

describe('Label', () => {
  it('works outside FormField and keeps the required mark decorative', () => {
    render(
      <>
        <Label htmlFor="referencia" required>
          Referencia
        </Label>
        <input id="referencia" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Referencia' })).toBeTruthy();
    expect(document.querySelector('.pr-label__required')?.getAttribute('aria-hidden')).toBe('true');
  });
});
