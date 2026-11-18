import { useState, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { APP_BAR_ORDER, type AppLink } from '@partrunner-ai/app-registry';
import { appBarApps, useNavMemory } from './AppBar';
import { switcherRows, type SwitcherRow } from './AppSwitcher';
import { notifyNavigate, type ShellNavigationValue } from './NavigationContext';
import type { StaffLocale, StaffShellContextValue } from './StaffShellContext';

/** The most apps a person can mark. */
export const FAVORITE_APPS_LIMIT = 5;

interface FavoriteMessages {
  title: string;
  edit: string;
  done: string;
  choose: string;
  max: string;
  editLabel: string;
}

const MESSAGES: Record<StaffLocale, FavoriteMessages> = {
  es: {
    title: 'Mis apps',
    edit: 'Editar',
    done: 'Listo',
    choose: 'Elige tus apps',
    max: 'Máximo 5',
    editLabel: 'Elegir mis apps',
  },
  en: {
    title: 'My apps',
    edit: 'Edit',
    done: 'Done',
    choose: 'Choose your apps',
    max: 'Maximum 5',
    editLabel: 'Choose my apps',
  },
};

function tileStyle(app: AppLink): CSSProperties {
  return {
    ['--pr-tile-bg' as string]: `var(--pr-tone-${app.tone}-bg)`,
    ['--pr-tile-fg' as string]: `var(--pr-tone-${app.tone}-fg)`,
  };
}

/** Subs in `APP_BAR_ORDER` (unlisted apps last), as `setFavoriteApps` receives them. */
function inBarOrder(subs: readonly string[]): string[] {
  const rank = (sub: string) => {
    const index = APP_BAR_ORDER.indexOf(sub);
    return index === -1 ? APP_BAR_ORDER.length : index;
  };
  return [...subs].sort((a, b) => rank(a) - rank(b));
}

export interface FavoriteAppsProps {
  nav: ShellNavigationValue;
  staff: StaffShellContextValue | null;
  /** Called when a row opens, so the mobile drawer can close. */
  onOpen?: () => void;
}

/**
 * «Mis apps» at the top of the sidebar: the apps the person marked, each with
 * the page it opens. Renders nothing without a list to show or to edit.
 */
export function FavoriteApps({ nav, staff, onOpen }: FavoriteAppsProps) {
  const locale: StaffLocale = staff?.preferences.locale ?? 'es';
  const messages = MESSAGES[locale];
  const memory = useNavMemory(nav.currentPath);
  const [editing, setEditing] = useState(false);
  const { LinkComponent, currentPath, onNavigate, appSub } = nav;

  const setFavorites = staff?.setFavoriteApps;
  const apps = appBarApps();
  const known = new Set(apps.map((app) => app.sub));
  const favorites = (staff?.favoriteApps ?? []).filter((sub, index, list) => {
    return known.has(sub) && list.indexOf(sub) === index;
  });
  if (favorites.length === 0 && !setFavorites) return null;

  const rowsBySub = new Map(
    switcherRows(apps, appSub, currentPath, memory, locale).map((row) => [row.app.sub, row]),
  );
  const rows = favorites.flatMap((sub) => rowsBySub.get(sub) ?? []);

  const toggle = (sub: string) => {
    if (!setFavorites) return;
    const next = favorites.includes(sub) ? favorites.filter((item) => item !== sub) : [...favorites, sub];
    if (next.length > FAVORITE_APPS_LIMIT) return;
    setFavorites(inBarOrder(next));
  };

  const open = (row: SwitcherRow) => {
    notifyNavigate(onNavigate, {
      source: 'favorites',
      fromSub: appSub,
      toSub: row.app.sub,
      href: row.href,
    });
    onOpen?.();
  };

  const body = (row: SwitcherRow) => (
    <>
      <span className="pr-favs__tile" style={tileStyle(row.app)} aria-hidden>
        <row.app.icon size={15} aria-hidden />
      </span>
      <span className="pr-favs__copy">
        <span className="pr-favs__name">{row.name}</span>
        <span className="pr-favs__page">{row.pageLabel}</span>
      </span>
    </>
  );

  return (
    <section className="pr-favs" aria-label={messages.title}>
      <div className="pr-favs__head">
        <span className="pr-favs__title">{messages.title}</span>
        {setFavorites ? (
          <button
            type="button"
            className="pr-favs__edit"
            aria-pressed={editing}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? messages.done : messages.edit}
          </button>
        ) : null}
      </div>
      {editing ? (
        <ul className="pr-favs__list" aria-label={messages.editLabel}>
          {apps.map((app) => {
            const checked = favorites.includes(app.sub);
            const full = !checked && favorites.length >= FAVORITE_APPS_LIMIT;
            const name = rowsBySub.get(app.sub)?.name ?? app.label;
            return (
              <li key={app.sub}>
                <label className="pr-favs__choice" data-disabled={full ? 'true' : undefined}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={full}
                    onChange={() => toggle(app.sub)}
                  />
                  <span className="pr-favs__tile" style={tileStyle(app)} aria-hidden>
                    <app.icon size={15} aria-hidden />
                  </span>
                  <span className="pr-favs__copy">
                    <span className="pr-favs__name">{name}</span>
                    {full ? <span className="pr-favs__page">{messages.max}</span> : null}
                  </span>
                  {checked ? <Check size={14} aria-hidden /> : null}
                </label>
              </li>
            );
          })}
        </ul>
      ) : rows.length === 0 ? (
        <button type="button" className="pr-favs__row pr-favs__empty" onClick={() => setEditing(true)}>
          <span className="pr-favs__name">{messages.choose}</span>
        </button>
      ) : (
        <ul className="pr-favs__list">
          {rows.map((row) => (
            <li key={row.app.sub}>
              {row.current ? (
                <LinkComponent
                  className="pr-favs__row pr-favs__row--current"
                  href={row.href}
                  title={row.name}
                  data-active="true"
                  aria-current={row.atStart ? 'page' : undefined}
                  onClick={() => open(row)}
                >
                  {body(row)}
                </LinkComponent>
              ) : (
                <a className="pr-favs__row" href={row.href} title={row.name} onClick={() => open(row)}>
                  {body(row)}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
