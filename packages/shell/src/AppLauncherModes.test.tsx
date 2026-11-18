import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import { AppShell } from './AppShell';
import { GlobalHeader } from './GlobalHeader';
import { NAV_LAST_COOKIE } from './navMemory';
import { StaffShellProvider } from './StaffShellContext';
import { UnifiedShell, SECTIONS, staffContext, useProductionRegistry } from './test/unified-fixtures';

const FROM = '#pr-from=supply:%2Ffleets';

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

async function openGrid() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Aplicaciones' }));
  return { user, menu: screen.getByRole('menu') };
}
function tile(menu: HTMLElement, name: RegExp) {
  return within(menu).getByRole('menuitem', { name });
}

describe('the apps grid in unified mode', () => {
  it('is in the unified header, before the divider and the avatar, with every app', async () => {
    const { container } = render(<UnifiedShell />);
    const header = container.querySelector('.pr-global-header')!;
    const launcher = header.querySelector('.pr-launcher')!;
    const divider = header.querySelector('.pr-global-header__divider')!;
    expect(launcher.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const { menu } = await openGrid();
    // Comunidad is in the grid, as in launcher mode.
    expect(tile(menu, /Comunidad/)).toBeTruthy();
    expect(tile(menu, /LiveOps/)).toBeTruthy();
  });

  it('opens the start page of an app with no memory, with the way back', async () => {
    render(<UnifiedShell />);
    const { menu } = await openGrid();
    expect(tile(menu, /LiveOps/).getAttribute('href')).toBe(`https://liveops.partrunner.ai${FROM}`);
  });

  it('opens the last page used in the app, validated, with the way back', async () => {
    document.cookie = `${NAV_LAST_COOKIE}=${encodeURIComponent(
      JSON.stringify({ liveops: { p: '/general/routes', l: 'Todas las rutas' }, sales: '//evil.com' }),
    )}; path=/`;
    render(<UnifiedShell />);
    const { menu } = await openGrid();
    expect(tile(menu, /LiveOps/).getAttribute('href')).toBe(
      `https://liveops.partrunner.ai/general/routes${FROM}`,
    );
    // An invalid stored path falls back to the start page.
    expect(tile(menu, /Comercial/).getAttribute('href')).toBe(`https://sales.partrunner.ai${FROM}`);
  });

  it('adds the fragment only to registry origins', async () => {
    render(
      <UnifiedShell
       
        header={{
          apps: [
            {
              label: 'Otra',
              sub: 'otra',
              absoluteUrl: 'https://example.com/x',
              description: 'Otra',
              icon: () => null,
              tone: 'blue',
            } as never,
            {
              label: 'LiveOps',
              sub: 'liveops',
              description: 'LiveOps',
              icon: () => null,
              tone: 'blue',
            } as never,
          ],
        }}
      />,
    );
    const { menu } = await openGrid();
    expect(tile(menu, /Otra/).getAttribute('href')).toBe('https://example.com/x');
    expect(tile(menu, /LiveOps/).getAttribute('href')).toContain('#pr-from=');
  });

  it("reports the 'launcher' source", async () => {
    const onNavigate = vi.fn();
    render(<UnifiedShell onNavigate={onNavigate} />);
    const { user, menu } = await openGrid();
    await user.click(tile(menu, /LiveOps/));
    expect(onNavigate).toHaveBeenCalledWith({
      source: 'launcher',
      fromSub: 'supply',
      toSub: 'liveops',
      href: `https://liveops.partrunner.ai${FROM}`,
    });
  });

  it('leaves launcher mode as it was: start pages, no fragment, no event', async () => {
    document.cookie = `${NAV_LAST_COOKIE}=${encodeURIComponent(
      JSON.stringify({ liveops: { p: '/general/routes' } }),
    )}; path=/`;
    const onNavigate = vi.fn();
    render(
      <StaffShellProvider value={staffContext()}>
        <AppShell
          sections={SECTIONS}
          currentPath="/fleets"
          appSub="supply"
          onNavigate={onNavigate}
          globalHeader={<GlobalHeader currentSub="supply" />}
        >
          x
        </AppShell>
      </StaffShellProvider>,
    );
    const { user, menu } = await openGrid();
    expect(tile(menu, /LiveOps/).getAttribute('href')).toBe('https://liveops.partrunner.ai');
    await user.click(tile(menu, /LiveOps/));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
