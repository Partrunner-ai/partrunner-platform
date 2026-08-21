import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox';
import { Switch } from './Switch';

describe('Checkbox', () => {
  it('keeps a native checkbox under a full-row label', async () => {
    render(<Checkbox label="Confirmar evidencia" description="Incluye una fotografía legible." />);

    const control = screen.getByRole('checkbox', { name: 'Confirmar evidencia' });
    await userEvent.click(screen.getByText('Confirmar evidencia'));

    expect((control as HTMLInputElement).checked).toBe(true);
    expect(control.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(control.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Incluye una fotografía legible.',
    );
  });

  it('announces an error instead of leaving stale guidance attached', () => {
    render(
      <Checkbox
        label="Aceptar política"
        description="Puedes revisarla antes de continuar."
        error="Debes aceptar la política."
        required
      />,
    );

    const control = screen.getByRole('checkbox', { name: 'Aceptar política' });
    expect((control as HTMLInputElement).required).toBe(true);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText('Puedes revisarla antes de continuar.')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Debes aceptar la política.');
  });

  it('supports a declarative mixed state without replacing the native input', async () => {
    render(<Checkbox label="Seleccionar rutas" indeterminate />);

    const control = screen.getByRole('checkbox', { name: 'Seleccionar rutas' }) as HTMLInputElement;
    expect(control.indeterminate).toBe(true);
    expect(control.getAttribute('aria-checked')).toBe('mixed');
    await userEvent.click(control);
    expect(control.indeterminate).toBe(true);
    expect(control.getAttribute('aria-checked')).toBe('mixed');
  });

  it('can be named without a visible label in dense compositions', () => {
    render(<Checkbox aria-label="Seleccionar ruta MTY-204" />);
    expect(screen.getByRole('checkbox', { name: 'Seleccionar ruta MTY-204' })).toBeTruthy();
  });
});

describe('Switch', () => {
  it('uses native checked state with switch semantics', async () => {
    render(<Switch label="Asignación automática" description="Usa disponibilidad en tiempo real." />);

    const control = screen.getByRole('switch', { name: 'Asignación automática' }) as HTMLInputElement;
    expect(control.checked).toBe(false);

    await userEvent.click(screen.getByText('Asignación automática'));
    expect(control.checked).toBe(true);
  });

  it('makes the whole control inert when disabled', async () => {
    render(<Switch label="Notificaciones" disabled defaultChecked />);
    const control = screen.getByRole('switch', { name: 'Notificaciones' }) as HTMLInputElement;

    expect(control.disabled).toBe(true);
    await userEvent.click(screen.getByText('Notificaciones'));
    expect(control.checked).toBe(true);
  });
});
