import { Boxes } from 'lucide-react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import { AppShell } from './AppShell';
import { GlobalHeader } from './GlobalHeader';
import { useShellNavigation, type ShellNavigationValue } from './NavigationContext';
import { NAV_LAST_COOKIE, NAV_RECENT_COOKIE } from './navMemory';
import { StaffShellProvider } from './StaffShellContext';
import { AppbarShell, SECTIONS, staffContext, useProductionRegistry } from './test/appbar-fixtures';

// Links to other apps carry the page the person leaves.
const FROM = '#pr-from=supply:%2Ffleets';

beforeEach(() => {
  useProductionRegistry();
});
afterEach(() => {
  configureAppRegistry({ hostPrefix: 'staging.', baseDomain: 'partrunner.ai' });
});

function seed(last: Record<string, string>) {
  document.cookie = `${NAV_LAST_COOKIE}=${encodeURIComponent(JSON.stringify(last))}; path=/`;
}

describe('AppShell navigation="appbar"', () => {
  it('opens the start page of the current app from the brand', () => {
    const { container } = render(<AppbarShell nexusHref="https://nexus.partrunner.ai" />);
    const brand = container.querySelector('a.pr-sidebar__brand')!;
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.getAttribute('data-canonical-brand')).toBe('true');
  });

  it('lets an explicit brandHref win', () => {
    const { container } = render(<AppbarShell brandHref="/admin/dashboard" />);
    expect(container.querySelector('a.pr-sidebar__brand')!.getAttribute('href')).toBe(
      '/admin/dashboard',
    );
  });

  it('does not default onBrandSelect to onNexusSelect, but honours an explicit one', async () => {
    const onNexusSelect = vi.fn();
    const onBrandSelect = vi.fn();
    const { container, rerender } = render(
      <AppbarShell nexusHref="https://nexus.partrunner.ai" onNexusSelect={onNexusSelect} />,
    );
    container.querySelector<HTMLElement>('a.pr-sidebar__brand')!.click();
    expect(onNexusSelect).not.toHaveBeenCalled();

    rerender(<AppbarShell onBrandSelect={onBrandSelect} />);
    container.querySelector<HTMLElement>('a.pr-sidebar__brand')!.click();
    expect(onBrandSelect).toHaveBeenCalledTimes(1);
  });

  it('drops the pinned Nexus item', () => {
    render(<AppbarShell nexusHref="https://nexus.partrunner.ai" />);
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).queryByText('Nexus')).toBeNull();
  });

  it('keeps the pinned Nexus item and the Nexus brand in launcher mode', () => {
    const { container } = render(
      <StaffShellProvider value={staffContext()}>
        <AppShell
          sections={SECTIONS}
          currentPath="/fleets"
          nexusHref="https://nexus.partrunner.ai"
          globalHeader={<GlobalHeader currentSub="supply" />}
        >
          x
        </AppShell>
      </StaffShellProvider>,
    );
    expect(screen.getByText('Nexus')).toBeTruthy();
    expect(container.querySelector('a.pr-sidebar__brand')!.getAttribute('href')).toBe(
      'https://nexus.partrunner.ai',
    );
    expect(container.querySelector('.pr-appbar')).toBeNull();
    expect(container.querySelector('.pr-goto-trigger')).toBeNull();
    expect(container.querySelector('.pr-global-header')!.getAttribute('data-navigation')).toBeNull();
  });

  it('exposes flattened, permission-filtered pages and the active label', () => {
    let seen: ShellNavigationValue | null = null;
    function Probe() {
      seen = useShellNavigation();
      return null;
    }
    render(
      <AppbarShell can={(permission) => permission !== 'secret.view'}>
        <Probe />
      </AppbarShell>,
    );
    expect(seen!.mode).toBe('appbar');
    expect(seen!.appSub).toBe('supply');
    expect(seen!.pages.map((page) => page.label)).toEqual([
      'Inicio',
      'Flotas',
      'Unidades',
      'Facturación',
    ]);
    expect(seen!.pages[1]).toEqual({ label: 'Flotas', href: '/fleets', sectionLabel: 'Operación' });
    expect(seen!.activeLabel).toBe('Flotas');
  });

  it('returns null outside AppShell', () => {
    let value: ShellNavigationValue | null | undefined;
    function Probe() {
      value = useShellNavigation();
      return null;
    }
    render(<Probe />);
    expect(value).toBeNull();
  });

  it('records the page and reports sidebar clicks through onNavigate', () => {
    const onNavigate = vi.fn();
    render(<AppbarShell onNavigate={onNavigate} />);
    expect(document.cookie).toContain(NAV_LAST_COOKIE);
    expect(document.cookie).toContain(NAV_RECENT_COOKIE);

    screen.getByRole('link', { name: 'Unidades' }).click();
    expect(onNavigate).toHaveBeenCalledWith({
      source: 'menu',
      fromSub: 'supply',
      toSub: 'supply',
      href: '/units',
    });
  });

  it('never lets a throwing onNavigate break a click', () => {
    render(
      <AppbarShell
        onNavigate={() => {
          throw new Error('tracking down');
        }}
      />,
    );
    expect(() => screen.getByRole('link', { name: 'Unidades' }).click()).not.toThrow();
  });

  it('remembers the menu page for recents on a detail page', () => {
    render(<AppbarShell currentPath="/fleets/123" />);
    const cookie = decodeURIComponent(document.cookie);
    expect(cookie).toContain('"supply":{"p":"/fleets/123"');
    expect(cookie).toContain('"p":"/fleets","l":"Flotas"');
    expect(cookie).not.toContain('"s":"supply","p":"/fleets/123"');
  });

  it('does not store a query or an ignored auth page', () => {
    const { rerender } = render(<AppbarShell currentPath="/fleets?code=secret" />);
    expect(decodeURIComponent(document.cookie)).not.toContain('secret');
    document.cookie = `${NAV_LAST_COOKIE}=; path=/; max-age=0`;
    rerender(<AppbarShell currentPath="/login" />);
    expect(document.cookie).not.toContain(NAV_LAST_COOKIE);
  });

  it('falls back to the header currentSub for visit memory when appSub is absent', () => {
    render(<AppbarShell appSub={undefined} header={{ currentSub: 'supply' }} />);
    expect(decodeURIComponent(document.cookie)).toContain('"supply":{"p":"/fleets"');
  });
});

