import { APP_NAV_APPS, navMemoryCookieNames } from '@partrunner-ai/shell';
import { registryOrigin, simApp, simPages, type SimApp } from './fixtures';

/** Key the shell reads for the way back (`pr-nav-from`, per tab). */
export const WAY_BACK_STORAGE_KEY = 'pr-nav-from';
export const FAVORITES_STORAGE_KEY = 'pr-showcase-nav-favorites';
export const DEFAULT_FAVORITES: readonly string[] = ['liveops', 'supply', 'sube-tu-factura'];

export interface SimLocation {
  app: string;
  path: string;
}

export type LinkRoute =
  | { kind: 'app'; sub: string; path: string }
  | { kind: 'local' }
  | { kind: 'blocked'; host: string };

/**
 * Where a clicked link would go, decided without navigating. A URL on the origin
 * of a registry app is a simulated app; the page's own origin is an in-app
 * route (the demo router handles it); anything else is blocked.
 */
export function routeLink(href: string, pageOrigin: string): LinkRoute {
  let url: URL;
  try {
    url = new URL(href, pageOrigin);
  } catch {
    return { kind: 'blocked', host: href };
  }
  if (url.origin === pageOrigin) return { kind: 'local' };
  for (const app of APP_NAV_APPS) {
    if (registryOrigin(app.sub) === url.origin) {
      return { kind: 'app', sub: app.sub, path: url.pathname };
    }
  }
  return { kind: 'blocked', host: url.host };
}

/**
 * An empty path, `/`, or a path that is not a page of the app (for example an
 * old remembered cookie) opens the home page of the app.
 */
export function resolvePath(app: SimApp, rawPath: string): string {
  const path = rawPath.split('?')[0]!.split('#')[0]!;
  if (path === '' || path === '/') return app.home;
  return simPages(app).some((page) => page.href === path) ? path : app.home;
}

/** Same as `resolvePath` for a sub; an unknown sub keeps the path. */
export function resolveInApp(sub: string, rawPath: string): string {
  const app = simApp(sub);
  return app ? resolvePath(app, rawPath) : rawPath;
}

function cookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; Path=/; SameSite=Lax; Max-Age=2592000`;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0`;
}

/** Clears the two visit-memory cookies, the way back, and the favorites. */
export function clearNavState(): void {
  const names = navMemoryCookieNames();
  clearCookie(names.last);
  clearCookie(names.recent);
  try {
    window.sessionStorage.removeItem(WAY_BACK_STORAGE_KEY);
    window.localStorage.removeItem(FAVORITES_STORAGE_KEY);
  } catch {
    /* storage can be blocked */
  }
}

/** Records the page the person leaves, the way the shell reads it on the next mount. */
export function writeWayBack(from: SimLocation): void {
  try {
    window.sessionStorage.setItem(
      WAY_BACK_STORAGE_KEY,
      JSON.stringify({ s: from.app, p: from.path }),
    );
  } catch {
    /* the way back is a nicety */
  }
}

export interface SeedPage {
  sub: string;
  path: string;
  label: string;
}

/** Writes the visit memory (`last` per app and the recent list, newest first). */
export function seedVisitMemory(pages: readonly SeedPage[]): void {
  const names = navMemoryCookieNames();
  const last: Record<string, { p: string; l: string }> = {};
  for (const page of [...pages].reverse()) last[page.sub] = { p: page.path, l: page.label };
  cookie(names.last, encodeURIComponent(JSON.stringify(last)));
  cookie(
    names.recent,
    encodeURIComponent(JSON.stringify(pages.map((page) => ({ s: page.sub, p: page.path, l: page.label })))),
  );
}

export interface NavTask {
  id: number;
  text: string;
  start: SimLocation;
  goal: SimLocation;
  /** Prepares the memory the task assumes. */
  prepare?: () => void;
}

export const TASKS: NavTask[] = [
  {
    id: 1,
    text: 'En LiveOps › Todas las rutas, abre Supply › Afiliación.',
    start: { app: 'liveops', path: '/general/routes' },
    goal: { app: 'supply', path: '/afiliacion' },
  },
  {
    id: 2,
    text: 'En Supply › Flotas, abre Solicitudes › Unidades solicitadas.',
    start: { app: 'supply', path: '/onboarding/flotas' },
    goal: { app: 'solicitudes', path: '/dashboard/neg-need-supply' },
  },
  {
    id: 3,
    text: 'En LiveOps › Todas las rutas, abre Finanzas › Rutas (Ajustes daily).',
    start: { app: 'liveops', path: '/general/routes' },
    goal: { app: 'sube-tu-factura', path: '/admin/ajustes-daily' },
  },
  {
    id: 4,
    text: 'Después de 3 páginas en Supply, vuelve a LiveOps › Todas las rutas.',
    start: { app: 'supply', path: '/tarifas-pactadas' },
    goal: { app: 'liveops', path: '/general/routes' },
    prepare: () => {
      writeWayBack({ app: 'liveops', path: '/general/routes' });
      seedVisitMemory([
        { sub: 'supply', path: '/tarifas-pactadas', label: 'Tarifas pactadas' },
        { sub: 'supply', path: '/prospectos', label: 'Prospectos' },
        { sub: 'supply', path: '/afiliacion', label: 'Afiliación' },
        { sub: 'liveops', path: '/general/routes', label: 'Todas las rutas' },
      ]);
    },
  },
];

export function sameLocation(a: SimLocation, b: SimLocation): boolean {
  return a.app === b.app && a.path === b.path;
}
