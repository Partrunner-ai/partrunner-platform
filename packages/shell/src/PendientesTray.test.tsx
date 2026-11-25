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
    expect(headings).toEqual(['Te toca2', 'De tu equipo, sin tomar3']);
    const row = dialog.querySelector('a[data-bucket="mine"]')!;
    expect(row.getAttribute('href')).toBe('https://nexus.partrunner.ai/tarifas/1');
    expect(row.textContent).toContain('Aprobar · Tarifas pactadas');
    expect(row.textContent).toContain('Tarifa de Flota Norte');
    expect(row.textContent).toContain('Ruta CDMX');
    expect(row.textContent).toContain('hace 3 h');
    const more = Array.from(dialog.querySelectorAll('.pr-pendientes__more')).map(
      (node) => node.textContent,
    );
    expect(more).toEqual(['y 1 más', 'y 2 más']);
    const footer = dialog.querySelector('.pr-notifications__footer')!;
    expect(footer.textContent).toBe('Ver todo en Inicio');
    expect(footer.getAttribute('href')).toBe(pendientes.href);
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
    const row = screen.getByRole('dialog').querySelector('[data-bucket="mine"].pr-notifications__item')!;
    expect(row.tagName).toBe('DIV');
    expect(row.getAttribute('href')).toBeNull();
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
  });
});
