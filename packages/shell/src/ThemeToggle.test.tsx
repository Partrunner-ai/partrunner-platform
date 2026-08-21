import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('preserves the standalone light/dark cycle', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('pr-theme', 'dark');
    render(<ThemeToggle />);

    const darkToggle = await screen.findByRole('button', {
      name: 'Tema: dark. Cambiar a light',
    });
    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(true),
    );

    await user.click(darkToggle);
    expect(window.localStorage.getItem('pr-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await user.click(
      screen.getByRole('button', {
        name: 'Tema: light. Cambiar a dark',
      }),
    );
    expect(window.localStorage.getItem('pr-theme')).toBe('dark');
  });
});
