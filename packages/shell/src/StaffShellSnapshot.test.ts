import { describe, expect, it } from 'vitest';
import {
  isStaffShellSnapshot,
  parseStaffShellSnapshot,
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
