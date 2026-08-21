import { afterEach, describe, expect, it } from 'vitest';
import { APPS, appHref, findApp, type AppLink } from './apps';
import { configureAppRegistry } from './url';

const PROD = { hostPrefix: '', baseDomain: 'partrunner.ai' };
const STAGING = { hostPrefix: 'staging.', baseDomain: 'partrunner.ai' };

function app(overrides: Partial<AppLink> = {}): AppLink {
  const base = findApp('supply')!;
  return { ...base, ...overrides };
}

afterEach(() => {
  configureAppRegistry(STAGING);
});

describe('appHref', () => {
  it('derives subdomain apps from the configured environment', () => {
    configureAppRegistry(PROD);
    expect(appHref(app({ sub: 'supply' }))).toBe('https://supply.partrunner.ai');

    configureAppRegistry(STAGING);
    expect(appHref(app({ sub: 'supply' }))).toBe('https://staging.supply.partrunner.ai');
  });

  it('derives path-scheme apps on their own base domain', () => {
    configureAppRegistry(PROD);
    const finanzas = findApp('sube-tu-factura')!;
    expect(appHref(finanzas)).toBe('https://partrunner.app/admin/finanzas/dashboard');
  });

  it('returns null for coming-soon apps', () => {
    expect(appHref(app({ comingSoon: true }))).toBeNull();
  });

  describe('absoluteUrl', () => {
    it('is used verbatim, ignoring scheme, sub, baseDomain and path', () => {
      const href = appHref(
        app({
          absoluteUrl: 'https://community.example.com',
          sub: 'comunidad',
          scheme: 'path',
          baseDomain: 'partrunner.app',
          path: '/ignored',
          comingSoon: false,
        }),
      );
      expect(href).toBe('https://community.example.com');
    });

    it('does not change between environments', () => {
      const comunidad = app({ absoluteUrl: 'https://community.example.com', comingSoon: false });

      configureAppRegistry(PROD);
      const prod = appHref(comunidad);
      configureAppRegistry(STAGING);
      const staging = appHref(comunidad);

      // The app has a single deployment, so a staging launcher linking to
      // production is the only meaningful behavior.
      expect(staging).toBe(prod);
    });

    it('loses to comingSoon', () => {
      expect(
        appHref(app({ absoluteUrl: 'https://community.example.com', comingSoon: true })),
      ).toBeNull();
    });
  });
});

describe('the registry as a whole', () => {
  it('routes FDS to its only deployed hostname in every environment', () => {
    const fds = findApp('fds')!;

    configureAppRegistry(PROD);
    expect(appHref(fds)).toBe('https://fds.partrunner.ai');

    configureAppRegistry(STAGING);
    expect(appHref(fds)).toBe('https://fds.partrunner.ai');
  });

  it('contains only current fleet applications', () => {
    expect(APPS.map((entry) => entry.label)).toEqual([
      'Home',
      'Supply',
      'LiveOps',
      'Solicitudes',
      'Comercial',
      'Finanzas',
      'FDS',
    ]);
    expect(APPS.every((entry) => !entry.comingSoon)).toBe(true);
  });

  it('keeps route details and prototype metrics out of the fleet catalog', () => {
    expect(APPS.every((entry) => entry.kpis === undefined)).toBe(true);
    expect(APPS.map((entry) => entry.description).join(' ')).not.toMatch(
      /drivers|flotillas|rutas|despacho|pricing|aclaraciones/i,
    );
  });

  it('gives every app a resolvable href unless it is coming soon', () => {
    configureAppRegistry(PROD);
    for (const entry of APPS) {
      const href = appHref(entry);
      if (entry.comingSoon) {
        expect(href, entry.label).toBeNull();
        continue;
      }
      expect(href, entry.label).toMatch(/^https:\/\//);
      expect(() => new URL(href!), entry.label).not.toThrow();
      // A prod launcher must never link at staging — the bug the registry exists
      // to prevent.
      expect(href, entry.label).not.toContain('staging.');
    }
  });
});
