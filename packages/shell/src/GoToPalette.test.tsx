import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import { NAV_RECENT_COOKIE } from './navMemory';
import { AppbarShell, staffContext, useProductionRegistry } from './test/appbar-fixtures';

beforeEach(() => {
  useProductionRegistry();
  document.cookie = `${NAV_RECENT_COOKIE}=${encodeURIComponent(
    JSON.stringify([
      { s: 'sales', p: '/deals', l: 'Negocios' },
      { s: 'liveops', p: '/routes', l: 'Rutas' },
      { s: 'supply', p: '/units', l: 'Unidades' },
    ]),
  )}; path=/`;
  // jsdom cannot navigate to another origin; swallow the anchor click.
  document.addEventListener('click', swallow);
});
afterEach(() => {
  document.removeEventListener('click', swallow);
  configureAppRegistry({ hostPrefix: 'staging.', baseDomain: 'partrunner.ai' });
});

function swallow(event: Event) {
  event.preventDefault();
}

function optionLabels(): string[] {
  return screen.queryAllByRole('option').map((option) => option.textContent ?? '');
}

describe('«Ir a» palette', () => {
  it('opens from the header button and with Ctrl+K, and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<AppbarShell />);
    const trigger = screen.getByRole('button', { name: /Ir a…/ });
    expect(trigger.textContent).toMatch(/Ctrl K|⌘K/);
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(within(dialog).getByRole('combobox'));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.keyboard('{Meta>}k{/Meta}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on a click outside and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<AppbarShell />);
    const trigger = screen.getByRole('button', { name: /Ir a…/ });
    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('shows recent pages first, without the current page, with the app name', async () => {
    const user = userEvent.setup();
    render(<AppbarShell />);
    await user.click(screen.getByRole('button', { name: /Ir a…/ }));
    expect(screen.getByText('Recientes')).toBeTruthy();
    // The current page (Flotas, /fleets) is recorded by the shell and left out;
    // Unidades (supply) stays.
    expect(optionLabels()).toEqual(['NegociosComercial', 'RutasLiveOps', 'UnidadesSupply']);
  });

  it('says what to do when there is nothing recent', async () => {
    document.cookie = `${NAV_RECENT_COOKIE}=; path=/; max-age=0`;
    const user = userEvent.setup();
    render(<AppbarShell currentPath="/login" />);
    await user.click(screen.getByRole('button', { name: /Ir a…/ }));
    expect(screen.getByText('Escribe para buscar')).toBeTruthy();
  });

  it('searches without regard to accents or case, across pages, recents, and apps', async () => {
    const user = userEvent.setup();
    render(<AppbarShell />);
    await user.click(screen.getByRole('button', { name: /Ir a…/ }));
    const input = screen.getByRole('combobox');

    await user.type(input, 'FACTURACION');
    expect(optionLabels()).toEqual(['FacturaciónOperación · Supply']);

    await user.clear(input);
    await user.type(input, 'rutas');
    expect(optionLabels()).toEqual(['RutasLiveOps']);

    await user.clear(input);
    await user.type(input, 'abrir sup');
    expect(optionLabels()).toEqual(['Abrir Supply']);

    await user.clear(input);
    await user.type(input, 'zzzz');
    expect(screen.getByText('Sin resultados para “zzzz”')).toBeTruthy();
  });

  it('lists this app pages before recents and apps, de-duplicated and capped at 10', async () => {
    const user = userEvent.setup();
    render(<AppbarShell />);
    await user.click(screen.getByRole('button', { name: /Ir a…/ }));
    await user.type(screen.getByRole('combobox'), 'u');
    const labels = optionLabels();
    expect(labels.length).toBeLessThanOrEqual(10);
    // «Unidades» is both a page and a recent: it shows once, as a page.
    expect(labels.filter((label) => label.startsWith('Unidades'))).toHaveLength(1);
    expect(labels.indexOf('UnidadesOperación · Supply')).toBeLessThan(
      labels.findIndex((label) => label.startsWith('Abrir')),
    );
  });

  it('includes the host page index from the staff-shell context', async () => {
    const user = userEvent.setup();
    render(
      <AppbarShell
        context={staffContext({
          pages: [
            {
              app: 'sales',
              label: 'Cotizaciones',
              href: 'https://sales.partrunner.ai/quotes',
              section: 'Ventas',
            },
          ],
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Ir a…/ }));
    await user.type(screen.getByRole('combobox'), 'cotiz');
    const option = screen.getByRole('option');
    expect(option.textContent).toBe('CotizacionesVentas · Comercial');
    expect(within(option).getByRole('link').getAttribute('href')).toBe(
      'https://sales.partrunner.ai/quotes',
    );
  });

  it('moves with the arrow keys and wraps', async () => {
    const user = userEvent.setup();
    render(<AppbarShell />);
    await user.click(screen.getByRole('button', { name: /Ir a…/ }));
    const input = screen.getByRole('combobox');
    const options = () => screen.getAllByRole('option');
    const activeId = () => input.getAttribute('aria-activedescendant');

    expect(activeId()).toBe(options()[0]!.id);
    expect(options()[0]!.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowDown}');
    expect(activeId()).toBe(options()[1]!.id);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(activeId()).toBe(options()[options().length - 1]!.id);
  });

  it('opens the active row on Enter: another app by absolute URL', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<AppbarShell onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: /Ir a…/ }));
    expect(
      within(screen.getAllByRole('option')[0]!).getByRole('link').getAttribute('href'),
    ).toBe('https://sales.partrunner.ai/deals');
    await user.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith({
      source: 'goto',
      fromSub: 'supply',
      toSub: 'sales',
      href: 'https://sales.partrunner.ai/deals',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a page of this app through the host router link', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<AppbarShell onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: /Ir a…/ }));
    await user.type(screen.getByRole('combobox'), 'factur{Enter}');
    expect(onNavigate).toHaveBeenCalledWith({
      source: 'goto',
      fromSub: 'supply',
      toSub: 'supply',
      href: '/billing',
    });
  });

  it('does not listen for the shortcut in launcher mode', async () => {
    const user = userEvent.setup();
    render(<AppbarShell navigation="launcher" globalHeader={<div>plain</div>} />);
    await act(async () => {
      await user.keyboard('{Control>}k{/Control}');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('speaks English when the locale is en', async () => {
    const user = userEvent.setup();
    render(
      <AppbarShell context={staffContext({ preferences: { locale: 'en', theme: 'system' } })} />,
    );
    await user.click(screen.getByRole('button', { name: /Go to…/ }));
    expect(screen.getByText('Recent')).toBeTruthy();
    await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.getByText('No results for “zzzz”')).toBeTruthy();
  });
});
