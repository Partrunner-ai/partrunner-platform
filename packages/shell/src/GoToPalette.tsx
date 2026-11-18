import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { appHref, type AppLink } from '@partrunner-ai/app-registry';
import { appBarLabel, originOf, useNavMemory } from './AppBar';
import { switcherRows, switcherName } from './AppSwitcher';
import { isStorableNavPath } from './navMemory';
import { findApp } from '@partrunner-ai/app-registry';
import { withWayBack } from './wayBack';
import { notifyNavigate, type ShellNavigationValue } from './NavigationContext';
import type { StaffLocale, StaffShellPage } from './StaffShellContext';
import { useDismiss } from './useDismiss';

interface PaletteMessages {
  trigger: string;
  field: string;
  back: string;
  placeholder: string;
  recent: string;
  pages: string;
  apps: string;
  hint: string;
  empty: (query: string) => string;
  open: (app: string) => string;
}

const MESSAGES: Record<StaffLocale, PaletteMessages> = {
  es: {
    trigger: 'Ir a…',
    field: 'Buscar o ir a…',
    back: 'Volver',
    placeholder: 'Buscar páginas y apps',
    recent: 'Recientes',
    pages: 'Páginas',
    apps: 'Apps',
    hint: 'Escribe para buscar',
    empty: (query) => `Sin resultados para “${query}”`,
    open: (app) => `Abrir ${app}`,
  },
  en: {
    trigger: 'Go to…',
    field: 'Search or go to…',
    back: 'Back',
    placeholder: 'Search pages and apps',
    recent: 'Recent',
    pages: 'Pages',
    apps: 'Apps',
    hint: 'Type to search',
    empty: (query) => `No results for “${query}”`,
    open: (app) => `Open ${app}`,
  },
};

const RESULT_LIMIT = 10;

type EntryGroup = 'back' | 'recent' | 'pages' | 'apps';

interface Entry {
  key: string;
  group: EntryGroup;
  label: string;
  /** Second line: section and app name. */
  meta: string;
  /** What the navigation event reports. */
  source: 'goto' | 'switcher' | 'wayback';
  /** Path for a page of this app, else an absolute URL. */
  href: string;
  /** Rendered through the host's router. */
  routed: boolean;
  external?: boolean;
  sub: string;
}

