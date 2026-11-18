import type {
  StaffLocale,
  StaffNotification,
  StaffShellPreferences,
  StaffShellUser,
  StaffTheme,
} from './StaffShellContext';
import { isStaffBellSound, type StaffBellSound } from './bellSound';

export const STAFF_SHELL_SNAPSHOT_VERSION = 1 as const;

export interface StaffShellSnapshotPreferences
  extends StaffShellPreferences {
  /**
   * The apps marked as «Mis apps», in the person's order (at most 5).
   * Optional: an older producer omits it, and a malformed value reads as
   * absent. `parseStaffShellSnapshot` normalizes it.
   */
  favoriteApps?: readonly string[];
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
    /**
     * Unread notifications newer than this person's last bell open — what the
     * badge counts.
     *
     * Optional, and the snapshot version stays at 1 deliberately. Consumers
     * reject a version they do not know, so bumping it would break every
     * satellite the moment the producer deploys, including the ones still on
     * shell 1.x. A new field, by contrast, older consumers simply ignore.
     */
    unseenCount?: number;
    /**
     * Sonido de la campana. Opcional por la misma razón que `unseenCount`: un
     * consumidor viejo ignora la llave y su campana sigue muda.
     */
    sound?: StaffBellSound;
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
  // Absent is fine — a producer that predates the badge change. Present but
  // malformed is not: a bad number would be rendered straight into the badge.
  const unseenCount = value.notifications.unseenCount;
  if (
    unseenCount !== undefined &&
    !(Number.isInteger(unseenCount) && (unseenCount as number) >= 0)
  ) {
    return false;
  }
  const sound = value.notifications.sound;
  if (sound !== undefined && !isStaffBellSound(sound)) return false;
  return (
    Array.isArray(value.notifications.items) &&
    value.notifications.items.every(isNotification) &&
    Number.isInteger(value.notifications.unreadCount) &&
    (value.notifications.unreadCount as number) >= 0 &&
    isNonEmptyString(value.notifications.href)
  );
}

export const FAVORITE_APPS_MAX = 5;
const FAVORITE_SUB = /^[a-z0-9-]{1,40}$/;

/**
 * Keeps the valid subs of a favorite-apps value: well-formed, first occurrence
 * wins, at most 5, in order. Anything that is not an array reads as `undefined`.
 */
export function normalizeFavoriteApps(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= FAVORITE_APPS_MAX) break;
    if (typeof item !== 'string' || !FAVORITE_SUB.test(item) || out.includes(item)) continue;
    out.push(item);
  }
  return out;
}

export function parseStaffShellSnapshot(value: unknown): StaffShellSnapshot {
  if (!isStaffShellSnapshot(value)) {
    throw new TypeError('Invalid or unsupported staff shell snapshot');
  }
  // An older producer has no key: return the snapshot as it is.
  if (!('favoriteApps' in value.preferences)) return value;
  // A bad favorites value never rejects the snapshot: it reads as absent.
  const { favoriteApps: raw, ...preferences } = value.preferences;
  const favoriteApps = normalizeFavoriteApps(raw);
  return {
    ...value,
    preferences: favoriteApps === undefined ? preferences : { ...preferences, favoriteApps },
  };
}
