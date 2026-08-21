import type {
  StaffLocale,
  StaffNotification,
  StaffShellPreferences,
  StaffShellUser,
  StaffTheme,
} from './StaffShellContext';

export const STAFF_SHELL_SNAPSHOT_VERSION = 1 as const;

export interface StaffShellSnapshotPreferences
  extends StaffShellPreferences {
  notifications: {
    inApp: true;
    email: false;
  };
}

export interface StaffShellSnapshotUser extends StaffShellUser {
  email: string;
}

export interface StaffShellSnapshotNotification extends StaffNotification {
  sourceLabel: string;
  readAt: string | null;
}

export interface StaffShellSnapshotV1 {
  version: typeof STAFF_SHELL_SNAPSHOT_VERSION;
  user: StaffShellSnapshotUser;
  profileHref: string;
  preferences: StaffShellSnapshotPreferences;
  notifications: {
    items: readonly StaffShellSnapshotNotification[];
    unreadCount: number;
    href: string;
  };
}

export type StaffShellSnapshot = StaffShellSnapshotV1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isTheme(value: unknown): value is StaffTheme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isLocale(value: unknown): value is StaffLocale {
  return value === 'es' || value === 'en';
}

function isUser(value: unknown): value is StaffShellSnapshotUser {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.email) &&
    isOptionalString(value.avatarUrl)
  );
}

function isNotification(
  value: unknown,
): value is StaffShellSnapshotNotification {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isOptionalString(value.body) &&
    isNonEmptyString(value.sourceLabel) &&
    isOptionalString(value.href) &&
    isNonEmptyString(value.createdAt) &&
    isOptionalString(value.timeLabel) &&
    (value.readAt === null || typeof value.readAt === 'string')
  );
}

/**
 * Runtime boundary for data returned by the canonical staff-shell endpoint.
 * Consumers should reject unknown versions instead of guessing compatibility.
 */
export function isStaffShellSnapshot(
  value: unknown,
): value is StaffShellSnapshot {
  if (!isRecord(value) || value.version !== STAFF_SHELL_SNAPSHOT_VERSION) {
    return false;
  }
  if (!isUser(value.user) || !isNonEmptyString(value.profileHref)) {
    return false;
  }
  if (!isRecord(value.preferences)) return false;
  if (
    !isTheme(value.preferences.theme) ||
    !isLocale(value.preferences.locale) ||
    !isRecord(value.preferences.notifications) ||
    value.preferences.notifications.inApp !== true ||
    value.preferences.notifications.email !== false
  ) {
    return false;
  }
  if (!isRecord(value.notifications)) return false;
  return (
    Array.isArray(value.notifications.items) &&
    value.notifications.items.every(isNotification) &&
    Number.isInteger(value.notifications.unreadCount) &&
    (value.notifications.unreadCount as number) >= 0 &&
    isNonEmptyString(value.notifications.href)
  );
}

export function parseStaffShellSnapshot(value: unknown): StaffShellSnapshot {
  if (!isStaffShellSnapshot(value)) {
    throw new TypeError('Invalid or unsupported staff shell snapshot');
  }
  return value;
}
