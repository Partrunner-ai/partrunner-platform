import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import { AppShell } from './AppShell';
import { GlobalHeader } from './GlobalHeader';
import { isAppNavigation } from './NavigationContext';
import { NAV_LAST_COOKIE } from './navMemory';
import { StaffShellProvider } from './StaffShellContext';
import { WAY_BACK_KEY } from './wayBack';
import {
  AppbarShell,
  SECTIONS,
  staffContext,
  useProductionRegistry,
} from './test/appbar-fixtures';

const FROM = '#pr-from=supply:%2Ffleets';

function Switcher(props: Parameters<typeof AppbarShell>[0] = {}) {
  return <AppbarShell navigation="switcher" {...props} />;
}

function seedLast(last: Record<string, { p: string; l?: string } | string>) {
  document.cookie = `${NAV_LAST_COOKIE}=${encodeURIComponent(JSON.stringify(last))}; path=/`;
}

function arriveFrom(hash: string) {
  window.history.replaceState(null, '', `/fleets${hash}`);
}

beforeEach(() => {
  useProductionRegistry();
  document.addEventListener('click', swallow);
});
afterEach(() => {
  document.removeEventListener('click', swallow);
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  Object.defineProperty(document, 'referrer', { value: '', configurable: true });
  configureAppRegistry({ hostPrefix: 'staging.', baseDomain: 'partrunner.ai' });
});
function swallow(event: Event) {
  event.preventDefault();
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Supply/ }));
  return { user, menu: screen.getByRole('menu') };
}

describe('switcher mode in the shell', () => {
  it('knows which modes share the app navigation rules', () => {
    expect(isAppNavigation('appbar')).toBe(true);
    expect(isAppNavigation('switcher')).toBe(true);
    expect(isAppNavigation('launcher')).toBe(false);
    expect(isAppNavigation(undefined)).toBe(false);
  });

  it('opens this app from the brand, drops the Nexus item, and has no bar or grid button', () => {
    const { container } = render(<Switcher nexusHref="https://nexus.partrunner.ai" />);
    expect(container.querySelector('a.pr-sidebar__brand')!.getAttribute('href')).toBe('/');
    expect(
      within(screen.getByRole('navigation', { name: 'Navegación principal' })).queryByText('Nexus'),
    ).toBeNull();
    expect(container.querySelector('.pr-appbar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aplicaciones' })).toBeNull();
    expect(container.querySelector('.pr-global-header')!.getAttribute('data-navigation')).toBe(
      'switcher',
    );
    expect(container.querySelector('.pr-goto-trigger--field')).toBeTruthy();
    expect(decodeURIComponent(document.cookie)).toContain('"supply":{"p":"/fleets"');
  });

  it('keeps launcher mode as it was: grid button, no switcher, no field', () => {
    const { container } = render(
      <StaffShellProvider value={staffContext()}>
        <AppShell
          sections={SECTIONS}
          currentPath="/fleets"
          globalHeader={<GlobalHeader currentSub="supply" />}
        >
          x
        </AppShell>
      </StaffShellProvider>,
    );
    expect(screen.getByRole('button', { name: 'Aplicaciones' })).toBeTruthy();
    expect(container.querySelector('.pr-switcher')).toBeNull();
    expect(container.querySelector('.pr-wayback')).toBeNull();
    expect(container.querySelector('.pr-goto-trigger')).toBeNull();
  });

  it('reports sidebar clicks like the app bar mode', () => {
    const onNavigate = vi.fn();
    render(<Switcher onNavigate={onNavigate} />);
    screen.getByRole('link', { name: 'Unidades' }).click();
    expect(onNavigate).toHaveBeenCalledWith({
      source: 'menu',
      fromSub: 'supply',
      toSub: 'supply',
      href: '/units',
    });
  });
});