describe('the app bar', () => {
  function bar() {
    return screen.getByRole('navigation', { name: 'Aplicaciones' });
  }

  it('lists the apps in the order of the work, without Comunidad', () => {
    render(<AppbarShell />);
    expect(within(bar()).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Inicio',
      'Comercial',
      'Solicitudes',
      'Supply',
      'LiveOps',
      'Finanzas',
      'FDS',
    ]);
  });

  it('marks the current app and links it to its start page', () => {
    render(<AppbarShell />);
    const current = within(bar()).getByRole('link', { name: 'Supply' });
    expect(current.getAttribute('aria-current')).toBe('page');
    // The current app routes in place through the host's link, to its start path.
    expect(current.getAttribute('href')).toBe('/');
    expect(within(bar()).getByRole('link', { name: 'LiveOps' }).getAttribute('aria-current')).toBeNull();
  });

  it('ignores a remembered path that is not a plain path', () => {
    seed({ liveops: '/\\evil.com' });
    render(<AppbarShell />);
    expect(within(bar()).getByRole('link', { name: 'LiveOps' }).getAttribute('href')).toBe(
      'https://liveops.partrunner.ai' + FROM,
    );
  });

  it('re-reads the memory when the tab becomes visible', () => {
    render(<AppbarShell />);
    seed({ liveops: '/late' });
    document.dispatchEvent(new Event('visibilitychange'));
    return waitFor(() =>
      expect(within(bar()).getByRole('link', { name: 'LiveOps' }).getAttribute('href')).toBe(
        'https://liveops.partrunner.ai/late' + FROM,
      ),
    );
  });

  it('links other apps to their start page when nothing is remembered', () => {
    render(<AppbarShell />);
    expect(within(bar()).getByRole('link', { name: 'LiveOps' }).getAttribute('href')).toBe(
      'https://liveops.partrunner.ai' + FROM,
    );
    expect(within(bar()).getByRole('link', { name: 'Inicio' }).getAttribute('href')).toBe(
      'https://nexus.partrunner.ai' + FROM,
    );
  });

  it('links other apps to the last page used there', () => {
    seed({ liveops: '/routes/week', supply: '/old', 'sube-tu-factura': '/admin/pagos' });
    render(<AppbarShell />);
    expect(within(bar()).getByRole('link', { name: 'LiveOps' }).getAttribute('href')).toBe(
      'https://liveops.partrunner.ai/routes/week' + FROM,
    );
    expect(within(bar()).getByRole('link', { name: 'Finanzas' }).getAttribute('href')).toBe(
      'https://partrunner.app/admin/pagos' + FROM,
    );
    // The current app always opens its start page.
    expect(within(bar()).getByRole('link', { name: 'Supply' }).getAttribute('href')).toBe('/');
  });

  it('shows Home in English and reports the click', () => {
    const onNavigate = vi.fn();
    document.addEventListener('click', (event) => event.preventDefault(), { once: true });
    render(
      <AppbarShell
        onNavigate={onNavigate}
        context={staffContext({ preferences: { locale: 'en', theme: 'system' } })}
      />,
    );
    const home = within(screen.getByRole('navigation', { name: 'Applications' })).getByRole('link', {
      name: 'Home',
    });
    home.click();
    expect(onNavigate).toHaveBeenCalledWith({
      source: 'appbar',
      fromSub: 'supply',
      toSub: 'nexus',
      href: `https://nexus.partrunner.ai${FROM}`,
    });
  });

  it('honours the apps prop with the same filter', () => {
    render(
      <AppbarShell
        header={{
          apps: [
            { label: 'Solo', sub: 'solo', description: '', icon: Boxes, tone: 'blue', comingSoon: true },
            { label: 'Hidden', sub: 'hidden', description: '', icon: Boxes, tone: 'blue', appBar: false },
          ],
        }}
      />,
    );
    expect(within(bar()).queryAllByRole('link')).toHaveLength(0);
  });

  it('is absent from a GlobalHeader outside AppShell', () => {
    const { container } = render(
      <StaffShellProvider value={staffContext()}>
        <GlobalHeader currentSub="supply" />
      </StaffShellProvider>,
    );
    expect(container.querySelector('.pr-appbar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Aplicaciones' })).toBeTruthy();
  });
});

