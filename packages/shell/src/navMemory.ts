/**
 * Visit memory for `navigation="appbar"`.
 *
 * Two small cookies let one app open the page you last used in another app:
 *
 * - `pr-nav-last`: `{ [sub]: pathname }`, the last page per app.
 * - `pr-nav-recent`: `[{ s, p, l }]`, newest first, the pages behind «Ir a».
 *
 * Only the pathname is stored, never the query or the hash, so SSO codes and
 * tokens cannot leak into a cookie. Parsing is defensive: a missing, oversized,
 * or foreign value reads as empty and never throws.
 */

import { getAppRegistryConfig } from '@partrunner-ai/app-registry';

/** Base cookie names. Use `navMemoryCookieNames()` for the real, per-environment names. */
export const NAV_LAST_COOKIE = 'pr-nav-last';
export const NAV_RECENT_COOKIE = 'pr-nav-recent';
/**
 * Staging and production share the `.partrunner.ai` cookie domain, so the names
 * carry the environment: an empty host prefix keeps the base names, and
 * `staging.` gives `pr-nav-last-staging`. Read at call time, because
 * `configureAppRegistry` can run after this module loads.
 */
export function navMemoryCookieNames(): { last: string; recent: string } {
  const suffix = getAppRegistryConfig().hostPrefix.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const tail = suffix ? `-${suffix}` : '';
  return { last: `${NAV_LAST_COOKIE}${tail}`, recent: `${NAV_RECENT_COOKIE}${tail}` };
}

export const NAV_MEMORY_MAX_AGE = 60 * 60 * 24 * 30;
export const NAV_RECENT_LIMIT = 8;
export const NAV_PATH_LIMIT = 160;
export const NAV_LABEL_LIMIT = 60;
/**
 * Both cookies travel with every request to every `*.partrunner.ai` host, so
 * they stay small. The last-page cookie is skipped when it is larger; the
 * recent cookie drops its oldest entries until it fits.
 */
const LAST_VALUE_LIMIT = 2000;
const RECENT_VALUE_LIMIT = 1500;
/** Larger raw cookie values are not even parsed. */
const PARSE_VALUE_LIMIT = 4000;

/**
 * Paths that are never remembered: a person must not land on a login or an SSO
 * hop when they pick an app. A trailing `*` matches any path with that prefix;
 * any other entry matches the path and everything below it.
 */
export const NAV_MEMORY_IGNORE: readonly string[] = [
  '/login',
  '/logout',
  '/auth/*',
  '/sso*',
  '/unauthorized',
  '/solicitar-acceso',
];

export interface NavRecentEntry {
  /** Registry sub of the app. */
  s: string;
  /** Pathname. */
  p: string;
  /** Label of the page. */
  l: string;
}

export interface NavMemory {
  last: Record<string, string>;
  recent: NavRecentEntry[];
}

export const EMPTY_NAV_MEMORY: NavMemory = { last: {}, recent: [] };

function isStorablePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= NAV_PATH_LIMIT &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[?#\s]/.test(value)
  );
}

function isStorableSub(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]{1,40}$/.test(value);
}

function decodeJson(raw: string | null | undefined): unknown {
  if (!raw || raw.length > PARSE_VALUE_LIMIT) return undefined;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return undefined;
  }
}

export function parseNavLast(raw: string | null | undefined): Record<string, string> {
  const value = decodeJson(raw);
  const out: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [sub, path] of Object.entries(value as Record<string, unknown>)) {
    if (isStorableSub(sub) && isStorablePath(path)) out[sub] = path;
  }
  return out;
}

