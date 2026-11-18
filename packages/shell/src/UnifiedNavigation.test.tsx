import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import { SidebarTrigger } from './AppShell';
import { AppShell } from './AppShell';
import { GlobalHeader } from './GlobalHeader';
import { NAV_LAST_COOKIE } from './navMemory';
import { StaffShellProvider } from './StaffShellContext';
import { WAY_BACK_KEY } from './wayBack';
import {
  UnifiedShell,
  SECTIONS,
  staffContext,
  useProductionRegistry,
} from './test/unified-fixtures';

const FROM = '#pr-from=supply:%2Ffleets';

function Unified(props: Parameters<typeof UnifiedShell>[0] = {}) {
  return <UnifiedShell {...props} />;
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

describe('unified mode in the shell', () => {
  it('opens the registry start page of the app from the brand when it is not /', () => {
    const { container } = render(<Unified appSub="sube-tu-factura" header={{ currentSub: 'sube-tu-factura' }} />);
    expect(container.querySelector('a.pr-sidebar__brand')!.getAttribute('href')).toBe(
      '/admin/finanzas/dashboard',
    );
  });

  it('falls back to / for an unknown app, and an explicit brandHref wins', () => {
    const { container, rerender } = render(<Unified appSub="nope" header={{ currentSub: 'nope' }} />);
    expect(container.querySelector('a.pr-sidebar__brand')!.getAttribute('href')).toBe('/');
    rerender(<Unified appSub="sube-tu-factura" brandHref="/custom" header={{ currentSub: 'sube-tu-factura' }} />);
    expect(container.querySelector('a.pr-sidebar__brand')!.getAttribute('href')).toBe('/custom');
  });

  it('opens this app from the brand, drops the Nexus item, and has no bar', () => {
    const { container } = render(<Unified nexusHref="https://nexus.partrunner.ai" />);
    expect(container.querySelector('a.pr-sidebar__brand')!.getAttribute('href')).toBe('/');
    expect(
      within(screen.getByRole('navigation', { name: 'Navegación principal' })).queryByText('Nexus'),
    ).toBeNull();
    expect(container.querySelector('.pr-appbar')).toBeNull();
    expect(container.querySelector('.pr-global-header')!.getAttribute('data-navigation')).toBe(
      'unified',
    );
    expect(container.querySelector('.pr-goto-trigger--field')).toBeTruthy();
    expect(decodeURIComponent(document.cookie)).toContain('"supply":{"p":"/fleets"');
  });

  it('keeps launcher mode as it was: grid button, no way back, no field', () => {
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
    expect(container.querySelector('.pr-wayback')).toBeNull();
    expect(container.querySelector('.pr-goto-trigger')).toBeNull();
  });

  it('reports sidebar clicks', () => {
    const onNavigate = vi.fn();
    render(<Unified onNavigate={onNavigate} />);
    screen.getByRole('link', { name: 'Unidades' }).click();
    expect(onNavigate).toHaveBeenCalledWith({
      source: 'menu',
      fromSub: 'supply',
      toSub: 'supply',
      href: '/units',
    });
  });
});

describe('the header order in unified mode', () => {
  it('puts the sidebar trigger first, then the way back, start, the search field, and the grid', async () => {
    arriveFrom('#pr-from=liveops:%2Frutas');
    const { container } = render(<Unified header={{ start: <span>host start</span> }} />);
    await screen.findByTitle('Volver a LiveOps');
    const header = container.querySelector('.pr-global-header')!;
    const order = [
      '.pr-sidebar__trigger',
      '.pr-wayback',
      '.pr-global-header__start',
      '.pr-goto-trigger--field',
      '.pr-launcher',
    ].map((selector) => header.querySelector(selector)!);
    order.forEach((node) => expect(node).toBeTruthy());
    for (let i = 1; i < order.length; i += 1) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('renders no app-name selector and no app bar', () => {
    const { container } = render(<Unified />);
    expect(container.querySelector('.pr-switcher')).toBeNull();
    expect(container.querySelector('.pr-appbar')).toBeNull();
    expect(container.querySelector('.pr-global-header__nav')).toBeNull();
  });
});

describe('the sidebar trigger', () => {
  it('renders nothing for a host SidebarTrigger in start in unified mode', () => {
    const { container } = render(
      <Unified header={{ start: <SidebarTrigger /> }} />,
    );
    expect(container.querySelectorAll('.pr-global-header .pr-sidebar__trigger')).toHaveLength(1);
  });

  it('still renders the host trigger in launcher mode', () => {
    const { container } = render(
      <StaffShellProvider value={staffContext()}>
        <AppShell
          sections={SECTIONS}
          currentPath="/fleets"
          globalHeader={<GlobalHeader currentSub="supply" start={<SidebarTrigger />} />}
        >
          x
        </AppShell>
      </StaffShellProvider>,
    );
    expect(container.querySelectorAll('.pr-global-header .pr-sidebar__trigger')).toHaveLength(1);
  });
});

describe('accessibility and events', () => {
  it('gives the chip a full aria-label', async () => {
    arriveFrom('#pr-from=liveops:%2Frutas');
    render(<Unified />);
    const chip = await screen.findByLabelText('Volver a LiveOps');
    expect(chip.tagName).toBe('A');
  });

  it('marks the palette input as a list autocomplete', async () => {
    const user = userEvent.setup();
    render(<Unified />);
    await user.click(screen.getByRole('button', { name: /Buscar o ir a…/ }));
    expect(screen.getByRole('combobox').getAttribute('aria-autocomplete')).toBe('list');
  });

  it('reports the brand in the plain link branches too', () => {
    const onNavigate = vi.fn();
    const onBrandSelect = vi.fn();
    const { container, rerender } = render(
      <Unified onNavigate={onNavigate} onBrandSelect={onBrandSelect} />,
    );
    container.querySelector<HTMLElement>('a.pr-sidebar__brand')!.click();
    expect(onBrandSelect).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenLastCalledWith({
      source: 'brand',
      fromSub: 'supply',
      toSub: 'supply',
      href: '/',
    });
    rerender(<Unified onNavigate={onNavigate} brandHref="https://example.com/home" />);
    container.querySelector<HTMLElement>('a.pr-sidebar__brand')!.click();
    expect(onNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'brand', href: 'https://example.com/home' }),
    );
  });

  it('ignores a rejected promise from onNavigate', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const { container } = render(
      <Unified onNavigate={() => Promise.reject(new Error('tracking down')) as never} />,
    );
    container.querySelector<HTMLElement>('a.pr-sidebar__brand')!.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('the way-back fragment scope', () => {
  it('is not added to a host that is not a registry app', async () => {
    const user = userEvent.setup();
    render(
      <Unified
        context={staffContext({
          pages: [
            { app: 'sales', label: 'Externa', href: 'https://other.example.com/x' },
            { app: 'sales', label: 'Interna', href: 'https://sales.partrunner.ai/y' },
          ],
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Buscar o ir a…/ }));
    await user.type(screen.getByRole('combobox'), 'na');
    const href = (label: string) =>
      within(screen.getAllByRole('option').find((row) => row.textContent!.startsWith(label))!)
        .getByRole('link')
        .getAttribute('href');
    expect(href('Externa')).toBe('https://other.example.com/x');
    expect(href('Interna')).toBe(`https://sales.partrunner.ai/y${FROM}`);
  });

  it('keeps history.state when it removes the fragment', async () => {
    window.history.replaceState({ keep: 1 }, '', '/fleets#pr-from=liveops:%2Frutas');
    render(<Unified />);
    await screen.findByLabelText('Volver a LiveOps');
    expect(window.location.hash).toBe('');
    expect(window.history.state).toEqual({ keep: 1 });
  });
});

describe('the way back', () => {
  it('reads the fragment once, removes only it, and shows the chip', async () => {
    arriveFrom('#pr-from=liveops:%2Frutas%2F9');
    render(<Unified />);
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
    const { unmount } = render(<Unified />);
    expect(await screen.findByTitle('Volver a Comercial')).toBeTruthy();
    unmount();
    arriveFrom('#pr-from=liveops:%2Frutas');
    render(<Unified />);
    expect(await screen.findByTitle('Volver a LiveOps')).toBeTruthy();
  });

  it('ignores a stored arrival on an ignored path', () => {
    window.sessionStorage.setItem(WAY_BACK_KEY, JSON.stringify({ s: 'nexus', p: '/logout' }));
    const { container } = render(<Unified />);
    expect(container.querySelector('.pr-wayback')).toBeNull();
  });

  it('ignores a stored arrival from the current app', () => {
    window.sessionStorage.setItem(WAY_BACK_KEY, JSON.stringify({ s: 'supply', p: '/x' }));
    const { container } = render(<Unified />);
    expect(container.querySelector('.pr-wayback')).toBeNull();
  });

  it.each([
    ['an unknown app', '#pr-from=nope:%2Fx'],
    ['a protocol-relative path', '#pr-from=liveops:%2F%2Fevil.com'],
    ['a backslash path', '#pr-from=liveops:%2F%5Cevil.com'],
    ['a control character', '#pr-from=liveops:%2Fa%09b'],
    ['an ignored login path', '#pr-from=nexus:%2Flogout'],
    ['an ignored auth path', '#pr-from=liveops:%2Fauth%2Fcallback'],
    ['a malformed escape', '#pr-from=liveops:%E0%A4%A'],
  ])('rejects %s but still removes the fragment', (_name, hash) => {
    arriveFrom(hash);
    const { container } = render(<Unified />);
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
    render(<Unified />);
    const chip = await screen.findByTitle('Volver a LiveOps');
    expect(chip.getAttribute('href')).toBe(`https://liveops.partrunner.ai/rutas/4${FROM}`);
  });

  it('falls back to the start page when the memory has nothing', async () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://sales.partrunner.ai/x',
      configurable: true,
    });
    render(<Unified />);
    const chip = await screen.findByTitle('Volver a Comercial');
    expect(chip.getAttribute('href')).toBe(`https://sales.partrunner.ai/${FROM}`);
  });

  it('ignores a referrer from an unknown origin or from this app', () => {
    for (const value of ['https://evil.example/x', 'https://supply.partrunner.ai/y']) {
      Object.defineProperty(document, 'referrer', { value, configurable: true });
      const { container, unmount } = render(<Unified />);
      expect(container.querySelector('.pr-wayback')).toBeNull();
      unmount();
    }
  });

  it('reports the way back click', async () => {
    arriveFrom('#pr-from=liveops:%2Frutas');
    const onNavigate = vi.fn();
    render(<Unified onNavigate={onNavigate} />);
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
    render(<Unified onNavigate={onNavigate} />);
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

  it('reports app rows of the palette as goto events and never adds the fragment to this app', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<Unified onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: /Buscar o ir a…/ }));
    const rows = screen.getAllByRole('option');
    const here = rows.find((row) => row.textContent!.startsWith('Supply'))!;
    expect(within(here).getByRole('link').getAttribute('href')).toBe('/');
    const live = rows.find((row) => row.textContent!.startsWith('LiveOps'))!;
    expect(within(live).getByRole('link').getAttribute('href')).toBe(
      `https://liveops.partrunner.ai${FROM}`,
    );
    within(live).getByRole('link').click();
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ source: 'goto' }));
  });
});
