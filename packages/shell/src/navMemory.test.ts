import { describe, expect, it } from 'vitest';
import {
  EMPTY_NAV_MEMORY,
  NAV_LAST_COOKIE,
  NAV_RECENT_COOKIE,
  isIgnoredNavPath,
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
    expect(document.cookie).toContain(`${NAV_LAST_COOKIE}=`);
    expect(document.cookie).toContain(`${NAV_RECENT_COOKIE}=`);
    expect(readNavMemory()).toEqual({
      last: { supply: '/fleets' },
      recent: [{ s: 'supply', p: '/fleets', l: 'Flotas' }],
    });
  });

  it('reads an empty memory when there is no cookie string', () => {
    expect(readNavMemory('')).toBe(EMPTY_NAV_MEMORY);
    expect(readNavMemory('a=1; b=2')).toEqual(EMPTY_NAV_MEMORY);
  });
});