describe('the app bar styles', () => {
  it('shows the bar through a container query on its own slot, not on the header', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const css = readFileSync(join(__dirname, '../styles/shell.css'), 'utf8');
    expect(css).toMatch(/\.pr-global-header__nav\s*\{[^}]*container-type:\s*inline-size/);
    expect(css).toMatch(/\.pr-global-header__nav\s*\{[^}]*flex:\s*1 1 0/);
    expect(css).not.toMatch(/\.pr-global-header\[data-navigation='appbar'\]\s*\{[^}]*container-type/);
    expect(css).toMatch(/@container \(min-width: 500px\)\s*\{[^@]*\.pr-appbar\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/\.pr-appbar\s*\{[^}]*display:\s*none/);
    // The launcher stays visible at every width in appbar mode.
    expect(css).not.toMatch(/data-navigation='appbar'\]\s*\.pr-launcher/);
  });

  it('renders the nav slot instead of the spacer in appbar mode only', () => {
    const { container, unmount } = render(<AppbarShell />);
    expect(container.querySelector('.pr-global-header__nav .pr-appbar')).toBeTruthy();
    expect(container.querySelector('.pr-global-header__spacer')).toBeNull();
    unmount();
    const launcher = render(
      <StaffShellProvider value={staffContext()}>
        <GlobalHeader currentSub="supply" />
      </StaffShellProvider>,
    );
    expect(launcher.container.querySelector('.pr-global-header__spacer')).toBeTruthy();
    expect(launcher.container.querySelector('.pr-global-header__nav')).toBeNull();
  });
});
