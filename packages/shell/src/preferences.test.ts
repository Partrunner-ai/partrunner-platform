import { describe, expect, it } from 'vitest';
import {
  appShellFavoritesKey,
  appShellGroupsKey,
  decodeAppShellFavorites,
  decodeAppShellGroups,
  encodeAppShellFavorites,
  encodeAppShellGroups,
  parseAppShellState,
  readAppShellInitialState,
} from './sidebarPreferences';

describe('AppShell cookie state', () => {
  it('parses the collapsed rail and versioned groups on the server', () => {
    const groups = encodeAppShellGroups({ rutas: true, admin: false });
    const state = parseAppShellState(
      `other=private; pr-sidebar-collapsed=1; ${appShellGroupsKey('pr-sidebar-collapsed')}=${groups}`,
    );

    expect(state).toEqual({ collapsed: true, groups: { rutas: true, admin: false } });
  });

  it('accepts the legacy localStorage record and drops non-boolean fields', () => {
    expect(decodeAppShellGroups('{"rutas":true,"label":"Rutas"}')).toEqual({ rutas: true });
  });

  it('fails closed on malformed preferences', () => {
    expect(parseAppShellState('pr-sidebar-collapsed=0; pr-sidebar-collapsed:groups=%')).toEqual({
      collapsed: false,
      groups: {},
    });
  });
});

describe('«Mis apps» cookie codec', () => {
  it('round-trips the subs in order and stays small', () => {
    const encoded = encodeAppShellFavorites(['liveops', 'nexus', 'supply']);
    expect(encoded).toBe('liveops.nexus.supply');
    expect(decodeAppShellFavorites(encoded)).toEqual(['liveops', 'nexus', 'supply']);
    const longest = Array.from({ length: 5 }, (_, index) => `${'a'.repeat(39)}${index}`);
    const cookie = `${appShellFavoritesKey('pr-sidebar-collapsed')}=${encodeAppShellFavorites(longest)}`;
    expect(cookie.length).toBeLessThan(300);
  });

  it('tells an empty list from a missing cookie', () => {
    expect(encodeAppShellFavorites([])).toBe('-');
    expect(decodeAppShellFavorites('-')).toEqual([]);
    expect(decodeAppShellFavorites(undefined)).toBeUndefined();
    expect(decodeAppShellFavorites('')).toBeUndefined();
  });

  it('drops bad subs, duplicates and everything past five', () => {
    expect(decodeAppShellFavorites('a.B.a.c d.b.c.d.e.f.g')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(encodeAppShellFavorites(['x', 'x', 'Bad', 'y'])).toBe('x.y');
  });

  it('adds favoriteApps to the parsed state only when the cookie has them', () => {
    const key = appShellFavoritesKey('pr-sidebar-collapsed');
    expect(parseAppShellState(`${key}=liveops.fds`).favoriteApps).toEqual(['liveops', 'fds']);
    expect(parseAppShellState(`${key}=-`).favoriteApps).toEqual([]);
    expect(parseAppShellState('pr-sidebar-collapsed=1')).not.toHaveProperty('favoriteApps');
  });

  it('keeps the old cookie and a custom storage key working', () => {
    expect(parseAppShellState('my-bar=1; my-bar:favs=nexus', 'my-bar')).toEqual({
      collapsed: true,
      groups: {},
      favoriteApps: ['nexus'],
    });
  });
});

describe('readAppShellInitialState (server helper)', () => {
  const header = 'a=1; pr-sidebar-collapsed=1; pr-sidebar-collapsed:favs=liveops.nexus';

  it('reads a raw Cookie header', () => {
    expect(readAppShellInitialState(header)).toEqual({
      collapsed: true,
      groups: {},
      favoriteApps: ['liveops', 'nexus'],
    });
  });

  it('reads a Next.js cookie store and ignores other cookies', () => {
    const jar = new Map([
      ['pr-sidebar-collapsed', { value: '0' }],
      ['pr-sidebar-collapsed:favs', { value: 'fds' }],
      ['session', { value: 'secret' }],
    ]);
    expect(readAppShellInitialState({ get: (name) => jar.get(name) })).toEqual({
      collapsed: false,
      groups: {},
      favoriteApps: ['fds'],
    });
  });

  it('reads groups the same from a header and from a decoded cookie store', () => {
    const groups = encodeAppShellGroups({ 'a%b': true });
    const fromHeader = readAppShellInitialState(`pr-sidebar-collapsed:groups=${groups}`);
    const fromStore = readAppShellInitialState({
      get: (name) =>
        name === 'pr-sidebar-collapsed:groups' ? { value: decodeURIComponent(groups) } : undefined,
    });
    expect(fromHeader.groups).toEqual({ 'a%b': true });
    expect(fromStore.groups).toEqual({ 'a%b': true });
  });

  it('reads a missing source as an empty cookie', () => {
    expect(readAppShellInitialState(null)).toEqual({ collapsed: false, groups: {} });
    expect(readAppShellInitialState(undefined)).toEqual({ collapsed: false, groups: {} });
  });
});