export function parseNavRecent(raw: string | null | undefined): NavRecentEntry[] {
  const value = decodeJson(raw);
  if (!Array.isArray(value)) return [];
  const out: NavRecentEntry[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (out.length >= NAV_RECENT_LIMIT) break;
    if (!item || typeof item !== 'object') continue;
    const { s, p, l } = item as Record<string, unknown>;
    if (!isStorableSub(s) || !isStorablePath(p)) continue;
    if (typeof l !== 'string' || l.length === 0 || l.length > NAV_LABEL_LIMIT) continue;
    const key = `${s}\n${p}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ s, p, l });
  }
  return out;
}

function encodeValue(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

/** Encoded last-page cookie, or `null` when it would be too large. */
export function serializeNavLast(last: Record<string, string>): string | null {
  const encoded = encodeValue(last);
  return encoded.length > LAST_VALUE_LIMIT ? null : encoded;
}

/** Encoded recent cookie. The oldest entries go first until it fits. */
export function serializeNavRecent(recent: readonly NavRecentEntry[]): string {
  const list = recent.slice(0, NAV_RECENT_LIMIT);
  let encoded = encodeValue(list);
  while (list.length > 0 && encoded.length > RECENT_VALUE_LIMIT) {
    list.pop();
    encoded = encodeValue(list);
  }
  return encoded;
}

/** Does `path` match the built-in or host-supplied ignore list? */
export function isIgnoredNavPath(
  path: string,
  extra: readonly string[] = [],
): boolean {
  for (const rule of [...NAV_MEMORY_IGNORE, ...extra]) {
    if (rule.endsWith('*')) {
      const prefix = rule.slice(0, -1);
      // `/auth/*` also covers the bare `/auth`.
      if (path.startsWith(prefix) || (prefix.endsWith('/') && path === prefix.slice(0, -1))) {
        return true;
      }
    } else if (path === rule || path.startsWith(`${rule}/`)) {
      return true;
    }
  }
  return false;
}

export interface NavVisit {
  sub: string;
  /** Pathname. A query or hash is cut off. */
  path: string;
  /** Label of the active page, when the shell knows one. */
  label?: string;
  /**
   * Path of the menu page that owns `label`. A detail page such as `/rutas/123`
   * sits under the menu item `/rutas`; recents keep the menu page so the
   * palette does not list one item many times. `last` keeps the exact path.
   */
  labelPath?: string;
}

/**
 * Pure update: returns the memory after a visit. `last` always moves; `recent`
 * only moves when the visit has a label. Values that break a limit are skipped.
 */
export function recordNavVisit(
  memory: NavMemory,
  visit: NavVisit,
  ignore: readonly string[] = [],
): NavMemory {
  const path = visit.path.split('?')[0]!.split('#')[0]!;
  if (!isStorableSub(visit.sub) || !isStorablePath(path)) return memory;
  if (isIgnoredNavPath(path, ignore)) return memory;

  const last = { ...memory.last, [visit.sub]: path };
  let recent = memory.recent;
  const label = visit.label?.trim();
  const recentPath = (visit.labelPath ?? path).split('?')[0]!.split('#')[0]!;
  if (
    label &&
    label.length <= NAV_LABEL_LIMIT &&
    isStorablePath(recentPath) &&
    !isIgnoredNavPath(recentPath, ignore)
  ) {
    recent = [
      { s: visit.sub, p: recentPath, l: label },
      ...memory.recent.filter((entry) => !(entry.s === visit.sub && entry.p === recentPath)),
    ].slice(0, NAV_RECENT_LIMIT);
  }
  return { last, recent };
}

function readCookie(source: string, name: string): string | undefined {
  for (const part of source.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

/** Reads both cookies. Client only; returns an empty memory on the server. */
export function readNavMemory(
  cookieSource: string | undefined = typeof document === 'undefined'
    ? undefined
    : document.cookie,
): NavMemory {
  if (!cookieSource) return EMPTY_NAV_MEMORY;
  const names = navMemoryCookieNames();
  return {
    last: parseNavLast(readCookie(cookieSource, names.last)),
    recent: parseNavRecent(readCookie(cookieSource, names.recent)),
  };
}

function writeCookie(name: string, value: string, cookieDomain?: string): void {
  const domain = cookieDomain ? `; Domain=${cookieDomain}` : '';
  document.cookie = `${name}=${value}; Path=/; SameSite=Lax; Max-Age=${NAV_MEMORY_MAX_AGE}${domain}`;
}

/** Writes both cookies. A value that is too large is skipped, never truncated. */
export function writeNavMemory(memory: NavMemory, cookieDomain?: string): void {
  if (typeof document === 'undefined') return;
  try {
    const names = navMemoryCookieNames();
    const last = serializeNavLast(memory.last);
    if (last !== null) writeCookie(names.last, last, cookieDomain);
    writeCookie(names.recent, serializeNavRecent(memory.recent), cookieDomain);
  } catch {
    /* a remembered page is a nicety, never a failure */
  }
}

/** Reads, records, and writes one visit. Returns the new memory. */
export function rememberNavVisit(
  visit: NavVisit,
  cookieDomain?: string,
  ignore: readonly string[] = [],
): NavMemory {
  const before = readNavMemory();
  const after = recordNavVisit(before, visit, ignore);
  if (after !== before) writeNavMemory(after, cookieDomain);
  return after;
}
