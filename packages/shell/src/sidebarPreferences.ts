export interface AppShellInitialState {
  collapsed: boolean;
  groups: Record<string, boolean>;
  /**
   * «Mis apps» from the shared cookie (registry subs, in order). Absent when the
   * cookie has no value yet; `[]` when the person chose no apps.
   */
  favoriteApps?: readonly string[];
}

/** The most apps a person can mark as favorite. */
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

export function appShellFavoritesKey(storageKey: string): string {
  return `${storageKey}:favs`;
}

/**
 * Cookie value for «Mis apps»: valid subs joined with `.` (subs never contain
 * a dot). At most 5 subs of 40 characters, so it stays under about 210 bytes.
 * An empty list encodes as `-`, so «no favorites» differs from «no cookie».
 */
export function encodeAppShellFavorites(favorites: readonly string[]): string {
  const subs = normalizeFavoriteApps(favorites) ?? [];
  return subs.length === 0 ? '-' : subs.join('.');
}

/** Reads `encodeAppShellFavorites`. A missing or bad value reads as `undefined`. */
export function decodeAppShellFavorites(
  value: string | null | undefined,
): readonly string[] | undefined {
  if (!value) return undefined;
  if (value === '-') return [];
  return normalizeFavoriteApps(value.split('.'));
}

interface StoredGroupsV1 {
  version: 1;
  groups: Record<string, boolean>;
}

export function appShellGroupsKey(storageKey: string): string {
  return `${storageKey}:groups`;
}

function cookieValues(cookieHeader: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const entry of cookieHeader.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    const name = entry.slice(0, separator).trim();
    if (!name) continue;
    values.set(name, entry.slice(separator + 1).trim());
  }
  return values;
}

function booleanRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => {
      return typeof entry[1] === 'boolean';
    }),
  );
}

export function decodeAppShellGroups(value: string | null | undefined): Record<string, boolean> {
  if (!value) return {};
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Legacy localStorage values are raw JSON and may contain a literal `%`.
  }

  try {
    const parsed = JSON.parse(decoded) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed as Partial<StoredGroupsV1>).version === 1
    ) {
      return booleanRecord((parsed as Partial<StoredGroupsV1>).groups);
    }
    // Backward compatibility with the original unversioned localStorage record.
    return booleanRecord(parsed);
  } catch {
    return {};
  }
}

export function encodeAppShellGroups(groups: Record<string, boolean>): string {
  const stored: StoredGroupsV1 = { version: 1, groups: booleanRecord(groups) };
  return encodeURIComponent(JSON.stringify(stored));
}

export function parseAppShellState(
  cookieHeader: string,
  storageKey = 'pr-sidebar-collapsed',
): AppShellInitialState {
  const values = cookieValues(cookieHeader);
  const favoriteApps = decodeAppShellFavorites(values.get(appShellFavoritesKey(storageKey)));
  return {
    collapsed: values.get(storageKey) === '1',
    groups: decodeAppShellGroups(values.get(appShellGroupsKey(storageKey))),
    ...(favoriteApps === undefined ? {} : { favoriteApps }),
  };
}

/**
 * Server helper: the first-render state of `AppShell` from a request. Pass the
 * raw `Cookie` header (`headers().get('cookie')`) or a Next.js cookie store
 * (`await cookies()`); a missing source reads as an empty cookie. Returns only
 * the minimal state, so the page never serializes the raw header.
 *
 *     const initialState = readAppShellInitialState(await cookies());
 *     <AppShell collapseStorage="cookie" cookieDomain=".partrunner.ai" initialState={initialState} />
 */
export function readAppShellInitialState(
  source: string | null | undefined | CookieStoreLike,
  storageKey = 'pr-sidebar-collapsed',
): AppShellInitialState {
  if (typeof source === 'string') return parseAppShellState(source, storageKey);
  if (!source) return parseAppShellState('', storageKey);
  const names = [storageKey, appShellGroupsKey(storageKey), appShellFavoritesKey(storageKey)];
  const header = names
    .flatMap((name) => {
      const value = source.get(name)?.value;
      return value === undefined ? [] : [`${name}=${value}`];
    })
    .join('; ');
  return parseAppShellState(header, storageKey);
}

/** The part of a Next.js cookie store that `readAppShellInitialState` reads. */
export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
}
