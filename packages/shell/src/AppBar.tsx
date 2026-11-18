import { useEffect, useState } from 'react';
import { APP_BAR_APPS, appHref, type AppLink } from '@partrunner-ai/app-registry';
import { notifyNavigate, type ShellNavigationValue } from './NavigationContext';
import { EMPTY_NAV_MEMORY, readNavMemory, rememberNavVisit, type NavMemory } from './navMemory';
import type { StaffLocale } from './StaffShellContext';

/** The registry label, except Nexus, which reads «Inicio» in the app bar. */
export function appBarLabel(app: AppLink, locale: StaffLocale): string {
  if (app.sub === 'nexus') return locale === 'en' ? 'Home' : 'Inicio';
  return app.label;
}

/** Apps the bar and the palette know: a host override gets the same filter. */
export function appBarApps(apps?: AppLink[]): AppLink[] {
  const list = apps ?? APP_BAR_APPS;
  return list.filter((app) => app.appBar !== false && !app.comingSoon && appHref(app) !== null);
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

/**
 * Reads the visit memory after mount (the server has no cookie) and again when
 * the page changes or the tab comes back into view.
 */
export function useNavMemory(refreshKey: string): NavMemory {
  const [memory, setMemory] = useState<NavMemory>(EMPTY_NAV_MEMORY);
  useEffect(() => {
    const read = () => setMemory(readNavMemory());
    read();
    window.addEventListener('focus', read);
    return () => window.removeEventListener('focus', read);
  }, [refreshKey]);
  return memory;
}

/** Records a visit for a header that only knows `currentSub`, not `appSub`. */
function useHeaderVisitRecorder(nav: ShellNavigationValue, headerSub?: string): void {
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

export interface AppBarProps {
  apps: AppLink[];
  currentSub?: string;
  locale: StaffLocale;
  label: string;
  memory: NavMemory;
  onNavigate?: ShellNavigationValue['onNavigate'];
}

/**
 * All apps in one fixed order. The current app is marked and opens its start
 * page; any other app opens the last page you used there, else its start page.
 * Native anchors: destinations live on other hosts.
 */
export function AppBar({ apps, currentSub, locale, label, memory, onNavigate }: AppBarProps) {
  return (
    <nav className="pr-appbar" aria-label={label}>
      {apps.map((app) => {
        const start = appHref(app)!;
        const current = currentSub !== undefined && app.sub === currentSub;
        const remembered = !current ? memory.last[app.sub] : undefined;
        const href = remembered ? `${originOf(start)}${remembered}` : start;
        return (
          <a
            key={`${app.sub}:${app.path ?? ''}`}
            className="pr-appbar__item"
            href={href}
            title={app.description}
            aria-current={current ? 'page' : undefined}
            data-current={current ? 'true' : undefined}
            onClick={() =>
              notifyNavigate(onNavigate, {
                source: 'appbar',
                fromSub: currentSub,
                toSub: app.sub,
                href,
              })
            }
          >
            {appBarLabel(app, locale)}
          </a>
        );
      })}
    </nav>
  );
}

export interface AppBarSectionProps {
  nav: ShellNavigationValue;
  apps: AppLink[];
  /** The app that is marked as current: `appSub`, else the header's `currentSub`. */
  currentSub?: string;
  /** The header's own `currentSub`, used to record visits when `appSub` is absent. */
  headerSub?: string;
  locale: StaffLocale;
  label: string;
}

/** The app bar plus the visit memory it reads and, without `appSub`, writes. */
export function AppBarSection({
  nav,
  apps,
  currentSub,
  headerSub,
  locale,
  label,
}: AppBarSectionProps) {
  const memory = useNavMemory(nav.currentPath);
  useHeaderVisitRecorder(nav, headerSub);
  return (
    <AppBar
      apps={apps}
      currentSub={currentSub}
      locale={locale}
      label={label}
      memory={memory}
      onNavigate={nav.onNavigate}
    />
  );
}
