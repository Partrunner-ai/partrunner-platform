import type { StaffBellSound } from './bellSound';
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
  /**
   * The apps the person marked as «Mis apps» (registry `sub`s, in the person's
   * order, at most 5). Read by the sidebar of `navigation="unified"`.
   */
  favoriteApps?: readonly string[];
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
  /**
   * Sonido de la campana, configurado en Nexus para toda la empresa. Ausente =
   * campana muda, que es como estaba antes de que existiera.
   */
  sound?: StaffBellSound;
  /** Canonical Nexus inbox URL. */
  href: string;
  loading?: boolean;
}

/** `mine` = asignado a mí; `team` = de mi equipo y nadie lo tomó. */
export type StaffPendingBucket = 'mine' | 'team';

export interface StaffPendingItem {
  id: string;
  bucket: StaffPendingBucket;
  /** Lo que se espera de la persona: «Aprobar», «Decidir». */
  verb: string;
  /** La cola de origen: «Tarifas pactadas». */
  queue: string;
  title: string;
  subtitle?: string;
  /** URL absoluta https o ruta del mismo origen. Cualquier otra cosa no es un enlace. */
  href?: string;
  /** «hace 3 h», ya localizado por el anfitrión. */
  ageLabel?: string;
}

export interface StaffPendingAppCount {
  mine: number;
  team: number;
}

/**
 * Lo que la persona debe hacer o aprobar. A diferencia de la campana, que sólo
 * informa, esto es trabajo: el shell sólo lo dibuja y el anfitrión lo trae.
 */
export interface StaffPendientesState {
  /** Total asignado a mí (puede ser mayor que los `items` mostrados). */
  mine: number;
  /** Total del equipo que nadie tomó. */
  team: number;
  /** Lo que lista la bandeja (el anfitrión manda ~10 como máximo, primero los míos). */
  items: readonly StaffPendingItem[];
  /** Conteo por app; la llave es el `sub` del registro de apps. */
  byApp?: Readonly<Record<string, StaffPendingAppCount>>;
  /** «Ver todo»: Nexus Inicio #pendientes. */
  href: string;
  loading?: boolean;
  /** Nombre corto del equipo para el título «De <equipo>, sin tomar» (p. ej. «Finanzas»). */
  teamLabel?: string;
}

/**
 * One page of the cross-app index that powers the «Ir a» palette in
 * `navigation="unified"` mode. Hosts (Nexus, later) fill it; it is optional.
 */
export interface StaffShellPage {
  /** Registry `sub` of the app that owns the page. */
  app: string;
  label: string;
  /** Absolute URL. */
  href: string;
  /** Section heading shown next to the label. */
  section?: string;
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
  /**
   * Vuelve a pedir el snapshot. El shell lo llama cada minuto mientras la
   * pestaña está a la vista y al volver a ella, para que todas las apps vean
   * lo mismo que Nexus sin recargar y el aviso de llegada pueda sonar. Debe
   * ser silencioso al fallar: el siguiente intento lo repara.
   *
   * Opcional; sin él la campana sólo cambia al recargar, como antes.
   */
  refreshNotifications?: () => StaffShellMutation;
  /**
   * Pendientes de la persona (bandeja junto a la campana y conteos en el menú
   * y en los mosaicos de apps). Ausente = no se dibuja nada, como antes.
   */
  pendientes?: StaffPendientesState;
  /**
   * Vuelve a pedir los pendientes. Se llama una vez cada vez que se abre la
   * bandeja. Sin él, la bandeja usa `refreshNotifications` (el mismo snapshot).
   */
  refreshPendientes?: () => StaffShellMutation;
  /**
   * Toma un pendiente del equipo (botón «Lo tomo»). Debe rechazar si no se
   * pudo tomar. Al terminar bien, la bandeja llama `refreshPendientes`. Sin él,
   * las filas del equipo sólo tienen «Abrir».
   */
  claimPendiente?: (id: string) => Promise<void>;
  signOut?: () => StaffShellMutation;
  /** Optional cross-app page index for the «Ir a» palette (`navigation="unified"`). */
  pages?: readonly StaffShellPage[];
  /**
   * Saves `preferences.favoriteApps`. The shell passes the subs in
   * `APP_NAV_ORDER`, at most 5. Must be optimistic (like `setTheme`). Without it
   * the list is read-only. When it throws or returns a promise that rejects, the
   * shell puts the previous list back and shows «No se pudo guardar».
   */
  setFavoriteApps?: (subs: readonly string[]) => StaffShellMutation | Promise<unknown>;
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

/**
 * Like `useStaffShell`, but returns `null` outside a provider. For shell parts
 * that work without a host adapter. Not part of the public API.
 */
export function useOptionalStaffShell(): StaffShellContextValue | null {
  return useContext(StaffShellContext);
}
