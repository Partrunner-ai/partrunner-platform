import { describe, expect, it } from 'vitest';
import {
  isStaffShellSnapshot,
  parseStaffShellSnapshot,
  normalizeFavoriteApps,
  STAFF_SHELL_SNAPSHOT_VERSION,
} from './StaffShellSnapshot';

const snapshot = {
  version: 1,
  user: {
    id: 'staff-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
  },
  profileHref: 'https://nexus.partrunner.ai/perfil',
  preferences: {
    theme: 'system',
    locale: 'es',
    notifications: {
      inApp: true,
      email: false,
    },
  },
  notifications: {
    unreadCount: 1,
    href: 'https://nexus.partrunner.ai/notificaciones',
    items: [
      {
        id: 'notification-1',
        title: 'Solicitud asignada',
        sourceLabel: 'Requests',
        createdAt: '2026-07-24T12:00:00.000Z',
        readAt: null,
      },
    ],
  },
} as const;

describe('staff shell snapshot contract', () => {
  it('accepts the supported version', () => {
    expect(isStaffShellSnapshot(snapshot)).toBe(true);
    expect(parseStaffShellSnapshot(snapshot)).toBe(snapshot);
  });

  it('rejects unknown versions and configurable notification channels', () => {
    expect(isStaffShellSnapshot({ ...snapshot, version: 2 })).toBe(false);
    expect(
      isStaffShellSnapshot({
        ...snapshot,
        preferences: {
          ...snapshot.preferences,
          notifications: { inApp: false, email: true },
        },
      }),
    ).toBe(false);
  });

  it('throws at an invalid network boundary', () => {
    expect(() => parseStaffShellSnapshot({ version: 1 })).toThrow(
      'Invalid or unsupported staff shell snapshot',
    );
  });
});

describe('unseenCount', () => {
  it('accepts a snapshot without it', () => {
    // Un consumidor nuevo puede estar hablando con un productor viejo.
    expect(isStaffShellSnapshot(snapshot)).toBe(true);
  });

  it('accepts a well-formed count', () => {
    expect(
      isStaffShellSnapshot({
        ...snapshot,
        notifications: { ...snapshot.notifications, unseenCount: 0 },
      }),
    ).toBe(true);
  });

  it('rejects a malformed count instead of painting it', () => {
    for (const unseenCount of [-1, 1.5, '2', null]) {
      expect(
        isStaffShellSnapshot({
          ...snapshot,
          notifications: { ...snapshot.notifications, unseenCount },
        }),
      ).toBe(false);
    }
  });

  it('does not move the snapshot version', () => {
    // Subirla tumbaría a todo satélite que aún no actualiza el paquete.
    expect(STAFF_SHELL_SNAPSHOT_VERSION).toBe(1);
  });
});

describe('snapshot favorite apps', () => {
  const withFavorites = (favoriteApps: unknown) => ({
    ...snapshot,
    preferences: { ...snapshot.preferences, favoriteApps },
  });

  it('still parses an older snapshot without the key', () => {
    const parsed = parseStaffShellSnapshot(snapshot);
    expect(parsed.preferences.favoriteApps).toBeUndefined();
    expect('favoriteApps' in parsed.preferences).toBe(false);
  });

  it('keeps a valid list in order', () => {
    expect(parseStaffShellSnapshot(withFavorites(['liveops', 'supply'])).preferences.favoriteApps).toEqual([
      'liveops',
      'supply',
    ]);
  });

  it('keeps only strings that match the sub pattern', () => {
    expect(
      normalizeFavoriteApps(['ok-1', 'Bad', '', 'a_b', 'x'.repeat(41), 5, null, 'x'.repeat(40)]),
    ).toEqual(['ok-1', 'x'.repeat(40)]);
  });

  it('drops duplicates, first one wins', () => {
    expect(normalizeFavoriteApps(['b', 'a', 'b', 'c', 'a'])).toEqual(['b', 'a', 'c']);
  });

  it('keeps at most 5, counting only valid entries', () => {
    expect(normalizeFavoriteApps(['!', 'a', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('reads a missing or non-array value as undefined, never rejecting the snapshot', () => {
    for (const bad of [undefined, null, 'liveops', 3, { 0: 'a' }]) {
      const value = withFavorites(bad);
      expect(isStaffShellSnapshot(value)).toBe(true);
      expect(parseStaffShellSnapshot(value).preferences.favoriteApps).toBeUndefined();
    }
  });
});
