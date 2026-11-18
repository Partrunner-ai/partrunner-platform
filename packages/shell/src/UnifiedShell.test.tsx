import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import { AppShell } from './AppShell';
import { GlobalHeader } from './GlobalHeader';
import { useShellNavigation, type ShellNavigationValue } from './NavigationContext';
import { NAV_LAST_COOKIE, NAV_RECENT_COOKIE } from './navMemory';
import { StaffShellProvider } from './StaffShellContext';
import { UnifiedShell, SECTIONS, staffContext, useProductionRegistry } from './test/unified-fixtures';

beforeEach(() => {
  useProductionRegistry();
});
afterEach(() => {
  configureAppRegistry({ hostPrefix: 'staging.', baseDomain: 'partrunner.ai' });
});

describe('AppShell navigation="unified"', () => {
  it('opens the start page of the current app from the brand', () => {
    const { container } = render(<UnifiedShell nexusHref="https://nexus.partrunner.ai" />);
    const brand = container.querySelector('a.pr-sidebar__brand')!;
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.getAttribute('data-canonical-brand')).toBe('true');
  });

  it('lets an explicit brandHref win', () => {
    const { container } = render(<UnifiedShell brandHref="/admin/dashboard" />);
    expect(container.querySelector('a.pr-sidebar__brand')!.getAttribute('href')).toBe(
      '/admin/dashboard',
    );
  });

  it('does not default onBrandSelect to onNexusSelect, but honours an explicit one', async () => {
    const onNexusSelect = vi.fn();
    const onBrandSelect = vi.fn();
    const { container, rerender } = render(
      <UnifiedShell nexusHref="https://nexus.partrunner.ai" onNexusSelect={onNexusSelect} />,
    );
    container.querySelector<HTMLElement>('a.pr-sidebar__brand')!.click();
    expect(onNexusSelect).not.toHaveBeenCalled();

    rerender(<UnifiedShell onBrandSelect={onBrandSelect} />);
    container.querySelector<HTMLElement>('a.pr-sidebar__brand')!.click();
    expect(onBrandSelect).toHaveBeenCalledTimes(1);
  });

  it('drops the pinned Nexus item', () => {
    render(<UnifiedShell nexusHref="https://nexus.partrunner.ai" />);
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
      <UnifiedShell can={(permission) => permission !== 'secret.view'}>
        <Probe />
      </UnifiedShell>,
    );
    expect(seen!.mode).toBe('unified');
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
    render(<UnifiedShell onNavigate={onNavigate} />);
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
      <UnifiedShell
        onNavigate={() => {
          throw new Error('tracking down');
        }}
      />,
    );
    expect(() => screen.getByRole('link', { name: 'Unidades' }).click()).not.toThrow();
  });

  it('remembers the menu page for recents on a detail page', () => {
    render(<UnifiedShell currentPath="/fleets/123" />);
    const cookie = decodeURIComponent(document.cookie);
    expect(cookie).toContain('"supply":{"p":"/fleets/123"');
    expect(cookie).toContain('"p":"/fleets","l":"Flotas"');
    expect(cookie).not.toContain('"s":"supply","p":"/fleets/123"');
  });

  it('does not store a query or an ignored auth page', () => {
    const { rerender } = render(<UnifiedShell currentPath="/fleets?code=secret" />);
    expect(decodeURIComponent(document.cookie)).not.toContain('secret');
    document.cookie = `${NAV_LAST_COOKIE}=; path=/; max-age=0`;
    rerender(<UnifiedShell currentPath="/login" />);
    expect(document.cookie).not.toContain(NAV_LAST_COOKIE);
  });

  it('falls back to the header currentSub for visit memory when appSub is absent', () => {
    render(<UnifiedShell appSub={undefined} header={{ currentSub: 'supply' }} />);
    expect(decodeURIComponent(document.cookie)).toContain('"supply":{"p":"/fleets"');
  });
});
