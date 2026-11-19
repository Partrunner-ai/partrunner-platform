import { useEffect, useRef, useState } from 'react';
import {
  APP_NAV_APPS,
  appHref,
  sortAppNavApps,
  type AppLink,
} from '@partrunner-ai/app-registry';
import type { ShellNavigationValue } from './NavigationContext';
import {
  EMPTY_NAV_MEMORY,
  isStorableNavPath,
  readNavMemory,
  rememberNavVisit,
  type NavMemory,
} from './navMemory';
import type { StaffLocale } from './StaffShellContext';
import { withWayBack } from './wayBack';

/** The registry label, except Nexus, which reads «Inicio» in the palette. */
export function appNavLabel(app: AppLink, locale: StaffLocale): string {
  if (app.sub === 'nexus') return locale === 'en' ? 'Home' : 'Inicio';
  return app.label;
}

/** Apps «Mis apps» and the palette know: a host override gets the same filter and order. */
export function appNavApps(apps?: AppLink[]): AppLink[] {
  const list = apps ?? APP_NAV_APPS;
  return sortAppNavApps(
    list.filter((app) => app.appNav !== false && !app.comingSoon && appHref(app) !== null),
  );
}

/** `https://host` of a URL, or `''` when it does not parse. */
export function originOf(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/** Pathname of an app's start URL, for the router link of the current app. */
export function startPath(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return '/';
  }
}

/**
 * Reads the visit memory after mount (the server has no cookie) and again when
 * the page changes or the tab comes back into view. It sets state only when the
 * cookie text changed. With `enabled` false it does nothing: no read, no listeners.
 */
export function useNavMemory(refreshKey: string, enabled = true): NavMemory {
  const [memory, setMemory] = useState<NavMemory>(EMPTY_NAV_MEMORY);
  const lastCookie = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const read = () => {
      const raw = document.cookie;
      if (raw === lastCookie.current) return;
      lastCookie.current = raw;
      setMemory(readNavMemory(raw));
    };
    read();
    const onVisible = () => {
      if (document.visibilityState === 'visible') read();
    };
    window.addEventListener('focus', read);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', read);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshKey, enabled]);
  return memory;
}

/** Records a visit for a header that only knows `currentSub`, not `appSub`. */
export function useHeaderVisitRecorder(nav: ShellNavigationValue, headerSub?: string): void {
  const enabled = !nav.appSub && Boolean(headerSub);
  useEffect(() => {
    if (!enabled || !headerSub) return;
    rememberNavVisit(
      {
        sub: headerSub,
        path: nav.currentPath,
        label: nav.activeLabel,
        labelPath: nav.activePath,
      },
      nav.cookieDomain,
      nav.navMemoryIgnore,
    );
    // The ignore list is a host constant; a new array must not re-record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, headerSub, nav.currentPath, nav.activeLabel, nav.activePath, nav.cookieDomain]);
}

/** The app name in «Mis apps» and the way back: the registry label, Nexus included. */
export function navAppName(app: AppLink): string {
  return app.sub === 'nexus' ? 'Nexus' : app.label;
}

const HOME: Record<StaffLocale, string> = { es: 'Inicio', en: 'Home' };

export interface NavAppRow {
  app: AppLink;
  name: string;
  /** Label of the page the row opens. */
  pageLabel: string;
  current: boolean;
  /** The current app, and the page is its start page (`aria-current`). */
  atStart: boolean;
  /** A path for the current app (router link), else an absolute URL. */
  href: string;
}

/**
 * One row per app: where it opens (the last page used there, else its start
 * page) and the label of that page. Other apps carry the way-back fragment for
 * the return trip.
 */
export function navAppRows(
  apps: AppLink[],
  currentSub: string | undefined,
  currentPath: string,
  memory: NavMemory,
  locale: StaffLocale,
): NavAppRow[] {
  return apps.map((app) => {
    const start = appHref(app)!;
    const current = currentSub !== undefined && app.sub === currentSub;
    const remembered = !current ? memory.last[app.sub] : undefined;
    const path = isStorableNavPath(remembered) ? remembered : undefined;
    const base = path ? `${originOf(start)}${path}` : start;
    return {
      app,
      name: navAppName(app),
      pageLabel: (path && memory.labels[app.sub]) || HOME[locale],
      current,
      atStart: current && currentPath.split('?')[0]!.split('#')[0]! === startPath(start),
      href: current ? startPath(start) : withWayBack(base, currentSub, currentPath),
    };
  });
}
