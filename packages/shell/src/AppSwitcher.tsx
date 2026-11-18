import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { appHref, findApp, type AppLink } from '@partrunner-ai/app-registry';
import { originOf, startPath, useHeaderVisitRecorder, useNavMemory } from './AppBar';
import { notifyNavigate, type ShellNavigationValue } from './NavigationContext';
import { isStorableNavPath, type NavMemory } from './navMemory';
import type { StaffLocale } from './StaffShellContext';
import { useDismiss } from './useDismiss';
import { withWayBack, type WayBackTarget } from './wayBack';

interface SwitcherMessages {
  apps: string;
  here: string;
  home: string;
  back: (app: string) => string;
}

const MESSAGES: Record<StaffLocale, SwitcherMessages> = {
  es: { apps: 'Apps', here: 'aquí', home: 'Inicio', back: (app) => `Volver a ${app}` },
  en: { apps: 'Apps', here: 'here', home: 'Home', back: (app) => `Back to ${app}` },
};

/** The app name in the switcher and the way back: the registry label, Nexus included. */
export function switcherName(app: AppLink): string {
  return app.sub === 'nexus' ? 'Nexus' : app.label;
}

export interface SwitcherRow {
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
 * One row per app of the bar: where it opens (the last page used there, else
 * its start page) and the label of that page. Other apps carry the way-back
 * fragment for the return trip.
 */
export function switcherRows(
  apps: AppLink[],
  currentSub: string | undefined,
  currentPath: string,
  memory: NavMemory,
  locale: StaffLocale,
): SwitcherRow[] {
  return apps.map((app) => {
    const start = appHref(app)!;
    const current = currentSub !== undefined && app.sub === currentSub;
    const remembered = !current ? memory.last[app.sub] : undefined;
    const path = isStorableNavPath(remembered) ? remembered : undefined;
    const base = path ? `${originOf(start)}${path}` : start;
    return {
      app,
      name: switcherName(app),
      pageLabel: (path && memory.labels[app.sub]) || MESSAGES[locale].home,
      current,
      atStart: current && currentPath.split('?')[0]!.split('#')[0]! === startPath(start),
      href: current ? startPath(start) : withWayBack(base, currentSub, currentPath),
    };
  });
}

export interface AppSwitcherProps {
  apps: AppLink[];
  currentSub?: string;
  locale: StaffLocale;
  memory: NavMemory;
  nav: ShellNavigationValue;
}

/**
 * «Supply ▾»: the current app's name opens a short menu of every app, each with
 * the page it will open. Keys: arrows, Home/End, digits 1-9, Esc.
 */
export function AppSwitcher({ apps, currentSub, locale, memory, nav }: AppSwitcherProps) {
  const messages = MESSAGES[locale];
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { LinkComponent, currentPath, onNavigate } = nav;
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapperRef, open, close, triggerRef);

  const rows = switcherRows(apps, currentSub, currentPath, memory, locale);
  const currentApp = currentSub ? findApp(currentSub) : undefined;
  const triggerName = currentApp ? switcherName(currentApp) : messages.apps;

  const items = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('.pr-switcher__item') ?? []);

  useEffect(() => {
    if (!open) return;
    const index = Math.max(
      rows.findIndex((row) => row.current),
      0,
    );
    items()[index]?.focus();
    // Focus once, when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const focus = (next: number) => {
      event.preventDefault();
      list[(next + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') focus(index + 1);
    else if (event.key === 'ArrowUp') focus(index - 1);
    else if (event.key === 'Home') focus(0);
    else if (event.key === 'End') focus(list.length - 1);
    else if (event.key === 'Tab') close();
    else if (/^[1-9]$/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const target = list[Number(event.key) - 1];
      if (target) {
        event.preventDefault();
        target.click();
      }
    }
  };

  const select = (row: SwitcherRow) => {
    notifyNavigate(onNavigate, {
      source: 'switcher',
      fromSub: currentSub,
      toSub: row.app.sub,
      href: row.href,
    });
    close();
  };

  return (
    <div ref={wrapperRef} className="pr-switcher">
      <button
        ref={triggerRef}
        type="button"
        className="pr-switcher__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="pr-switcher__name">{triggerName}</span>
        <ChevronDown size={15} aria-hidden />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          className="pr-switcher__menu"
          role="menu"
          aria-label={messages.apps}
          onKeyDown={onMenuKey}
        >
          {rows.map((row, index) => {
            const body = (
              <>
                <span className="pr-switcher__num" aria-hidden>
                  {index + 1}
                </span>
                <span className="pr-switcher__copy">
                  <span className="pr-switcher__app">{row.name}</span>
                  <span className="pr-switcher__page">{row.pageLabel}</span>
                </span>
                {row.current ? <span className="pr-switcher__here">{messages.here}</span> : null}
              </>
            );
            return row.current ? (
              <LinkComponent
                key={row.app.sub}
                role="menuitem"
                className="pr-switcher__item pr-switcher__item--current"
                href={row.href}
                data-active="true"
                aria-current={row.atStart ? 'page' : undefined}
                onClick={() => select(row)}
              >
                {body}
              </LinkComponent>
            ) : (
              <a
                key={row.app.sub}
                role="menuitem"
                className="pr-switcher__item"
                href={row.href}
                onClick={() => select(row)}
              >
                {body}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export interface WayBackChipProps {
  target: WayBackTarget;
  currentSub?: string;
  locale: StaffLocale;
  nav: ShellNavigationValue;
}

/** «← LiveOps»: opens the exact page the person left in the app they came from. */
export function WayBackChip({ target, currentSub, locale, nav }: WayBackChipProps) {
  const app = findApp(target.s);
  if (!app || app.sub === currentSub) return null;
  const start = appHref(app);
  if (!start) return null;
  const name = switcherName(app);
  const href = withWayBack(`${originOf(start)}${target.p}`, currentSub, nav.currentPath);
  return (
    <a
      className="pr-wayback"
      href={href}
      title={MESSAGES[locale].back(name)}
      aria-label={MESSAGES[locale].back(name)}
      onClick={() =>
        notifyNavigate(nav.onNavigate, {
          source: 'wayback',
          fromSub: currentSub,
          toSub: app.sub,
          href,
        })
      }
    >
      <ArrowLeft size={14} aria-hidden />
      <span className="pr-wayback__name">{name}</span>
    </a>
  );
}

export interface SwitcherSectionProps {
  nav: ShellNavigationValue;
  apps: AppLink[];
  /** The app that is marked as current: `appSub`, else the header's `currentSub`. */
  currentSub?: string;
  /** The header's own `currentSub`, used to record visits when `appSub` is absent. */
  headerSub?: string;
  locale: StaffLocale;
}

/** The way back and the app switcher, with the visit memory they read and write. */
export function SwitcherSection({
  nav,
  apps,
  currentSub,
  headerSub,
  locale,
}: SwitcherSectionProps) {
  const memory = useNavMemory(nav.currentPath);
  useHeaderVisitRecorder(nav, headerSub);
  return (
    <div className="pr-global-header__switch">
      {nav.wayBack ? (
        <WayBackChip target={nav.wayBack} currentSub={currentSub} locale={locale} nav={nav} />
      ) : null}
      <AppSwitcher apps={apps} currentSub={currentSub} locale={locale} memory={memory} nav={nav} />
    </div>
  );
}
