import { ArrowLeft } from 'lucide-react';
import { appHref, findApp } from '@partrunner-ai/app-registry';
import { notifyNavigate, type ShellNavigationValue } from './NavigationContext';
import { navAppName, originOf, useHeaderVisitRecorder } from './navShared';
import type { StaffLocale } from './StaffShellContext';
import { withWayBack, type WayBackTarget } from './wayBack';

function backLabel(locale: StaffLocale, app: string): string {
  return locale === 'en' ? `Back to ${app}` : `Volver a ${app}`;
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
  const name = navAppName(app);
  const href = withWayBack(`${originOf(start)}${target.p}`, currentSub, nav.currentPath);
  return (
    <a
      className="pr-wayback"
      href={href}
      title={backLabel(locale, name)}
      aria-label={backLabel(locale, name)}
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

export interface WayBackSectionProps {
  nav: ShellNavigationValue;
  /** The app that is marked as current: `appSub`, else the header's `currentSub`. */
  currentSub?: string;
  /** The header's own `currentSub`, used to record visits when `appSub` is absent. */
  headerSub?: string;
  locale: StaffLocale;
}

/** The way back chip, with the visit recorder for a header that has no `appSub`. */
export function WayBackSection({ nav, currentSub, headerSub, locale }: WayBackSectionProps) {
  useHeaderVisitRecorder(nav, headerSub);
  return (
    <div className="pr-global-header__switch">
      {nav.wayBack ? (
        <WayBackChip target={nav.wayBack} currentSub={currentSub} locale={locale} nav={nav} />
      ) : null}
    </div>
  );
}