describe('the app switcher', () => {
  it('names the trigger after the current app, Nexus included', () => {
    const { unmount } = render(<Switcher />);
    const trigger = screen.getByRole('button', { name: /Supply/ });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    unmount();
    render(<Switcher appSub="nexus" header={{ currentSub: 'nexus' }} />);
    expect(screen.getByRole('button', { name: /Nexus/ })).toBeTruthy();
  });

  it('shows «Apps» when the current app is unknown', () => {
    render(<Switcher appSub="nope" header={{ currentSub: 'nope' }} />);
    expect(screen.getByRole('button', { name: /Apps/ })).toBeTruthy();
  });

  it('lists the apps in order without Comunidad, numbered, with page labels', async () => {
    seedLast({ liveops: { p: '/rutas', l: 'Rutas' }, sales: '/deals' });
    render(<Switcher />);
    const { menu } = await openMenu();
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '1NexusInicio',
      '2ComercialInicio',
      '3SolicitudesInicio',
      '4SupplyInicioaquí',
      '5LiveOpsRutas',
      '6FinanzasInicio',
      '7FDSInicio',
    ]);
    expect(within(menu).queryByText('Comunidad')).toBeNull();
  });

  it('marks the current app and routes it in place; other apps are native links with the way back', async () => {
    seedLast({ liveops: { p: '/rutas/9', l: 'Rutas' } });
    render(<Switcher />);
    const { menu } = await openMenu();
    const items = within(menu).getAllByRole('menuitem');
    expect(items[3]!.getAttribute('aria-current')).toBe('page');
    expect(items[3]!.getAttribute('href')).toBe('/');
    expect(items[4]!.getAttribute('href')).toBe(`https://liveops.partrunner.ai/rutas/9${FROM}`);
    expect(items[1]!.getAttribute('href')).toBe(`https://sales.partrunner.ai${FROM}`);
  });

  it('moves focus with the arrows, Home and End', async () => {
    render(<Switcher />);
    const { user, menu } = await openMenu();
    const items = within(menu).getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[3]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[4]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(items[6]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(items[6]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(items[0]);
  });

  it('opens the row of a digit and reports the switcher source', async () => {
    const onNavigate = vi.fn();
    render(<Switcher onNavigate={onNavigate} />);
    const { user } = await openMenu();
    await user.keyboard('5');
    expect(onNavigate).toHaveBeenCalledWith({
      source: 'switcher',
      fromSub: 'supply',
      toSub: 'liveops',
      href: `https://liveops.partrunner.ai${FROM}`,
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<Switcher />);
    const { user } = await openMenu();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /Supply/ })),
    );
  });

  it('says «Home» and «here» in English', async () => {
    render(<Switcher context={staffContext({ preferences: { locale: 'en', theme: 'system' } })} />);
    const { menu } = await openMenu();
    expect(within(menu).getAllByRole('menuitem')[3]!.textContent).toBe('4SupplyHomehere');
  });
});

