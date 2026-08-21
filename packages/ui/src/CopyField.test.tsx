import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CopyField } from './CopyField';

describe('CopyField', () => {
  it('shows the value and a labelled copy control', () => {
    render(<CopyField value="https://pr.mx/inv/abc123" />);
    expect(screen.getByText('https://pr.mx/inv/abc123')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
  });

  it('copies and announces once, keeping the button name stable', async () => {
    const user = userEvent.setup();
    render(<CopyField value="clave-123" />);
    await user.click(screen.getByRole('button'));
    expect(await navigator.clipboard.readText()).toBe('clave-123');
    // The confirmation lives in the live region only; renaming a focused
    // button would make screen readers re-announce the whole control.
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Copiado');
  });

  it('clears the confirmation after the timeout', async () => {
    const user = userEvent.setup();
    render(<CopyField value="x" resetAfter={20} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('status').textContent).toBe('Copiado');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(''), {
      timeout: 1000,
    });
  });

  it('drops a stale confirmation when the value changes underneath it', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CopyField value="link-1" resetAfter={60000} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('status').textContent).toBe('Copiado');
    rerender(<CopyField value="link-2" resetAfter={60000} />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
