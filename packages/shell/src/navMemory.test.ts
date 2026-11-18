import { afterEach, describe, expect, it } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import {
  EMPTY_NAV_MEMORY,
  isIgnoredNavPath,
  isStorableNavPath,
  navMemoryCookieNames,
  parseNavLast,
  parseNavRecent,
  readNavMemory,
  recordNavVisit,
  rememberNavVisit,
  serializeNavLast,
  serializeNavRecent,
} from './navMemory';

const enc = (value: unknown) => encodeURIComponent(JSON.stringify(value));

describe('navMemory parsing', () => {
  it('reads empty for missing, malformed, oversized, or foreign values', () => {
    expect(parseNavLast(undefined)).toEqual({});
    expect(parseNavLast('%E0%A4%A')).toEqual({});
    expect(parseNavLast('not-json')).toEqual({});
    expect(parseNavLast(enc([1, 2]))).toEqual({});
    expect(parseNavLast('x'.repeat(20000))).toEqual({});
    expect(parseNavRecent(enc({ s: 'supply' }))).toEqual([]);
    expect(parseNavRecent('x'.repeat(20000))).toEqual([]);
  });

  it('keeps only well-formed paths, never a query, a hash, or a protocol-relative url', () => {
    expect(
      parseNavLast(
        enc({
          supply: '/fleets',
          sales: '/deals?code=secret',
          liveops: '//evil.example/x',
          fds: 'no-slash',
          nexus: `/${'a'.repeat(200)}`,
        }),
      ),
    ).toEqual({ supply: '/fleets' });
  });

  it('rejects a backslash, control characters, and anything that leaves the origin', () => {
    for (const path of ['/\\evil.com', '/\\\\evil.com', '/a\tb', '/a\nb', '/a\u0000b', '/a\u007fb']) {
      expect(parseNavLast(enc({ supply: path })), JSON.stringify(path)).toEqual({});
      expect(isStorableNavPath(path), JSON.stringify(path)).toBe(false);
    }
    // Encoded characters are fine: they cannot change the host.
    expect(isStorableNavPath('/%09/evil.com')).toBe(true);
    expect(isStorableNavPath('/%5Cevil.com')).toBe(true);
  });

  it('drops bad, oversized, and duplicated recent entries and caps the list at 8', () => {
    const entries = [
      { s: 'supply', p: '/a', l: 'A' },
      { s: 'supply', p: '/a', l: 'A again' },
      { s: 'supply', p: '/b', l: 'x'.repeat(61) },
      { s: 'supply', p: '/c?x=1', l: 'C' },
      { s: 5, p: '/d', l: 'D' },
      ...Array.from({ length: 12 }, (_, i) => ({ s: 'sales', p: `/p${i}`, l: `P${i}` })),
    ];
    const parsed = parseNavRecent(enc(entries));
    expect(parsed).toHaveLength(8);
    expect(parsed[0]).toEqual({ s: 'supply', p: '/a', l: 'A' });
    expect(parsed.filter((entry) => entry.p === '/a')).toHaveLength(1);
  });

  it('round-trips through serialize and parse', () => {
    const last = { supply: '/fleets', sales: '/deals' };
    const recent = [{ s: 'supply', p: '/fleets', l: 'Flotas' }];
    expect(parseNavLast(serializeNavLast(last))).toEqual(last);
    expect(parseNavRecent(serializeNavRecent(recent))).toEqual(recent);
  });

  it('refuses to serialize a value that would not fit in a cookie', () => {
    const last = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`app${i}`, `/${'é'.repeat(100)}`]),
    );
    expect(serializeNavLast(last)).toBeNull();
  });
});