describe('the header order in switcher mode', () => {
  it('puts the sidebar trigger first, then the way back, the switcher, and start', async () => {
    arriveFrom('#pr-from=liveops:%2Frutas');
    const { container } = render(<Switcher header={{ start: <span>host start</span> }} />);
    await screen.findByTitle('Volver a LiveOps');
    const header = container.querySelector('.pr-global-header')!;
    const order = [
      '.pr-sidebar__trigger',
      '.pr-wayback',
      '.pr-switcher',
      '.pr-global-header__start',
    ].map((selector) => header.querySelector(selector)!);
    order.forEach((node) => expect(node).toBeTruthy());
    for (let i = 1; i < order.length; i += 1) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('leaves the trigger to the host in launcher and appbar modes', () => {
    const { container } = render(<AppbarShell />);
    expect(container.querySelector('.pr-global-header .pr-sidebar__trigger')).toBeNull();
  });
});

describe('the way back', () => {
  it('reads the fragment once, removes only it, and shows the chip', async () => {
    arriveFrom('#pr-from=liveops:%2Frutas%2F9');
    render(<Switcher />);
    const chip = await screen.findByTitle('Volver a LiveOps');
    expect(chip.getAttribute('href')).toBe(`https://liveops.partrunner.ai/rutas/9${FROM}`);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/fleets');
    expect(JSON.parse(window.sessionStorage.getItem(WAY_BACK_KEY)!)).toEqual({
      s: 'liveops',
      p: '/rutas/9',
    });
  });

  it('keeps the arrival for the tab and lets a newer one replace it', async () => {
    window.sessionStorage.setItem(WAY_BACK_KEY, JSON.stringify({ s: 'sales', p: '/deals' }));
    const { unmount } = render(<Switcher />);
    expect(await screen.findByTitle('Volver a Comercial')).toBeTruthy();
    unmount();
    arriveFrom('#pr-from=liveops:%2Frutas');
    render(<Switcher />);
    expect(await screen.findByTitle('Volver a LiveOps')).toBeTruthy();
  });

  it('ignores a stored arrival from the current app', () => {
    window.sessionStorage.setItem(WAY_BACK_KEY, JSON.stringify({ s: 'supply', p: '/x' }));
    const { container } = render(<Switcher />);
    expect(container.querySelector('.pr-wayback')).toBeNull();
  });

  it.each([
    ['an unknown app', '#pr-from=nope:%2Fx'],
    ['a protocol-relative path', '#pr-from=liveops:%2F%2Fevil.com'],
    ['a backslash path', '#pr-from=liveops:%2F%5Cevil.com'],
    ['a control character', '#pr-from=liveops:%2Fa%09b'],
    ['a malformed escape', '#pr-from=liveops:%E0%A4%A'],
  ])('rejects %s but still removes the fragment', (_name, hash) => {
    arriveFrom(hash);
    const { container } = render(<Switcher />);
    expect(container.querySelector('.pr-wayback')).toBeNull();
    expect(window.location.hash).toBe('');
    expect(window.sessionStorage.getItem(WAY_BACK_KEY)).toBeNull();
  });

  it('falls back to the referrer: a known app, with its last page', async () => {
    seedLast({ liveops: { p: '/rutas/4', l: 'Rutas' } });
    Object.defineProperty(document, 'referrer', {
      value: 'https://liveops.partrunner.ai/anything',
      configurable: true,
    });
    render(<Switcher />);
    const chip = await screen.findByTitle('Volver a LiveOps');
    expect(chip.getAttribute('href')).toBe(`https://liveops.partrunner.ai/rutas/4${FROM}`);
  });

  it('falls back to the start page when the memory has nothing', async () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://sales.partrunner.ai/x',
      configurable: true,
    });
    render(<Switcher />);
    const chip = await screen.findByTitle('Volver a Comercial');
    expect(chip.getAttribute('href')).toBe(`https://sales.partrunner.ai/${FROM}`);
  });

  it('ignores a referrer from an unknown origin or from this app', () => {
    for (const value of ['https://evil.example/x', 'https://supply.partrunner.ai/y']) {
      Object.defineProperty(document, 'referrer', { value, configurable: true });
      const { container, unmount } = render(<Switcher />);
      expect(container.querySelector('.pr-wayback')).toBeNull();
      unmount();
    }
  });

  it('reports the way back click', async () => {
    arriveFrom('#pr-from=liveops:%2Frutas');
    const onNavigate = vi.fn();
    render(<Switcher onNavigate={onNavigate} />);
    (await screen.findByTitle('Volver a LiveOps')).click();
    expect(onNavigate).toHaveBeenCalledWith({
      source: 'wayback',
      fromSub: 'supply',
      toSub: 'liveops',
      href: `https://liveops.partrunner.ai/rutas${FROM}`,
    });
  });

  it('puts «Volver» first in the palette, then Recientes without it, then Apps', async () => {
    arriveFrom('#pr-from=liveops:%2Frutas');
    document.cookie = `pr-nav-recent=${encodeURIComponent(
      JSON.stringify([
        { s: 'liveops', p: '/rutas', l: 'Rutas' },
        { s: 'sales', p: '/deals', l: 'Negocios' },
      ]),
    )}; path=/`;
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<Switcher onNavigate={onNavigate} />);
    await screen.findByTitle('Volver a LiveOps');
    await user.click(screen.getByRole('button', { name: /Buscar o ir a…/ }));
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options[0]).toBe('LiveOps');
    expect(options[1]).toBe('NegociosComercial');
    expect(options.filter((text) => text!.startsWith('Rutas'))).toHaveLength(0);
    expect(options.slice(2)).toHaveLength(7);
    const headings = Array.from(document.querySelectorAll('.pr-goto__heading')).map(
      (node) => node.textContent,
    );
    expect(headings).toEqual(['Volver', 'Recientes', 'Apps']);

    await user.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ source: 'wayback' }));
  });

  it('reports app rows of the palette as switcher events and never adds the fragment to this app', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<Switcher onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: /Buscar o ir a…/ }));
    const rows = screen.getAllByRole('option');
    const here = rows.find((row) => row.textContent!.startsWith('Supply'))!;
    expect(within(here).getByRole('link').getAttribute('href')).toBe('/');
    const live = rows.find((row) => row.textContent!.startsWith('LiveOps'))!;
    expect(within(live).getByRole('link').getAttribute('href')).toBe(
      `https://liveops.partrunner.ai${FROM}`,
    );
    within(live).getByRole('link').click();
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ source: 'switcher' }));
  });

  it('adds no fragment to links of the app bar mode for this app', () => {
    render(<AppbarShell />);
    const bar = screen.getByRole('navigation', { name: 'Aplicaciones' });
    expect(within(bar).getByRole('link', { name: 'Supply' }).getAttribute('href')).toBe('/');
    expect(within(bar).getByRole('link', { name: 'LiveOps' }).getAttribute('href')).toContain(
      '#pr-from=',
    );
  });
});
