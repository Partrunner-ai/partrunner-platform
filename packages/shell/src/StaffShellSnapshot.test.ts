import { describe, expect, it } from 'vitest';
import {
  isStaffShellSnapshot,
  parseStaffShellSnapshot,
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