describe('cookie size', () => {
  it('drops the oldest recent entries until the value fits in 1500 characters', () => {
    const recent = Array.from({ length: 8 }, (_, i) => ({
      s: 'supply',
      p: `/${'é'.repeat(50)}${i}`,
      l: `Página ${i}`,
    }));
    const encoded = serializeNavRecent(recent);
    expect(encoded.length).toBeLessThanOrEqual(1500);
    const kept = parseNavRecent(encoded);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(8);
    // The newest entries stay.
    expect(kept[0]).toEqual(recent[0]);
  });

  it('keeps all entries when they fit', () => {
    const recent = [{ s: 'supply', p: '/a', l: 'A' }];
    expect(parseNavRecent(serializeNavRecent(recent))).toEqual(recent);
  });

  it('skips the last-page cookie above 2000 characters', () => {
    const last = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`app${i}`, `/${'é'.repeat(60)}`]),
    );
    expect(serializeNavLast(last)).toBeNull();
    expect(serializeNavLast({ supply: '/fleets' })).not.toBeNull();
  });

  it('keeps updating last when full: the visited app is newest and the oldest others go', () => {
    const long = `/${'é'.repeat(60)}`;
    let memory = EMPTY_NAV_MEMORY;
    for (let i = 0; i < 8; i += 1) {
      memory = recordNavVisit(memory, { sub: `app${i}`, path: `${long}${i}` });
    }
    expect(serializeNavLast(memory.last)).not.toBeNull();
    expect(Object.keys(memory.last).length).toBeLessThan(8);
    expect(memory.last.app7).toBe(`${long}7`);
    expect(memory.last.app0).toBeUndefined();

    // Visiting an old app again moves it to the end and keeps it.
    memory = recordNavVisit(memory, { sub: 'app5', path: '/again' });
    expect(Object.keys(memory.last).at(-1)).toBe('app5');
    expect(memory.last.app5).toBe('/again');
  });

  it('refuses a path over 160 characters', () => {
    expect(parseNavLast(enc({ supply: `/${'a'.repeat(160)}` }))).toEqual({});
    expect(parseNavLast(enc({ supply: `/${'a'.repeat(159)}` }))).not.toEqual({});
  });
});

describe('isIgnoredNavPath', () => {
  it('ignores auth pages and their children', () => {
    for (const path of [
      '/login',
      '/logout',
      '/auth',
      '/auth/callback',
      '/sso',
      '/sso/return',
      '/sso-exchange',
      '/unauthorized',
      '/solicitar-acceso',
      '/login/otp',
    ]) {
      expect(isIgnoredNavPath(path), path).toBe(true);
    }
  });

  it('keeps ordinary pages and honours the host list', () => {
    expect(isIgnoredNavPath('/loginfo')).toBe(false);
    expect(isIgnoredNavPath('/fleets')).toBe(false);
    expect(isIgnoredNavPath('/print/7', ['/print/*'])).toBe(true);
  });
});

describe('recordNavVisit', () => {
  it('moves last always and recent only with a label', () => {
    const first = recordNavVisit(EMPTY_NAV_MEMORY, { sub: 'supply', path: '/fleets/9' });
    expect(first.last).toEqual({ supply: '/fleets/9' });
    expect(first.recent).toEqual([]);

    const second = recordNavVisit(first, { sub: 'supply', path: '/fleets', label: 'Flotas' });
    expect(second.last.supply).toBe('/fleets');
    expect(second.recent).toEqual([{ s: 'supply', p: '/fleets', l: 'Flotas' }]);
  });

  it('puts the newest first, de-duplicates on app and path, and caps at 8', () => {
    let memory = EMPTY_NAV_MEMORY;
    for (let i = 0; i < 10; i += 1) {
      memory = recordNavVisit(memory, { sub: 'sales', path: `/p${i}`, label: `P${i}` });
    }
    memory = recordNavVisit(memory, { sub: 'sales', path: '/p5', label: 'P5' });
    expect(memory.recent).toHaveLength(8);
    expect(memory.recent[0]!.p).toBe('/p5');
    expect(memory.recent.filter((entry) => entry.p === '/p5')).toHaveLength(1);
  });

  it('keeps the menu page in recents and the exact path in last', () => {
    const memory = recordNavVisit(EMPTY_NAV_MEMORY, {
      sub: 'liveops',
      path: '/rutas/123?tab=1',
      label: 'Rutas',
      labelPath: '/rutas',
    });
    expect(memory.last.liveops).toBe('/rutas/123');
    expect(memory.recent).toEqual([{ s: 'liveops', p: '/rutas', l: 'Rutas' }]);
  });

  it('collapses two detail pages of one menu item into one recent entry', () => {
    let memory = recordNavVisit(EMPTY_NAV_MEMORY, {
      sub: 'liveops',
      path: '/rutas/1',
      label: 'Rutas',
      labelPath: '/rutas',
    });
    memory = recordNavVisit(memory, {
      sub: 'liveops',
      path: '/rutas/2',
      label: 'Rutas',
      labelPath: '/rutas',
    });
    expect(memory.recent).toEqual([{ s: 'liveops', p: '/rutas', l: 'Rutas' }]);
    expect(memory.last.liveops).toBe('/rutas/2');
  });

  it('stores the pathname only', () => {
    const memory = recordNavVisit(EMPTY_NAV_MEMORY, {
      sub: 'supply',
      path: '/fleets?code=abc#frag',
      label: 'Flotas',
    });
    expect(memory.last.supply).toBe('/fleets');
    expect(JSON.stringify(memory)).not.toContain('abc');
  });

  it('skips ignored paths and values over the limits', () => {
    expect(recordNavVisit(EMPTY_NAV_MEMORY, { sub: 'supply', path: '/login', label: 'x' })).toBe(
      EMPTY_NAV_MEMORY,
    );
    expect(
      recordNavVisit(EMPTY_NAV_MEMORY, { sub: 'supply', path: `/${'a'.repeat(200)}`, label: 'x' }),
    ).toBe(EMPTY_NAV_MEMORY);
    const longLabel = recordNavVisit(EMPTY_NAV_MEMORY, {
      sub: 'supply',
      path: '/ok',
      label: 'x'.repeat(61),
    });
    expect(longLabel.last.supply).toBe('/ok');
    expect(longLabel.recent).toEqual([]);
  });
});

