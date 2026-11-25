import type {
  StaffPendientesState,
  StaffPendingAppCount,
  StaffPendingItem,
} from './StaffShellContext';

/** Lo que viaja en el snapshot: lo mismo que el estado, sin `loading`. */
export type StaffPendientesSnapshot = Omit<StaffPendientesState, 'loading'>;

/** La bandeja lista a lo sumo esto; el resto se cuenta pero no se manda. */
const PENDIENTES_ITEMS_MAX = 20;

/**
 * Un enlace seguro es `https://…`, `http://localhost…` o una ruta que empieza
 * con `/` pero no con `//`. Todo lo demás (`javascript:`, `data:`, `//evil`,
 * vacío) no es un enlace.
 */
export function isSafePendienteHref(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (/^https:\/\/\S/i.test(value)) return true;
  if (/^http:\/\/localhost(?=[:/?#]|$)/i.test(value)) return true;
  return value.startsWith('/') && !value.startsWith('//');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeItem(value: unknown): StaffPendingItem | undefined {
  if (!isRecord(value)) return undefined;
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.verb) ||
    !isNonEmptyString(value.queue) ||
    !isNonEmptyString(value.title) ||
    (value.bucket !== 'mine' && value.bucket !== 'team')
  ) {
    return undefined;
  }
  const { subtitle, href, ageLabel } = value;
  if (subtitle !== undefined && typeof subtitle !== 'string') return undefined;
  if (href !== undefined && typeof href !== 'string') return undefined;
  if (ageLabel !== undefined && typeof ageLabel !== 'string') return undefined;
  const item: StaffPendingItem = {
    id: value.id,
    bucket: value.bucket,
    verb: value.verb,
    queue: value.queue,
    title: value.title,
  };
  if (subtitle !== undefined) item.subtitle = subtitle;
  if (isSafePendienteHref(href)) item.href = href;
  if (ageLabel !== undefined) item.ageLabel = ageLabel;
  return item;
}

function normalizeByApp(
  value: unknown,
): Record<string, StaffPendingAppCount> | undefined {
  if (!isRecord(value)) return undefined;
  const byApp: Record<string, StaffPendingAppCount> = {};
  for (const [sub, count] of Object.entries(value)) {
    if (isRecord(count) && isCount(count.mine) && isCount(count.team)) {
      byApp[sub] = { mine: count.mine, team: count.team };
    }
  }
  return byApp;
}

/**
 * Lee el bloque `pendientes` de un snapshot. Un bloque malformado da
 * `undefined` (nunca debe tumbar el snapshot ni la campana); un ítem malo se
 * descarta y el resto se queda. Lo usan `parseStaffShellSnapshot` y los
 * anfitriones que arman el bloque por su cuenta.
 */
export function normalizePendientes(
  value: unknown,
): StaffPendientesSnapshot | undefined {
  if (
    !isRecord(value) ||
    !isCount(value.mine) ||
    !isCount(value.team) ||
    !isNonEmptyString(value.href) ||
    !Array.isArray(value.items)
  ) {
    return undefined;
  }
  const items = value.items
    .map(normalizeItem)
    .filter((item): item is StaffPendingItem => item !== undefined)
    .slice(0, PENDIENTES_ITEMS_MAX);
  const result: StaffPendientesSnapshot = {
    mine: value.mine,
    team: value.team,
    items,
    href: value.href,
  };
  if (value.byApp !== undefined) {
    const byApp = normalizeByApp(value.byApp);
    if (byApp) return { ...result, byApp };
  }
  return result;
}

export type PendingTone = 'mine' | 'team';

/** `mine` si algo está asignado a la persona; `team` si sólo hay del equipo sin tomar. */
export function pendingTone(count: { mine: number; team: number }): PendingTone {
  return count.mine > 0 ? 'mine' : 'team';
}

/** «99+» a partir de 100, como el badge de la campana. */
export function formatPendingCount(total: number): string {
  return total > 99 ? '99+' : String(total);
}

/**
 * El conteo de una app para su mosaico, o `null` si no hay nada que mostrar.
 * Sin anfitrión (`pendientes` ausente) no hay conteos ni error.
 */
export function appPendingCount(
  pendientes: StaffPendientesState | undefined,
  sub: string,
): { total: number; tone: PendingTone } | null {
  const count = pendientes?.byApp?.[sub];
  if (!count) return null;
  const total = count.mine + count.team;
  return total > 0 ? { total, tone: pendingTone(count) } : null;
}

/** «, 3 pendientes» para el nombre accesible de un mosaico. */
export function pendingNameSuffix(total: number, locale: 'es' | 'en'): string {
  return locale === 'es' ? `, ${total} pendientes` : `, ${total} to-dos`;
}
