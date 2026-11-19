import { APPS, appHref, findApp, type AppLink } from '@partrunner-ai/app-registry';
import { canonicalOrigin } from './appOrigin';
import { isIgnoredNavPath, isStorableNavPath } from './navMemory';

/**
 * The way back: after a person comes to this app from another app in the same
 * tab, the header shows «← <App>» that opens the exact page they left.
 *
 * The page travels in the link, as a URL fragment (`#pr-from=<sub>:<path>`).
 * A fragment is never sent in an HTTP request, and it works across
 * `*.partrunner.ai` and `partrunner.app`. Without the fragment the shell falls
 * back to `document.referrer`. The arrival is kept in `sessionStorage` (per
 * origin and per tab); nothing goes to a server.
 */

export const WAY_BACK_KEY = 'pr-nav-from';
const FRAGMENT_PREFIX = '#pr-from=';
const FRAGMENT_PATTERN = /^#pr-from=([a-z0-9-]{1,40}):(.+)$/;

export interface WayBackTarget {
  /** Registry `sub` of the app the person came from. */
  s: string;
  /** Pathname of the page they left. */
  p: string;
}

/** `#pr-from=<sub>:<path>` for a link that leaves `sub` from `path`, or `''`. */
export function wayBackFragment(sub: string | undefined, path: string | undefined): string {
  if (!sub || !path || !/^[a-z0-9-]{1,40}$/.test(sub)) return '';
  const clean = path.split('?')[0]!.split('#')[0]!;
  if (!isStorableNavPath(clean)) return '';
  return `${FRAGMENT_PREFIX}${sub}:${encodeURIComponent(clean)}`;
}

/** Does this URL belong to the origin of a registry app? */
export function isRegistryOrigin(href: string): boolean {
  const origin = originOf(href);
  return origin !== '' && APPS.some((app) => originOf(appHref(app)) === origin);
}

/**
 * Replaces any fragment of `href` with the way-back fragment (or drops it). A
 * link to a host that is not a registry app is returned unchanged.
 */
export function withWayBack(
  href: string,
  fromSub: string | undefined,
  fromPath: string | undefined,
): string {
  if (!isRegistryOrigin(href)) return href;
  const base = href.split('#')[0]!;
  return `${base}${wayBackFragment(fromSub, fromPath)}`;
}

/** Does this hash carry a way-back fragment (valid or not)? */
export function hasWayBackFragment(hash: string): boolean {
  return hash.startsWith(FRAGMENT_PREFIX);
}

/** Parses and validates a location hash. The sub must be a registry app. */
export function parseWayBackHash(hash: string): WayBackTarget | null {
  const match = FRAGMENT_PATTERN.exec(hash);
  if (!match) return null;
  let path: string;
  try {
    path = decodeURIComponent(match[2]!);
  } catch {
    return null;
  }
  if (!findApp(match[1]!) || !isStorableNavPath(path) || isIgnoredNavPath(path)) return null;
  return { s: match[1]!, p: path };
}

/** Comparison origin: `www.<host>` and `<host>` are the same app. */
function originOf(url: string | null): string {
  return canonicalOrigin(url);
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return '/';
  }
}

/**
 * Finds the registry app a `document.referrer` belongs to. Compares origins;
 * for an app hosted by path it also compares the first path segment.
 */
export function wayBackFromReferrer(
  referrer: string,
  currentSub: string | undefined,
  last: Record<string, string>,
  apps: readonly AppLink[] = APPS,
): WayBackTarget | null {
  if (!referrer) return null;
  let ref: URL;
  try {
    ref = new URL(referrer);
  } catch {
    return null;
  }
  for (const app of apps) {
    if (app.sub === currentSub || app.comingSoon) continue;
    const start = appHref(app);
    if (!start || originOf(start) !== originOf(ref.href)) continue;
    if (app.scheme === 'path' && app.path) {
      // A cross-origin referrer is often cut to the origin, so `/` matches on
      // origin alone. Otherwise the first segment must match at a boundary.
      const segment = `/${app.path.split('/')[1] ?? ''}`;
      const path = ref.pathname;
      const atRoot = path === '' || path === '/';
      if (segment !== '/' && !atRoot && path !== segment && !path.startsWith(`${segment}/`)) {
        continue;
      }
    }
    const remembered = last[app.sub];
    const target = isStorableNavPath(remembered) ? remembered : pathOf(start);
    if (!isStorableNavPath(target)) return null;
    return { s: app.sub, p: target };
  }
  return null;
}

export function readWayBackStorage(): WayBackTarget | null {
  try {
    const raw = window.sessionStorage.getItem(WAY_BACK_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<WayBackTarget> | null;
    if (!value || typeof value.s !== 'string' || !findApp(value.s)) return null;
    return isStorableNavPath(value.p) && !isIgnoredNavPath(value.p)
      ? { s: value.s, p: value.p }
      : null;
  } catch {
    return null;
  }
}

export function writeWayBackStorage(target: WayBackTarget): void {
  try {
    window.sessionStorage.setItem(WAY_BACK_KEY, JSON.stringify(target));
  } catch {
    /* the way back is a nicety, never a failure */
  }
}

/**
 * Reads this tab's arrival once, on the first mount: the fragment first, else
 * the referrer. Removes only the fragment from the address bar and stores the
 * arrival. Returns what is stored (the new arrival, or an earlier one).
 */
export function captureWayBack(
  currentSub: string | undefined,
  last: Record<string, string>,
): WayBackTarget | null {
  let arrival: WayBackTarget | null = null;
  const hash = window.location.hash;
  if (hasWayBackFragment(hash)) {
    arrival = parseWayBackHash(hash);
    try {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    } catch {
      /* ignore */
    }
  } else if (currentSub) {
    arrival = wayBackFromReferrer(document.referrer, currentSub, last);
  }
  if (arrival && arrival.s !== currentSub) writeWayBackStorage(arrival);
  const stored = readWayBackStorage();
  return stored && stored.s !== currentSub ? stored : null;
}
