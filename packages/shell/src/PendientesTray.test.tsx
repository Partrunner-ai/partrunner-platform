import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GlobalHeader } from './GlobalHeader';
import {
  StaffShellProvider,
  type StaffPendientesState,
  type StaffShellContextValue,
} from './StaffShellContext';

const pendientes: StaffPendientesState = {
  mine: 2,
  team: 3,
  href: 'https://nexus.partrunner.ai/#pendientes',
  items: [
    {
      id: 'a',
      bucket: 'mine',
      verb: 'Aprobar',
      queue: 'Tarifas pactadas',
      title: 'Tarifa de Flota Norte',
      subtitle: 'Ruta CDMX',
      ageLabel: 'hace 3 h',
      href: 'https://nexus.partrunner.ai/tarifas/1',
    },
    { id: 'b', bucket: 'team', verb: 'Decidir', queue: 'Altas', title: 'Alta de unidad' },
  ],
};

const context = (overrides: Partial<StaffShellContextValue> = {}): StaffShellContextValue => ({
  user: { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' },
  profileHref: 'https://nexus.partrunner.ai/profile',
  preferences: { locale: 'es', theme: 'system' },
  notifications: { unreadCount: 0, href: 'https://nexus.partrunner.ai/n', items: [] },
  setLocale: vi.fn(),
  setTheme: vi.fn(),
  ...overrides,
});

function renderHeader(value: StaffShellContextValue) {
  return render(
    <StaffShellProvider value={value}>
      <GlobalHeader currentSub="sales" />
    </StaffShellProvider>,
  );
}

const trigger = () => screen.getByRole('button', { name: /^Pendientes/ });

describe('PendientesTray', () => {
  it('is hidden without `pendientes`', () => {
    renderHeader(context());
    expect(screen.queryByRole('button', { name: /^Pendientes/ })).toBeNull();
  });

  it('sits right before the bell', () => {
    renderHeader(context({ pendientes }));
    const buttons = screen.getAllByRole('button');
    const tray = buttons.indexOf(trigger());
    const bell = buttons.indexOf(screen.getByRole('button', { name: /^Notificaciones/ }));
    expect(tray).toBe(bell - 1);
  });

  it('shows the total and caps it at 99+', () => {
    const { unmount } = renderHeader(context({ pendientes }));
    expect(trigger().getAttribute('aria-label')).toBe('Pendientes: 5');
    expect(trigger().querySelector('.pr-badge-dot')!.textContent).toBe('5');
    unmount();

    renderHeader(context({ pendientes: { ...pendientes, mine: 90, team: 30 } }));
    expect(trigger().querySelector('.pr-badge-dot')!.textContent).toBe('99+');
  });

  it('uses the mine tone when something is assigned, team when only team', () => {
    const { unmount } = renderHeader(context({ pendientes }));
    expect(trigger().querySelector('.pr-badge-dot')!.getAttribute('data-tone')).toBe('mine');
    unmount();

    renderHeader(context({ pendientes: { ...pendientes, mine: 0, team: 3 } }));
    expect(trigger().querySelector('.pr-badge-dot')!.getAttribute('data-tone')).toBe('team');
  });

  it('has no badge when there is nothing to do', () => {
    renderHeader(context({ pendientes: { ...pendientes, mine: 0, team: 0, items: [] } }));
    expect(trigger().querySelector('.pr-badge-dot')).toBeNull();
  });

  it('lists the sections with counts, rows and «y N más»', async () => {
    const user = userEvent.setup();
    renderHeader(context({ pendientes }));
    await user.click(trigger());

    const dialog = screen.getByRole('dialog', { name: 'Pendientes' });
    const headings = Array.from(dialog.querySelectorAll('.pr-pendientes__heading')).map(
      (node) => node.textContent,
    );
    expect(headings).toEqual(['Te toca · 2', 'De tu equipo, sin tomar · 3']);
    const row = dialog.querySelector('.pr-pendientes__row[data-bucket="mine"]')!;
    expect(row.querySelector('.pr-pendientes__title')!.textContent).toBe(
      'Aprobar · Tarifa de Flota Norte',
    );
    expect(row.querySelector('.pr-pendientes__meta')!.textContent).toBe(
      'Tarifas pactadas · Ruta CDMX · hace 3 h',
    );
    expect(row.querySelector('a')!.getAttribute('href')).toBe('https://nexus.partrunner.ai/tarifas/1');
    const more = Array.from(dialog.querySelectorAll('.pr-pendientes__more')).map(
      (node) => node.textContent,
    );
    expect(more).toEqual(['y 1 más', 'y 2 más']);
    const header = dialog.querySelector('.pr-pendientes__viewall')!;
    expect(header.textContent).toBe('Ver todos en Inicio');
    expect(header.getAttribute('href')).toBe(pendientes.href);
    const footer = dialog.querySelector('.pr-notifications__footer')!;
    expect(footer.textContent).toBe('Abrir Inicio');
    expect(footer.getAttribute('href')).toBe(pendientes.href);
  });

  it('skips empty parts of the second line', async () => {
    const user = userEvent.setup();
    renderHeader(
      context({
        pendientes: {
          ...pendientes,
          mine: 0,
          items: [{ id: 'z', bucket: 'team', verb: 'Revisar', queue: 'Altas', title: 'X', subtitle: '  ' }],
        },
      }),
    );
    await user.click(trigger());
    expect(screen.getByRole('dialog').querySelector('.pr-pendientes__meta')!.textContent).toBe('Altas');
  });

  it('names the team in the heading when teamLabel is set', async () => {
    const user = userEvent.setup();
    renderHeader(context({ pendientes: { ...pendientes, teamLabel: 'Finanzas' } }));
    await user.click(trigger());
    expect(screen.getByRole('dialog').textContent).toContain('De Finanzas, sin tomar · 3');
  });

  it('gives the first button of each section the primary look and the rest outlined', async () => {
    const user = userEvent.setup();
    const claimPendiente = vi.fn().mockResolvedValue(undefined);
    renderHeader(context({ pendientes, claimPendiente }));
    await user.click(trigger());
    const actions = Array.from(
      screen.getByRole('dialog').querySelectorAll('.pr-pendientes__action'),
    );
    expect(actions.map((node) => node.textContent)).toEqual(['Abrir', 'Lo tomo']);
    expect(actions.map((node) => node.getAttribute('data-variant'))).toEqual(['primary', 'primary']);
  });

  it('keeps one primary per section, the others outlined, and a primary when the other section is empty', async () => {
    const user = userEvent.setup();
    const claimPendiente = vi.fn().mockResolvedValue(undefined);
    const mk = (id: string, bucket: 'mine' | 'team') => ({
      id, bucket, verb: 'V', queue: 'Q', title: `T${id}`, href: `/x/${id}`,
    });
    const { unmount } = renderHeader(
      context({
        pendientes: { ...pendientes, mine: 2, team: 2, items: [mk('1', 'mine'), mk('2', 'mine'), mk('3', 'team'), mk('4', 'team')] },
        claimPendiente,
      }),
    );
    await user.click(trigger());
    const variants = () =>
      Array.from(screen.getByRole('dialog').querySelectorAll('.pr-pendientes__action')).map((n) =>
        n.getAttribute('data-variant'),
      );
    expect(variants()).toEqual(['primary', 'outline', 'primary', 'outline']);
    unmount();

    renderHeader(
      context({
        pendientes: { ...pendientes, mine: 0, team: 2, items: [mk('3', 'team'), mk('4', 'team')] },
        claimPendiente,
      }),
    );
    await user.click(trigger());
    expect(variants()).toEqual(['primary', 'outline']);
  });

  describe('primary button per section', () => {
    const mk = (id: string, bucket: 'mine' | 'team', href?: string) => ({
      id, bucket, verb: 'V', queue: 'Q', title: `T${id}`, ...(href ? { href } : {}),
    });
    const primaries = (bucket: 'mine' | 'team') => {
      const section = screen.getByRole('dialog').querySelector(`section[data-bucket="${bucket}"]`)!;
      return Array.from(section.querySelectorAll('[data-variant="primary"]')).map(
        (n) => n.getAttribute('aria-label'),
      );
    };

    it('skips a mine row with no safe href', async () => {
      const user = userEvent.setup();
      renderHeader(context({ pendientes: { ...pendientes, mine: 2, team: 0, items: [mk('1', 'mine'), mk('2', 'mine', '/x/2')] } }));
      await user.click(trigger());
      expect(primaries('mine')).toEqual(['Abrir: T2']);
    });

    it('team rows without claimPendiente: first one with a safe href is primary', async () => {
      const user = userEvent.setup();
      renderHeader(context({ pendientes: { ...pendientes, mine: 0, team: 2, items: [mk('3', 'team'), mk('4', 'team', '/x/4'), mk('5', 'team', '/x/5')] } }));
      await user.click(trigger());
      expect(primaries('team')).toEqual(['Abrir: T4']);
    });

    it('team rows without claimPendiente and without safe href: no primary', async () => {
      const user = userEvent.setup();
      renderHeader(context({ pendientes: { ...pendientes, mine: 0, team: 1, items: [mk('3', 'team')] } }));
      await user.click(trigger());
      expect(primaries('team')).toEqual([]);
    });

    it('moves the primary to the next team row while a claim is pending', async () => {
      const user = userEvent.setup();
      const claimPendiente = vi.fn(() => new Promise<void>(() => {}));
      renderHeader(context({ pendientes: { ...pendientes, mine: 0, team: 2, items: [mk('3', 'team'), mk('4', 'team')] }, claimPendiente }));
      await user.click(trigger());
      expect(primaries('team')).toEqual(['Lo tomo: T3']);
      await user.click(screen.getByRole('button', { name: 'Lo tomo: T3' }));
      expect(primaries('team')).toEqual(['Lo tomo: T4']);
      expect(screen.getByRole('button', { name: 'Tomando…: T3' }).getAttribute('data-variant')).toBe('outline');
    });

    it('has no mine section when it is empty', async () => {
      const user = userEvent.setup();
      renderHeader(context({ pendientes: { ...pendientes, mine: 0, team: 1, items: [mk('3', 'team', '/x/3')] } }));
      await user.click(trigger());
      expect(screen.getByRole('dialog').querySelector('section[data-bucket="mine"]')).toBeNull();
    });
  });

  it('team rows say «Abrir» without claimPendiente, and need a safe href', async () => {
    const user = userEvent.setup();
    renderHeader(
      context({
        pendientes: {
          ...pendientes,
          items: [
            pendientes.items[0]!,
            { ...pendientes.items[1]!, href: '/altas/1' },
            { id: 'c', bucket: 'team', verb: 'V', queue: 'Q', title: 'Sin enlace' },
          ],
        },
      }),
    );
    await user.click(trigger());
    const dialog = screen.getByRole('dialog');
    expect(screen.getAllByRole('link', { name: /^Abrir: / })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Lo tomo/ })).toBeNull();
    expect(dialog.querySelectorAll('.pr-pendientes__action')).toHaveLength(2);
  });

  it('claims a team row: busy label, refresh, stays open', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const claimPendiente = vi.fn(
      () => new Promise<void>((done) => { resolve = done; }),
    );
    const refreshPendientes = vi.fn();
    renderHeader(context({ pendientes, claimPendiente, refreshPendientes }));
    await user.click(trigger());
    refreshPendientes.mockClear();
    await user.click(screen.getByRole('button', { name: 'Lo tomo: Alta de unidad' }));
    expect(claimPendiente).toHaveBeenCalledWith('b');
    const busy = screen.getByRole('button', { name: 'Tomando…: Alta de unidad' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.textContent).toBe('Tomando…');
    await user.click(busy);
    expect(claimPendiente).toHaveBeenCalledTimes(1);
    resolve();
    await screen.findByRole('button', { name: 'Lo tomo: Alta de unidad' });
    expect(refreshPendientes).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows an inline error when the claim fails and lets the person retry', async () => {
    const user = userEvent.setup();
    const claimPendiente = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
    const refreshPendientes = vi.fn();
    renderHeader(context({ pendientes, claimPendiente, refreshPendientes }));
    await user.click(trigger());
    refreshPendientes.mockClear();
    await user.click(screen.getByRole('button', { name: 'Lo tomo: Alta de unidad' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('No se pudo tomar. Intenta otra vez.');
    expect(refreshPendientes).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Lo tomo: Alta de unidad' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await user.click(button);
    expect(claimPendiente).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps working with a 2.10.0-style state (no teamLabel, no claimPendiente)', async () => {
    const user = userEvent.setup();
    renderHeader(context({ pendientes }));
    await user.click(trigger());
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('De tu equipo, sin tomar');
    expect(dialog.querySelector('button.pr-pendientes__action')).toBeNull();
  });

  it('hides a section whose count is 0', async () => {
    const user = userEvent.setup();
    renderHeader(context({ pendientes: { ...pendientes, team: 0, items: [pendientes.items[0]!] } }));
    await user.click(trigger());
    expect(screen.getByRole('dialog').querySelector('[data-bucket="team"]')).toBeNull();
  });

  it('shows the empty state', async () => {
    const user = userEvent.setup();
    renderHeader(context({ pendientes: { ...pendientes, mine: 0, team: 0, items: [] } }));
    await user.click(trigger());
    expect(screen.getByRole('dialog').textContent).toContain('No tienes pendientes.');
  });

  it('shows a loading line when it has no items yet', async () => {
    const user = userEvent.setup();
    renderHeader(
      context({ pendientes: { ...pendientes, items: [], loading: true } }),
    );
    await user.click(trigger());
    expect(screen.getByRole('status').textContent).toBe('Cargando pendientes…');
  });

  it('renders no anchor for an unsafe href', async () => {
    const user = userEvent.setup();
    const bad = {
      ...pendientes,
      mine: 1,
      team: 0,
      items: [{ ...pendientes.items[0]!, href: 'javascript:alert(1)' }],
    };
    renderHeader(context({ pendientes: bad }));
    await user.click(trigger());
    const row = screen.getByRole('dialog').querySelector('.pr-pendientes__row[data-bucket="mine"]')!;
    expect(row.tagName).toBe('DIV');
    expect(row.querySelector('a, button')).toBeNull();
  });

  it('renders the footer and «y N más» links only for a safe href', async () => {
    const user = userEvent.setup();
    renderHeader(context({ pendientes: { ...pendientes, href: 'javascript:alert(1)' } }));
    await user.click(trigger());
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.pr-notifications__footer')).toBeNull();
    expect(dialog.querySelector('.pr-pendientes__more')).toBeNull();
  });

  it('calls refreshPendientes once on open, else refreshNotifications', async () => {
    const user = userEvent.setup();
    const refreshPendientes = vi.fn();
    const refreshNotifications = vi.fn();
    const { unmount } = renderHeader(
      context({ pendientes, refreshPendientes, refreshNotifications }),
    );
    await user.click(trigger());
    expect(refreshPendientes).toHaveBeenCalledTimes(1);
    expect(refreshNotifications).not.toHaveBeenCalled();
    unmount();

    const only = vi.fn();
    renderHeader(context({ pendientes, refreshNotifications: only }));
    await user.click(trigger());
    expect(only).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderHeader(context({ pendientes }));
    await user.click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Pendientes' })).toBeNull();
  });

  it('speaks English with the English locale', async () => {
    const user = userEvent.setup();
    renderHeader(
      context({ pendientes, preferences: { locale: 'en', theme: 'system' } }),
    );
    const button = screen.getByRole('button', { name: 'To-dos: 5' });
    await user.click(button);
    const dialog = screen.getByRole('dialog', { name: 'To-dos' });
    expect(dialog.textContent).toContain('Yours');
    expect(dialog.textContent).toContain('Your team, not taken');
    expect(dialog.textContent).toContain('and 1 more');
    expect(dialog.textContent).toContain('See all on Home');
    expect(dialog.textContent).toContain('Open Home');
  });
});
