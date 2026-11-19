import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import { AppShell } from './AppShell';
import { GlobalHeader } from './GlobalHeader';
import { NAV_LAST_COOKIE } from './navMemory';
import { StaffShellProvider } from './StaffShellContext';
import {
  UnifiedShell,
  SECTIONS,
  TestLink,
  staffContext,
  useProductionRegistry,
} from './test/unified-fixtures';

beforeEach(() => {
  useProductionRegistry();
  document.addEventListener('click', swallow);
});
afterEach(() => {
  document.removeEventListener('click', swallow);
  document.cookie = `${NAV_LAST_COOKIE}=; path=/; max-age=0`;
  configureAppRegistry({ hostPrefix: 'staging.', baseDomain: 'partrunner.ai' });
});

function swallow(event: Event) {
  event.preventDefault();
}

function favs(): HTMLElement {
  return screen.getByRole('region', { name: 'Mis apps' });
}

describe('«Mis apps» in the sidebar', () => {
  it('is hidden in launcher mode and shown in unified mode without any prop', () => {
    const context = staffContext({ favoriteApps: ['liveops'] });
    const { rerender } = render(<UnifiedShell context={context} />);
    expect(screen.getByRole('region', { name: 'Mis apps' })).toBeTruthy();

    rerender(
      <UnifiedShell context={context} navigation="launcher" globalHeader={<div />} />,
    );
    expect(screen.queryByRole('region', { name: 'Mis apps' })).toBeNull();
  });

  it('lists the apps in the person order, with the page each one opens', () => {
    document.cookie = `${NAV_LAST_COOKIE}=${encodeURIComponent(
      JSON.stringify({ liveops: { p: '/general/routes', l: 'Todas las rutas' } }),
    )}; path=/`;
    render(
      <UnifiedShell
       
        context={staffContext({ favoriteApps: ['liveops', 'nexus', 'supply'] })}
      />,
    );
    const links = within(favs()).getAllByRole('link');
    expect(links.map((link) => link.querySelector('.pr-favs__name')!.textContent)).toEqual([
      'LiveOps',
      'Nexus',
      'Supply',
    ]);
    expect(links[0]!.querySelector('.pr-favs__page')!.textContent).toBe('Todas las rutas');
    expect(links[1]!.querySelector('.pr-favs__page')!.textContent).toBe('Inicio');
    expect(links[0]!.getAttribute('href')).toBe(
      'https://liveops.partrunner.ai/general/routes#pr-from=supply:%2Ffleets',
    );
  });

  it('marks the current app and routes it in place', () => {
    const onNavigate = vi.fn();
    render(
      <UnifiedShell
       
        onNavigate={onNavigate}
        context={staffContext({ favoriteApps: ['supply', 'liveops'] })}
      />,
    );
    const current = within(favs()).getByRole('link', { name: /Supply/ });
    expect(current.getAttribute('data-active')).toBe('true');
    expect(current.getAttribute('href')).toBe('/');
    current.click();
    expect(onNavigate).toHaveBeenCalledWith({
      source: 'favorites',
      fromSub: 'supply',
      toSub: 'supply',
      href: '/',
    });
  });

  it('reports a click on another app with the favorites source', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <UnifiedShell
       
        onNavigate={onNavigate}
        context={staffContext({ favoriteApps: ['liveops'] })}
      />,
    );
    await user.click(within(favs()).getByRole('link', { name: /LiveOps/ }));
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'favorites', fromSub: 'supply', toSub: 'liveops' }),
    );
  });

  it('edits the list: checks, a limit of five, and the saved order', async () => {
    const setFavoriteApps = vi.fn();
    const user = userEvent.setup();
    render(
      <UnifiedShell
       
        context={staffContext({
          favoriteApps: ['liveops', 'supply'],
          setFavoriteApps,
        })}
      />,
    );
    await user.click(within(favs()).getByRole('button', { name: 'Editar' }));
    const boxes = within(favs()).getAllByRole('checkbox');
    expect(boxes).toHaveLength(7);
    expect(within(favs()).getByRole('checkbox', { name: /LiveOps/ })).toHaveProperty('checked', true);

    await user.click(within(favs()).getByRole('checkbox', { name: /Nexus/ }));
    // APP_NAV_ORDER, not click order.
    expect(setFavoriteApps).toHaveBeenLastCalledWith(['nexus', 'supply', 'liveops']);
    await user.click(within(favs()).getByRole('checkbox', { name: /FDS/ }));
    // The host list did not change, so the shell keeps the edit it showed.
    expect(setFavoriteApps).toHaveBeenLastCalledWith(['nexus', 'supply', 'liveops', 'fds']);
    await user.click(within(favs()).getByRole('button', { name: 'Listo' }));
    expect(within(favs()).getAllByRole('link')).toHaveLength(4);
  });

  it('disables the unchecked apps at the limit and shows the hint', async () => {
    const user = userEvent.setup();
    render(
      <UnifiedShell
       
        context={staffContext({
          favoriteApps: ['nexus', 'sales', 'solicitudes', 'supply', 'liveops'],
          setFavoriteApps: vi.fn(),
        })}
      />,
    );
    await user.click(within(favs()).getByRole('button', { name: 'Editar' }));
    const fds = within(favs()).getByRole('checkbox', { name: /FDS/ });
    expect(fds).toHaveProperty('disabled', true);
    expect(within(favs()).getAllByText('Máximo 5').length).toBeGreaterThan(0);
    expect(within(favs()).getByRole('checkbox', { name: /Nexus/ })).toHaveProperty('disabled', false);
  });

  it('shows «Elige tus apps» when the list is empty and a setter exists', async () => {
    const user = userEvent.setup();
    render(
      <UnifiedShell
       
        context={staffContext({ favoriteApps: [], setFavoriteApps: vi.fn() })}
      />,
    );
    await user.click(within(favs()).getByRole('button', { name: 'Elige tus apps' }));
    expect(within(favs()).getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  it('renders nothing for an empty list without a setter, and has no Editar button', () => {
    const { rerender } = render(
      <UnifiedShell context={staffContext({ favoriteApps: [] })} />,
    );
    expect(screen.queryByRole('region', { name: 'Mis apps' })).toBeNull();
    rerender(<UnifiedShell context={staffContext({ favoriteApps: ['liveops'] })} />);
    expect(within(favs()).queryByRole('button', { name: 'Editar' })).toBeNull();
  });

  it('ignores unknown subs and speaks English', () => {
    render(
      <UnifiedShell
       
        context={staffContext({
          favoriteApps: ['nope', 'liveops'],
          setFavoriteApps: vi.fn(),
          preferences: { locale: 'en', theme: 'system' },
        })}
      />,
    );
    const section = screen.getByRole('region', { name: 'My apps' });
    expect(within(section).getAllByRole('link')).toHaveLength(1);
    expect(within(section).getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('does not crash without a StaffShellProvider', () => {
    render(
      <AppShell
        sections={SECTIONS}
        currentPath="/fleets"
       
        appSub="supply"
       
        LinkComponent={TestLink}
      >
        x
      </AppShell>,
    );
    expect(screen.queryByRole('region', { name: 'Mis apps' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeTruthy();
  });

  it('renders without a prop, above the app menu', () => {
    render(
      <StaffShellProvider value={staffContext({ favoriteApps: ['liveops'] })}>
        <AppShell
          sections={SECTIONS}
          currentPath="/fleets"
          navigation="unified"
          appSub="supply"
          LinkComponent={TestLink}
          globalHeader={<GlobalHeader currentSub="supply" />}
        >
          x
        </AppShell>
      </StaffShellProvider>,
    );
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(nav.firstElementChild).toBe(favs());
  });

  it('puts the previous list back and shows one error line when the save fails', async () => {
    const user = userEvent.setup();
    const setFavoriteApps = vi.fn((): Promise<void> => Promise.reject(new Error('down')));
    render(
      <UnifiedShell
        context={staffContext({ favoriteApps: ['liveops'], setFavoriteApps })}
      />,
    );
    await user.click(within(favs()).getByRole('button', { name: 'Editar' }));
    await user.click(within(favs()).getByRole('checkbox', { name: /Nexus/ }));
    const status = await within(favs()).findByRole('status');
    expect(status.textContent).toBe('No se pudo guardar. Intenta de nuevo.');
    expect(within(favs()).getByRole('checkbox', { name: /Nexus/ })).toHaveProperty('checked', false);
    expect(within(favs()).getByRole('checkbox', { name: /LiveOps/ })).toHaveProperty('checked', true);
    // The next edit clears the line.
    setFavoriteApps.mockImplementation(() => Promise.resolve());
    await user.click(within(favs()).getByRole('checkbox', { name: /Nexus/ }));
    expect(within(favs()).getByRole('status').textContent).toBe('');
  });

  it('restores the previous list when the setter throws, in English', async () => {
    const user = userEvent.setup();
    render(
      <UnifiedShell
        context={staffContext({
          favoriteApps: ['liveops'],
          preferences: { locale: 'en', theme: 'system' },
          setFavoriteApps: () => {
            throw new Error('down');
          },
        })}
      />,
    );
    await user.click(within(screen.getByRole('region', { name: 'My apps' })).getByRole('button', { name: 'Edit' }));
    await user.click(within(screen.getByRole('region', { name: 'My apps' })).getByRole('checkbox', { name: /Supply/ }));
    expect((await within(screen.getByRole('region', { name: 'My apps' })).findByRole('status')).textContent).toBe('Could not save. Try again.');
    expect(within(screen.getByRole('region', { name: 'My apps' })).getByRole('checkbox', { name: /Supply/ })).toHaveProperty('checked', false);
  });

  it('drops subs unknown to the installed registry from rows and the edit list', async () => {
    const user = userEvent.setup();
    const setFavoriteApps = vi.fn();
    render(
      <UnifiedShell
        context={staffContext({ favoriteApps: ['ghost', 'community', 'liveops'], setFavoriteApps })}
      />,
    );
    // Comunidad has appNav: false, so it is unknown to the navigation too.
    expect(within(favs()).getAllByRole('link')).toHaveLength(1);
    await user.click(within(favs()).getByRole('button', { name: 'Editar' }));
    expect(within(favs()).getAllByRole('checkbox')).toHaveLength(7);
    await user.click(within(favs()).getByRole('checkbox', { name: /Nexus/ }));
    expect(setFavoriteApps).toHaveBeenLastCalledWith(['nexus', 'liveops', 'ghost', 'community']);
  });

  it('keeps a pending second toggle when the first save fails late', async () => {
    const user = userEvent.setup();
    const first = deferred();
    const second = deferred();
    const setFavoriteApps = vi
      .fn<(subs: readonly string[]) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<UnifiedShell context={staffContext({ favoriteApps: ['liveops'], setFavoriteApps })} />);
    await user.click(within(favs()).getByRole('button', { name: 'Editar' }));
    await user.click(within(favs()).getByRole('checkbox', { name: /Nexus/ }));
    await user.click(within(favs()).getByRole('checkbox', { name: /FDS/ }));
    first.reject(new Error('late'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    // The second toggle is still the latest save: its edit stays.
    await user.click(within(favs()).getByRole('button', { name: 'Listo' }));
    expect(
      within(favs()).getAllByRole('link').map((link) => link.querySelector('.pr-favs__name')!.textContent),
    ).toEqual(['Nexus', 'LiveOps', 'FDS']);
    expect(within(favs()).getByRole('status').textContent).toBe('');
  });

  it('does not write an old list over a newer host list when a save fails late', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const setFavoriteApps = vi.fn((): Promise<void> => pending.promise);
    const { rerender } = render(
      <UnifiedShell context={staffContext({ favoriteApps: ['liveops'], setFavoriteApps })} />,
    );
    await user.click(within(favs()).getByRole('button', { name: 'Editar' }));
    await user.click(within(favs()).getByRole('checkbox', { name: /Nexus/ }));
    // The host list changes (a refresh) while the save is pending.
    rerender(
      <UnifiedShell
        context={staffContext({ favoriteApps: ['liveops', 'supply', 'fds'], setFavoriteApps })}
      />,
    );
    pending.reject(new Error('late'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await user.click(within(favs()).getByRole('button', { name: 'Listo' }));
    expect(
      within(favs()).getAllByRole('link').map((link) => link.querySelector('.pr-favs__name')!.textContent),
    ).toEqual(['LiveOps', 'Supply', 'FDS']);
    expect(within(favs()).getByRole('status').textContent).toBe('');
  });

  it('builds the saved list from the host list, so an unknown sub is kept', async () => {
    const user = userEvent.setup();
    const setFavoriteApps = vi.fn();
    render(
      <UnifiedShell
        context={staffContext({ favoriteApps: ['future-app', 'liveops'], setFavoriteApps })}
      />,
    );
    await user.click(within(favs()).getByRole('button', { name: 'Editar' }));
    await user.click(within(favs()).getByRole('checkbox', { name: /Nexus/ }));
    expect(setFavoriteApps).toHaveBeenLastCalledWith(['nexus', 'liveops', 'future-app']);
    await user.click(within(favs()).getByRole('checkbox', { name: /FDS/ }));
    expect(setFavoriteApps).toHaveBeenLastCalledWith(['nexus', 'liveops', 'fds', 'future-app']);
  });

  it('counts the host list, unknown subs included, against the limit of five', async () => {
    const user = userEvent.setup();
    render(
      <UnifiedShell
        context={staffContext({
          favoriteApps: ['x-one', 'x-two', 'x-three', 'x-four', 'liveops'],
          setFavoriteApps: vi.fn(),
        })}
      />,
    );
    await user.click(within(favs()).getByRole('button', { name: 'Editar' }));
    expect(within(favs()).getByRole('checkbox', { name: /Nexus/ })).toHaveProperty('disabled', true);
  });

  it('renders the status container before the error text, so it is announced', async () => {
    const user = userEvent.setup();
    render(
      <UnifiedShell
        context={staffContext({
          favoriteApps: ['liveops'],
          setFavoriteApps: () => Promise.reject(new Error('down')),
        })}
      />,
    );
    const status = within(favs()).getByRole('status');
    expect(status.textContent).toBe('');
    await user.click(within(favs()).getByRole('button', { name: 'Editar' }));
    await user.click(within(favs()).getByRole('checkbox', { name: /Nexus/ }));
    await within(favs()).findByText('No se pudo guardar. Intenta de nuevo.');
    // The same node got the text.
    expect(within(favs()).getByRole('status')).toBe(status);
  });
});

function deferred() {
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((_, rej) => {
    reject = rej;
  });
  return { promise, reject };
}

describe('«Mis apps» before the staff snapshot (shared cookie)', () => {
  it('draws the cookie rows at once, read-only, with Editar disabled', () => {
    render(
      <AppShell
        sections={SECTIONS}
        currentPath="/fleets"
        navigation="unified"
        appSub="supply"
        LinkComponent={TestLink}
        can={() => false}
        initialState={{ collapsed: false, groups: {}, favoriteApps: ['liveops', 'nexus'] }}
      >
        <p>content</p>
      </AppShell>,
    );
    const names = within(favs())
      .getAllByRole('link')
      .map((link) => link.querySelector('.pr-favs__name')!.textContent);
    expect(names).toEqual(['LiveOps', 'Nexus']);
    expect((within(favs()).getByRole('button', { name: 'Editar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('keeps the section for an empty cookie list but not without a cookie', () => {
    const shell = (initialState: { collapsed: boolean; groups: Record<string, boolean>; favoriteApps?: string[] }) => (
      <AppShell
        sections={SECTIONS}
        currentPath="/fleets"
        navigation="unified"
        appSub="supply"
        LinkComponent={TestLink}
        can={() => false}
        initialState={initialState}
      >
        <p>content</p>
      </AppShell>
    );
    const { unmount } = render(shell({ collapsed: false, groups: {}, favoriteApps: [] }));
    expect((within(favs()).getByRole('button', { name: 'Elige tus apps' }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(shell({ collapsed: false, groups: {} }));
    expect(screen.queryByRole('region', { name: 'Mis apps' })).toBeNull();
  });

  it('lets the snapshot win and enables Editar when it arrives', () => {
    const initialState = { collapsed: false, groups: {}, favoriteApps: ['liveops'] };
    const { rerender } = render(
      <AppShell
        sections={SECTIONS}
        currentPath="/fleets"
        navigation="unified"
        appSub="supply"
        LinkComponent={TestLink}
        can={() => false}
        initialState={initialState}
      >
        <p>content</p>
      </AppShell>,
    );
    const before = () =>
      within(favs())
        .getAllByRole('link')
        .map((link) => link.querySelector('.pr-favs__name')!.textContent);
    expect(before()).toEqual(['LiveOps']);

    rerender(
      <UnifiedShell
        initialState={initialState}
        context={staffContext({ favoriteApps: ['nexus', 'fds'], setFavoriteApps: vi.fn() })}
      />,
    );
    expect(before()).toEqual(['Nexus', 'FDS']);
    expect((within(favs()).getByRole('button', { name: 'Editar' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps the cookie list, read-only, while the context has no snapshot list yet', () => {
    // The LiveOps shape: the provider mounts at once with a fallback snapshot
    // that has no `favoriteApps`, and the setter already exists.
    const initialState = { collapsed: false, groups: {}, favoriteApps: ['liveops'] };
    const setFavoriteApps = vi.fn();
    const { rerender } = render(
      <UnifiedShell initialState={initialState} context={staffContext({ setFavoriteApps })} />,
    );
    const names = () =>
      within(favs())
        .queryAllByRole('link')
        .map((link) => link.querySelector('.pr-favs__name')!.textContent);
    expect(names()).toEqual(['LiveOps']);
    expect((within(favs()).getByRole('button', { name: 'Editar' }) as HTMLButtonElement).disabled).toBe(true);

    // The snapshot list arrives (empty here): it wins, and editing opens.
    rerender(
      <UnifiedShell
        initialState={initialState}
        context={staffContext({ favoriteApps: [], setFavoriteApps })}
      />,
    );
    expect(names()).toEqual([]);
    expect((within(favs()).getByRole('button', { name: 'Elige tus apps' }) as HTMLButtonElement).disabled).toBe(false);
    expect((within(favs()).getByRole('button', { name: 'Editar' }) as HTMLButtonElement).disabled).toBe(false);
    expect(setFavoriteApps).not.toHaveBeenCalled();
  });

  it('writes an empty snapshot list as «-»', () => {
    try {
      render(<UnifiedShell context={staffContext({ favoriteApps: [] })} collapseStorage="cookie" />);
      expect(document.cookie).toContain('pr-sidebar-collapsed:favs=-');
    } finally {
      document.cookie = 'pr-sidebar-collapsed:favs=; path=/; max-age=0';
    }
  });

  it('writes the snapshot list to the shared cookie, only with cookie storage', () => {
    const context = staffContext({ favoriteApps: ['fds', 'nexus'] });
    const { unmount } = render(<UnifiedShell context={context} collapseStorage="cookie" />);
    expect(document.cookie).toContain('pr-sidebar-collapsed:favs=fds.nexus');
    unmount();
    document.cookie = 'pr-sidebar-collapsed:favs=; path=/; max-age=0';

    render(<UnifiedShell context={context} />);
    expect(document.cookie).not.toContain('pr-sidebar-collapsed:favs');
  });

  it('reads the cookie on the client when the app passes no initial state', () => {
    document.cookie = 'pr-sidebar-collapsed:favs=liveops; path=/';
    try {
      render(
        <AppShell
          sections={SECTIONS}
          currentPath="/fleets"
          navigation="unified"
          appSub="supply"
          LinkComponent={TestLink}
          can={() => false}
          collapseStorage="cookie"
        >
          <p>content</p>
        </AppShell>,
      );
      expect(within(favs()).getByRole('link', { name: /LiveOps/ })).toBeTruthy();
    } finally {
      document.cookie = 'pr-sidebar-collapsed:favs=; path=/; max-age=0';
    }
  });
});
