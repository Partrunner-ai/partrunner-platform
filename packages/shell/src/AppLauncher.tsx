import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { LayoutGrid } from 'lucide-react';
import { APPS, appHref, type AppLink, type AppTone } from '@partrunner-ai/app-registry';
import { navAppName, originOf, useNavMemory } from './navShared';
import { notifyNavigate, useShellNavigation } from './NavigationContext';
import { isStorableNavPath } from './navMemory';
import { preloadOnIntent } from './preloadApp';
import { useDismiss } from './useDismiss';
import { withWayBack } from './wayBack';

/** Inline tile colors driven by the theme's tone variables (no Tailwind dep). */
function tileStyle(tone: AppTone): CSSProperties {
  return {
    ['--pr-tile-bg' as string]: `var(--pr-tone-${tone}-bg)`,
    ['--pr-tile-fg' as string]: `var(--pr-tone-${tone}-fg)`,
  };
}

export interface AppLauncherProps {
  /** App list to render. Defaults to the canonical registry. */
  apps?: AppLink[];
  /** Subdomain of the current app, highlighted in the grid. */
  currentSub?: string;
  /** Popover heading. */
  label?: string;
  /** Trigger accessible name. */
  triggerLabel?: string;
  className?: string;
}

/**
 * Cross-app launcher grid. Destinations may live on separate hosts, so links
 * are native navigations (`<a href>`) and require no router.
 */
export function AppLauncher({
  apps = APPS,
  currentSub,
  label = 'Aplicaciones',
  triggerLabel = 'Aplicaciones',
  className,
}: AppLauncherProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapperRef, open, close);

  // In `'unified'` mode a tile opens the last page used in
  // that app and carries the way back. Launcher mode and a bare launcher keep
  // the start pages.
  const nav = useShellNavigation();
  const appNav = nav?.mode === 'unified' ? nav : null;
  const memory = useNavMemory(appNav ? appNav.currentPath : '', appNav !== null);
  const fromSub = appNav ? (appNav.appSub ?? currentSub) : currentSub;

  return (
    <div ref={wrapperRef} className={`pr-launcher${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="pr-iconbtn"
        aria-label={triggerLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <LayoutGrid size={18} aria-hidden />
      </button>

      {open && (
        <div className="pr-launcher__popover" role="menu">
          <p className="pr-launcher__title">{label}</p>
          <div className="pr-launcher__grid">
            {apps.map((app, i) => {
              const href = appHref(app);
              const isCurrent = currentSub !== undefined && app.sub === currentSub;
              const Icon = app.icon;
              const key = `${app.sub}:${app.path ?? i}`;
              const tile = (
                <>
                  <span className="pr-app__tile" style={tileStyle(app.tone)}>
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className="pr-app__label">{appNav ? navAppName(app) : app.label}</span>
                </>
              );

              // "Current" outranks "coming soon": an app that is still
              // `comingSoon` in the registry (no public URL yet) can perfectly
              // well host this launcher itself. Telling the user the app they
              // are looking at is "Próximamente" — and marking it
              // `aria-disabled` — would be plainly wrong.
              if (isCurrent) {
                return (
                  <div
                    key={key}
                    className="pr-app"
                    data-current="true"
                    title={`${app.description} (aplicación actual)`}
                    aria-current="page"
                  >
                    {tile}
                  </div>
                );
              }
              if (!href) {
                return (
                  <div
                    key={key}
                    className="pr-app"
                    data-disabled="true"
                    title="Próximamente"
                    aria-disabled="true"
                  >
                    {tile}
                  </div>
                );
              }
              let target = href;
              if (appNav) {
                const remembered = memory.last[app.sub];
                const base = isStorableNavPath(remembered) ? `${originOf(href)}${remembered}` : href;
                target = withWayBack(base, fromSub, appNav.currentPath);
              }
              return (
                <a
                  key={key}
                  href={target}
                  className="pr-app"
                  title={app.description}
                  role="menuitem"
                  {...preloadOnIntent(target)}
                  onClick={() => {
                    if (appNav) {
                      notifyNavigate(appNav.onNavigate, {
                        source: 'launcher',
                        fromSub,
                        toSub: app.sub,
                        href: target,
                      });
                    }
                    close();
                  }}
                >
                  {tile}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
