import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import { AppShell } from './AppShell';
import { GlobalHeader } from './GlobalHeader';
import { NAV_LAST_COOKIE } from './navMemory';
import { StaffShellProvider } from './StaffShellContext';
import {
  AppbarShell,
  SECTIONS,
  TestLink,
  staffContext,
  useProductionRegistry,
} from './test/appbar-fixtures';

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
  it('is hidden by default, in launcher mode, and without the prop', () => {
    const context = staffContext({ favoriteApps: ['liveops'] });
    const { rerender } = render(<AppbarShell context={context} />);
    expect(screen.queryByRole('region', { name: 'Mis apps' })).toBeNull();

    rerender(
      <AppbarShell context={context} navigation="launcher" appsInSidebar globalHeader={<div />} />,
    );
    expect(screen.queryByRole('region', { name: 'Mis apps' })).toBeNull();
  });

  it('lists the apps in the person order, with the page each one opens', () => {
    document.cookie = `${NAV_LAST_COOKIE}=${encodeURIComponent(
      JSON.stringify({ liveops: { p: '/general/routes', l: 'Todas las rutas' } }),
    )}; path=/`;
    render(
      <AppbarShell
        appsInSidebar
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
      <AppbarShell
        appsInSidebar
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
      <AppbarShell
        appsInSidebar
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
      <AppbarShell
        appsInSidebar
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
    // APP_BAR_ORDER, not click order.
    expect(setFavoriteApps).toHaveBeenLastCalledWith(['nexus', 'supply', 'liveops']);
    await user.click(within(favs()).getByRole('checkbox', { name: /FDS/ }));
    expect(setFavoriteApps).toHaveBeenLastCalledWith(['supply', 'liveops', 'fds']);
    await user.click(within(favs()).getByRole('button', { name: 'Listo' }));
    expect(within(favs()).getAllByRole('link')).toHaveLength(2);
  });

  it('disables the unchecked apps at the limit and shows the hint', async () => {
    const user = userEvent.setup();
    render(
      <AppbarShell
        appsInSidebar
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
      <AppbarShell
        appsInSidebar
        context={staffContext({ favoriteApps: [], setFavoriteApps: vi.fn() })}
      />,
    );
    await user.click(within(favs()).getByRole('button', { name: 'Elige tus apps' }));
    expect(within(favs()).getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  it('renders nothing for an empty list without a setter, and has no Editar button', () => {
    const { rerender } = render(
      <AppbarShell appsInSidebar context={staffContext({ favoriteApps: [] })} />,
    );
    expect(screen.queryByRole('region', { name: 'Mis apps' })).toBeNull();
    rerender(<AppbarShell appsInSidebar context={staffContext({ favoriteApps: ['liveops'] })} />);
    expect(within(favs()).queryByRole('button', { name: 'Editar' })).toBeNull();
  });

  it('ignores unknown subs and speaks English', () => {
    render(
      <AppbarShell
        appsInSidebar
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
        navigation="switcher"
        appSub="supply"
        appsInSidebar
        LinkComponent={TestLink}
      >
        x
      </AppShell>,
    );
    expect(screen.queryByRole('region', { name: 'Mis apps' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeTruthy();
  });

  it('works in switcher mode, above the app menu', () => {
    render(
      <StaffShellProvider value={staffContext({ favoriteApps: ['liveops'] })}>
        <AppShell
          sections={SECTIONS}
          currentPath="/fleets"
          navigation="switcher"
          appSub="supply"
          appsInSidebar
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
});
