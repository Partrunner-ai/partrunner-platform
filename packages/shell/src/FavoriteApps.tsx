import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { APP_NAV_ORDER, type AppLink } from '@partrunner-ai/app-registry';
import { appNavApps, navAppRows, useNavMemory, type NavAppRow } from './navShared';
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
  saveError: string;
}

const MESSAGES: Record<StaffLocale, FavoriteMessages> = {
  es: {
    title: 'Mis apps',
    edit: 'Editar',
    done: 'Listo',
    choose: 'Elige tus apps',
    max: 'Máximo 5',
    editLabel: 'Elegir mis apps',
    saveError: 'No se pudo guardar. Intenta de nuevo.',
  },
  en: {
    title: 'My apps',
    edit: 'Edit',
    done: 'Done',
    choose: 'Choose your apps',
    max: 'Maximum 5',
    editLabel: 'Choose my apps',
    saveError: 'Could not save. Try again.',
  },
};

function tileStyle(app: AppLink): CSSProperties {
  return {
    ['--pr-tile-bg' as string]: `var(--pr-tone-${app.tone}-bg)`,
    ['--pr-tile-fg' as string]: `var(--pr-tone-${app.tone}-fg)`,
  };
}

/** Subs in `APP_NAV_ORDER` (unlisted apps last), as `setFavoriteApps` receives them. */
function inBarOrder(subs: readonly string[]): string[] {
  const rank = (sub: string) => {
    const index = APP_NAV_ORDER.indexOf(sub);
    return index === -1 ? APP_NAV_ORDER.length : index;
  };
  return [...subs].sort((a, b) => rank(a) - rank(b));
}

export interface FavoriteAppsProps {
  nav: ShellNavigationValue;
  staff: StaffShellContextValue | null;
  /**
   * The list from the shared cookie. It draws the rows before the staff
   * snapshot arrives (read-only: «Editar» is disabled). The snapshot list wins
   * once it has `favoriteApps`. `undefined` means no cookie yet.
   */
  initialFavorites?: readonly string[];
  /** Called when a row opens, so the mobile drawer can close. */
  onOpen?: () => void;
}

/**
 * «Mis apps» at the top of the sidebar: the apps the person marked, each with
 * the page it opens. Renders nothing without a list to show or to edit.
 */
export function FavoriteApps({ nav, staff, initialFavorites, onOpen }: FavoriteAppsProps) {
  const locale: StaffLocale = staff?.preferences.locale ?? 'es';
  const messages = MESSAGES[locale];
  const memory = useNavMemory(nav.currentPath);
  const [editing, setEditing] = useState(false);
  // The edit shows at once (optimistic). A failed save drops it, so the host list shows.
  const [local, setLocal] = useState<string[] | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // The cookie only stands in until a staff context exists; then the snapshot
  // is the only source (a cookie of another person never outlives it).
  const hostList = staff ? (staff.preferences.favoriteApps ?? []) : (initialFavorites ?? []);
  const hostKey = hostList.join(',');
  // One id per save: only the latest save may act on a failure, and only while
  // the local edit is still there. `mounted` guards a result after unmount.
  const latestSave = useRef(0);
  const localRef = useRef<string[] | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    // The host list changed (its own optimistic update or a refresh): it wins.
    localRef.current = null;
    setLocal(null);
  }, [hostKey]);
  const { LinkComponent, currentPath, onNavigate, appSub } = nav;

  const setFavorites = staff?.setFavoriteApps;
  const apps = appNavApps();
  const known = new Set(apps.map((app) => app.sub));
  // The list to edit and to save is the host list as it is. Subs unknown to the
  // installed registry (a newer app) are dropped only when rows are drawn.
  const stored = local ?? hostList;
  const favorites = stored.filter((sub, index, list) => {
    return known.has(sub) && list.indexOf(sub) === index;
  });
  // Before the snapshot (no staff context yet) a cookie list, even an empty one,
  // keeps the section in place; «Editar» waits for the setter.
  const pending = !setFavorites && staff === null && initialFavorites !== undefined;
  if (favorites.length === 0 && !setFavorites && !pending) return null;

  const rowsBySub = new Map(
    navAppRows(apps, appSub, currentPath, memory, locale).map((row) => [row.app.sub, row]),
  );
  const rows = favorites.flatMap((sub) => rowsBySub.get(sub) ?? []);

  const toggle = (sub: string) => {
    if (!setFavorites) return;
    const has = stored.includes(sub);
    if (!has && stored.length >= FAVORITE_APPS_LIMIT) return;
    const ordered = inBarOrder(has ? stored.filter((item) => item !== sub) : [...stored, sub]);
    const id = latestSave.current + 1;
    latestSave.current = id;
    const fail = () => {
      if (!mounted.current || id !== latestSave.current || localRef.current === null) return;
      localRef.current = null;
      setLocal(null);
      setSaveFailed(true);
    };
    setSaveFailed(false);
    localRef.current = ordered;
    setLocal(ordered);
    try {
      const result = setFavorites(ordered) as unknown;
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        Promise.resolve(result).catch(fail);
      }
    } catch {
      // After the change event: a controlled checkbox must see the new value first.
      queueMicrotask(fail);
    }
  };

  const open = (row: NavAppRow) => {
    notifyNavigate(onNavigate, {
      source: 'favorites',
      fromSub: appSub,
      toSub: row.app.sub,
      href: row.href,
    });
    onOpen?.();
  };

  const body = (row: NavAppRow) => (
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
            onClick={() => {
              setEditing((value) => !value);
              setSaveFailed(false);
            }}
          >
            {editing ? messages.done : messages.edit}
          </button>
        ) : pending ? (
          <button type="button" className="pr-favs__edit" disabled aria-pressed={false}>
            {messages.edit}
          </button>
        ) : null}
      </div>
      {/* Always in the tree, so a screen reader announces the text when it arrives. */}
      <p className="pr-favs__error" role="status">
        {saveFailed ? messages.saveError : ''}
      </p>
      {editing ? (
        <ul className="pr-favs__list" aria-label={messages.editLabel}>
          {apps.map((app) => {
            const checked = favorites.includes(app.sub);
            const full = !checked && stored.length >= FAVORITE_APPS_LIMIT;
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
        <button
          type="button"
          className="pr-favs__row pr-favs__empty"
          disabled={pending}
          onClick={() => setEditing(true)}
        >
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
