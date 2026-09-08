import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

export type StaffTheme = 'light' | 'dark' | 'system';
export type StaffLocale = 'es' | 'en';
/**
 * Mutations are intentionally fire-and-forget at this seam. Host adapters must
 * update optimistically or use navigation-safe transport (`keepalive`/beacon)
 * when an interaction can leave the current app.
 */
export type StaffShellMutation = void;

export interface StaffShellUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface StaffShellPreferences {
  theme: StaffTheme;
  locale: StaffLocale;
}

export interface StaffNotification {
  id: string;
  title: string;
  body?: string;
  sourceLabel?: string;
  href?: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** Optional server-formatted timestamp for the user's timezone. */
  timeLabel?: string;
  readAt?: string | null;
}

export interface StaffNotificationsState {
  items: readonly StaffNotification[];
  unreadCount: number;
  /**
   * Unread notifications that also arrived after the last time this person
   * opened the bell. This — not `unreadCount` — is what the badge should count.
   *
   * The distinction is the whole point: `unreadCount` only goes down by
   * destroying content, so it becomes a permanent number and stops reading as a
   * signal. In production that already happened — 185 of 219 reads came from
   * three "mark all as read" clicks, and only 7 notifications were ever read one
   * at a time.
   *
   * Optional because a host may still be talking to a backend that does not
   * report it; the badge falls back to `unreadCount`.
   */
  unseenCount?: number;
  /** Canonical Nexus inbox URL. */
  href: string;
  loading?: boolean;
}

/**
 * The host-owned adapter consumed by the shared staff shell.
 *
 * Apps keep ownership of authentication, routing, fetching, and persistence.
 * The package owns presentation and interaction order.
 */
export interface StaffShellContextValue {
  user: StaffShellUser;
  profileHref: string;
  preferences: StaffShellPreferences;
  notifications: StaffNotificationsState;
  setTheme: (theme: StaffTheme) => StaffShellMutation;
  setLocale: (locale: StaffLocale) => StaffShellMutation;
  /** Must be optimistic or navigation-safe; destination links do not await it. */
  markNotificationRead?: (id: string) => StaffShellMutation;
  markAllNotificationsRead?: () => StaffShellMutation;
  /**
   * Called once each time the panel opens. Seeing is not reading: this clears
   * the badge and must NOT touch read state — the unread inbox stays intact so
   * the person can still work through it.
   *
   * Optional, and the panel opens whether or not the host provides it.
   */
  markNotificationsSeen?: () => StaffShellMutation;
  signOut?: () => StaffShellMutation;
}

const StaffShellContext = createContext<StaffShellContextValue | null>(null);

export interface StaffShellProviderProps {
  value: StaffShellContextValue;
  children: ReactNode;
}

export function StaffShellProvider({
  value,
  children,
}: StaffShellProviderProps) {
  return (
    <StaffShellContext.Provider value={value}>
      {children}
    </StaffShellContext.Provider>
  );
}

export function useStaffShell(): StaffShellContextValue {
  const value = useContext(StaffShellContext);
  if (!value) {
    throw new Error('useStaffShell must be used within StaffShellProvider');
  }
  return value;
}
