import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FormField } from './FormField';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders a bare native textarea without layout wrappers', async () => {
    const { container } = render(<Textarea aria-label="Notas" containerClassName="layout-hook" />);
    expect(container.children).toHaveLength(1);
    const textarea = screen.getByLabelText('Notas') as HTMLTextAreaElement;
    expect(textarea.className).toContain('pr-textarea');
    expect(textarea.className).toContain('pr-textarea--md');
    expect(textarea.className).toContain('layout-hook');
    await userEvent.type(textarea, 'Entrega confirmada');
    expect(textarea.value).toBe('Entrega confirmada');
  });

  it('keeps the Input convenience contract for labels, hints, and errors', () => {
    const { rerender } = render(
      <Textarea label="Observaciones" hint="Incluye el folio." fullWidth />,
    );
    const textarea = screen.getByLabelText('Observaciones');
    expect(textarea.className).toContain('pr-textarea--block');
    expect(document.getElementById(textarea.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Incluye el folio.',
    );

    rerender(
      <Textarea
        label="Observaciones"
        hint="Incluye el folio."
        error="Las observaciones son obligatorias."
        fullWidth
      />,
    );
    expect(screen.queryByText('Incluye el folio.')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Las observaciones son obligatorias.');
    expect(screen.getByLabelText('Observaciones').getAttribute('aria-invalid')).toBe('true');
  });

  it('participates in an external FormField without another interface', () => {
    render(
      <FormField label="Comentarios" required error="Requerido">
        <Textarea textareaSize="lg" />
      </FormField>,
    );

    const textarea = screen.getByRole('textbox', { name: 'Comentarios' }) as HTMLTextAreaElement;
    expect(textarea.required).toBe(true);
    expect(textarea.className).toContain('pr-textarea--lg');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
  });
});