/** Lowercase without accents, so «facturacion» finds «Facturación». */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function matches(query: string, ...parts: Array<string | undefined>): boolean {
  const haystack = foldText(parts.filter(Boolean).join(' '));
  return foldText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

/** Path plus query of a URL on this origin, else `null`. */
function sameOriginPath(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

function dedupeKey(sub: string, href: string): string {
  try {
    const url = new URL(href, 'https://x.invalid');
    return `${sub}|${url.pathname}${url.search}`;
  } catch {
    return `${sub}|${href}`;
  }
}

export interface GoToPaletteProps {
  nav: ShellNavigationValue;
  apps: AppLink[];
  currentSub?: string;
  locale: StaffLocale;
  /** Optional cross-app page index from the staff-shell context. */
  extraPages?: readonly StaffShellPage[];
  /** `'field'` renders the trigger as a search field (switcher mode). */
  variant?: 'button' | 'field';
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.getAttribute('contenteditable') === 'true' ||
    target.getAttribute('contenteditable') === ''
  );
}

function isMac(): boolean {
  if (typeof navigator === 'undefined') return true;
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
}

/**
 * «Ir a» command palette: recent pages first, then a search over this app's
 * pages, recents, the host's cross-app index, and the apps themselves.
 */
export function GoToPalette({
  nav,
  apps,
  currentSub,
  locale,
  extraPages,
  variant = 'button',
}: GoToPaletteProps) {
  const messages = MESSAGES[locale];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [hint, setHint] = useState('⌘K');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const memory = useNavMemory(`${open}`);
  const { LinkComponent, currentPath, onNavigate } = nav;
  const appSub = nav.appSub ?? currentSub;

  useEffect(() => {
    if (!isMac()) setHint('Ctrl K');
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
    queueMicrotask(() => triggerRef.current?.focus());
  }, []);

  useDismiss(panelRef, open, close, triggerRef);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // The shell listens on document (bubble phase). A page that owns its own ⌘K
      // or «/» wins by listening on window (capture phase) and calling preventDefault().
      if (event.defaultPrevented) return;
      // Mac: only ⌘K (Ctrl+K is a text-editing key there). Elsewhere: only Ctrl+K.
      // The shell also ignores ⌘K with Shift or Alt held.
      const modifier = isMac() ? event.metaKey : event.ctrlKey;
      if (modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      // «/» opens the palette too, for browsers and launcher apps that take ⌘K
      // first. Never while the person types, and never with Ctrl, Meta, or Alt.
      // Shift is fine: «/» is Shift+7 on some layouts.
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const entries = useMemo<Entry[]>(() => {
    if (!open) return [];
    const appByLabel = new Map(apps.map((app) => [app.sub, app]));
    const appName = (sub: string): string => {
      const app = appByLabel.get(sub);
      return app ? appBarLabel(app, locale) : sub;
    };
    const meta = (sub: string, section?: string) =>
      [section, appName(sub)].filter(Boolean).join(' · ');

    const crossApp = (href: string) => withWayBack(href, appSub, currentPath);
    const wb = nav.wayBack && nav.wayBack.s !== appSub ? nav.wayBack : null;
    const wbApp = wb ? findApp(wb.s) : undefined;
    const backEntries: Entry[] =
      wb && wbApp && appByLabel.has(wb.s)
        ? [
            {
              key: 'b:wayback',
              group: 'back',
              source: 'wayback',
              label: switcherName(wbApp),
              meta: '',
              href: crossApp(`${originOf(appHref(wbApp))}${wb.p}`),
              routed: false,
              sub: wb.s,
            },
          ]
        : [];

    const recents: Entry[] = [];
    for (const item of memory.recent) {
      const app = appByLabel.get(item.s);
      if (!app || !isStorableNavPath(item.p)) continue;
      if (item.s === appSub && item.p === currentPath) continue;
      if (wb && item.s === wb.s && item.p === wb.p) continue;
      const here = item.s === appSub;
      recents.push({
        key: `r:${item.s}${item.p}`,
        group: 'recent',
        source: 'goto',
        label: item.l,
        meta: appName(item.s),
        href: here ? item.p : crossApp(`${originOf(appHref(app))}${item.p}`),
        routed: here,
        sub: item.s,
      });
    }

    if (query.trim() === '') {
      const rows = switcherRows(apps, appSub, currentPath, memory, locale).map<Entry>((row) => ({
        key: `a:${row.app.sub}`,
        group: 'apps',
        source: 'switcher',
        label: row.name,
        meta: row.pageLabel,
        href: row.href,
        routed: row.current,
        sub: row.app.sub,
      }));
      return [...backEntries, ...recents, ...rows];
    }

    const own: Entry[] = nav.pages.map((page, index) => ({
      key: `p:${index}`,
      group: 'pages',
      source: 'goto',
      label: page.label,
      meta: meta(appSub ?? '', page.sectionLabel),
      href: page.href,
      routed: !page.external,
      external: page.external,
      sub: appSub ?? '',
    }));

    const index: Entry[] = (extraPages ?? []).flatMap((page, i) => {
      // Only http(s) URLs: a `javascript:` href from a host index is dropped.
      if (!/^https?:\/\//i.test(page.href)) return [];
      const local = page.app === appSub ? sameOriginPath(page.href) : null;
      return [
        {
          key: `x:${i}`,
          group: 'pages' as const,
          source: 'goto' as const,
          label: page.label,
          meta: meta(page.app, page.section),
          href: local ?? (page.app === appSub ? page.href : crossApp(page.href)),
          routed: local !== null,
          sub: page.app,
        },
      ];
    });

    const appEntries: Entry[] = apps.map((app) => ({
      key: `a:${app.sub}`,
      group: 'apps',
      source: 'switcher',
      label: messages.open(appBarLabel(app, locale)),
      meta: '',
      href: app.sub === appSub ? appHref(app)! : crossApp(appHref(app)!),
      routed: false,
      sub: app.sub,
    }));

    const seen = new Set<string>();
    const out: Entry[] = [];
    for (const entry of [...own, ...recents, ...index, ...appEntries]) {
      const haystack = entry.group === 'apps' ? [entry.label, appName(entry.sub)] : [entry.label, entry.meta];
      if (!matches(query, ...haystack)) continue;
      const id = dedupeKey(entry.sub, entry.href);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(entry);
      if (out.length >= RESULT_LIMIT) break;
    }
    return out;
  }, [open, query, memory, nav.pages, nav.wayBack, extraPages, apps, appSub, currentPath, locale, messages]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const safeActive = Math.min(active, Math.max(entries.length - 1, 0));
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[id='${optionId(safeActive)}']`)
      ?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, safeActive]);

  const onInputKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((value) => (entries.length === 0 ? 0 : (value + 1) % entries.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((value) => (entries.length === 0 ? 0 : (value - 1 + entries.length) % entries.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      listRef.current
        ?.querySelector<HTMLElement>(`[id='${optionId(safeActive)}'] a`)
        ?.click();
    } else if (event.key === 'Tab') {
      // The input is the only control in the dialog; keep focus inside it.
      event.preventDefault();
    }
  };

  const select = (entry: Entry) => {
    notifyNavigate(onNavigate, {
      source: entry.source,
      fromSub: appSub,
      toSub: entry.external ? undefined : entry.sub || undefined,
      href: entry.href,
    });
    setOpen(false);
    setQuery('');
  };

  const heading: Record<EntryGroup, string> = {
    back: messages.back,
    recent: messages.recent,
    pages: messages.pages,
    apps: messages.apps,
  };

  const body = (entry: Entry) => (
    <>
      <span className="pr-goto__label">{entry.label}</span>
      {entry.meta ? <span className="pr-goto__meta">{entry.meta}</span> : null}
    </>
  );

  const dialog = open ? (
    <div className="pr-goto__backdrop">
      <div
        ref={panelRef}
        className="pr-goto"
        role="dialog"
        aria-modal="true"
        aria-label={messages.trigger}
      >
        <div className="pr-goto__search">
          <Search size={16} aria-hidden />
          <input
            autoFocus
            className="pr-goto__input"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={entries.length > 0}
            aria-controls={entries.length > 0 ? `${baseId}-list` : undefined}
            aria-activedescendant={entries.length > 0 ? optionId(safeActive) : undefined}
            aria-label={messages.placeholder}
            placeholder={messages.placeholder}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKey}
          />
        </div>
        <div ref={listRef} className="pr-goto__results">
          {entries.length === 0 ? (
            <p className="pr-goto__empty">
              {query.trim() === '' ? messages.hint : messages.empty(query.trim())}
            </p>
          ) : (
            <div id={`${baseId}-list`} role="listbox" aria-label={messages.trigger}>
              {entries.map((entry, index) => (
                <div key={entry.key} role="presentation">
                  {index === 0 || entries[index - 1]!.group !== entry.group ? (
                    <div className="pr-goto__heading" role="presentation">
                      {heading[entry.group]}
                    </div>
                  ) : null}
                  <div
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === safeActive}
                    className="pr-goto__option"
                    data-active={index === safeActive ? 'true' : undefined}
                    onMouseMove={() => setActive(index)}
                  >
                    {entry.routed ? (
                      <LinkComponent
                        href={entry.href}
                        className="pr-goto__link"
                        onClick={() => select(entry)}
                      >
                        {body(entry)}
                      </LinkComponent>
                    ) : (
                      <a
                        className="pr-goto__link"
                        href={entry.href}
                        target={entry.external ? '_blank' : undefined}
                        rel={entry.external ? 'noreferrer noopener' : undefined}
                        onClick={() => select(entry)}
                      >
                        {body(entry)}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`pr-goto-trigger${variant === 'field' ? ' pr-goto-trigger--field' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts={hint === '⌘K' ? 'Meta+K /' : 'Control+K /'}
        onClick={() => setOpen(true)}
      >
        <Search size={15} aria-hidden />
        <span className="pr-goto-trigger__label">
          {variant === 'field' ? messages.field : messages.trigger}
        </span>
        <kbd className="pr-goto-trigger__hint">{hint}</kbd>
      </button>
      {dialog && typeof document !== 'undefined' ? createPortal(dialog, document.body) : null}
    </>
  );
}