describe('cookie I/O', () => {
  it('writes both cookies and reads them back', () => {
    rememberNavVisit({ sub: 'supply', path: '/fleets', label: 'Flotas' });
    const names = navMemoryCookieNames();
    expect(document.cookie).toContain(`${names.last}=`);
    expect(document.cookie).toContain(`${names.recent}=`);
    expect(readNavMemory()).toEqual({
      last: { supply: '/fleets' },
      recent: [{ s: 'supply', p: '/fleets', l: 'Flotas' }],
    });
  });

  it('adds Secure on https', () => {
    // The test page is https, so the written cookie carries Secure and jsdom keeps it.
    rememberNavVisit({ sub: 'supply', path: '/fleets', label: 'Flotas' });
    expect(readNavMemory().last.supply).toBe('/fleets');
  });

  it('reads an empty memory when there is no cookie string', () => {
    expect(readNavMemory('')).toBe(EMPTY_NAV_MEMORY);
    expect(readNavMemory('a=1; b=2')).toEqual(EMPTY_NAV_MEMORY);
  });
});

describe('cookie names by environment', () => {
  afterEach(() => {
    configureAppRegistry({ hostPrefix: 'staging.', baseDomain: 'partrunner.ai' });
  });

  it('uses the base names in production', () => {
    configureAppRegistry({ hostPrefix: '' });
    expect(navMemoryCookieNames()).toEqual({ last: 'pr-nav-last', recent: 'pr-nav-recent' });
  });

  it('adds the host prefix, cleaned, outside production', () => {
    configureAppRegistry({ hostPrefix: 'staging.' });
    expect(navMemoryCookieNames()).toEqual({
      last: 'pr-nav-last-staging',
      recent: 'pr-nav-recent-staging',
    });
    configureAppRegistry({ hostPrefix: 'Pr-12.Preview_x.' });
    expect(navMemoryCookieNames().last).toBe('pr-nav-last-pr-12previewx');
  });

  it('follows a later configureAppRegistry call and keeps environments apart', () => {
    configureAppRegistry({ hostPrefix: '' });
    rememberNavVisit({ sub: 'supply', path: '/prod-page', label: 'Prod' });
    configureAppRegistry({ hostPrefix: 'staging.' });
    expect(readNavMemory()).toEqual(EMPTY_NAV_MEMORY);
    rememberNavVisit({ sub: 'supply', path: '/stg-page', label: 'Stg' });
    expect(readNavMemory().last.supply).toBe('/stg-page');
    configureAppRegistry({ hostPrefix: '' });
    expect(readNavMemory().last.supply).toBe('/prod-page');
  });
});
