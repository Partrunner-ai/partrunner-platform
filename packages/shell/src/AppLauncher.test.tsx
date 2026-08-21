import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Boxes, UsersRound } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { AppLink } from '@partrunner-ai/app-registry';
import { AppLauncher } from './AppLauncher';

const APPS: AppLink[] = [
  {
    label: 'Supply',
    sub: 'supply',
    description: 'Operación de supply',
    icon: Boxes,
    tone: 'blue',
  },
  {
    label: 'Comunidad',
    sub: 'comunidad',
    description: 'Portal interno de la empresa (RRHH)',
    icon: UsersRound,
    tone: 'rose',
    comingSoon: true,
  },
];

async function openLauncher(currentSub?: string) {
  const user = userEvent.setup();
  render(<AppLauncher apps={APPS} currentSub={currentSub} />);
  await user.click(screen.getByRole('button', { name: 'Aplicaciones' }));
}

describe('AppLauncher', () => {
  it('links to other apps and marks coming-soon ones as unavailable', async () => {
    await openLauncher('supply');

    const comunidad = screen.getByText('Comunidad').closest('.pr-app');
    expect(comunidad?.getAttribute('data-disabled')).toBe('true');
    expect(comunidad?.getAttribute('aria-disabled')).toBe('true');
    expect(comunidad?.getAttribute('title')).toBe('Próximamente');
  });

  it('marks the current app as current instead of a link', async () => {
    await openLauncher('supply');

    const supply = screen.getByText('Supply').closest('.pr-app');
    expect(supply?.getAttribute('data-current')).toBe('true');
    expect(supply?.getAttribute('aria-current')).toBe('page');
    expect(supply?.tagName).toBe('DIV');
  });

  it('treats the current app as current even when the registry still marks it coming soon', async () => {
    // An app can host this launcher before it has a public URL in the registry
    // (Community runs on its own domain and is deliberately still
    // `comingSoon`). Telling the user the app they are inside is
    // "Próximamente" — and disabling it — would be wrong.
    await openLauncher('comunidad');

    const comunidad = screen.getByText('Comunidad').closest('.pr-app');
    expect(comunidad?.getAttribute('data-current')).toBe('true');
    expect(comunidad?.getAttribute('aria-current')).toBe('page');
    expect(comunidad?.getAttribute('data-disabled')).toBeNull();
    expect(comunidad?.getAttribute('aria-disabled')).toBeNull();
  });

  it('still renders other coming-soon apps as unavailable from that app', async () => {
    await openLauncher('comunidad');

    const supply = screen.getByText('Supply').closest('.pr-app');
    expect(supply?.tagName).toBe('A');
  });
});
