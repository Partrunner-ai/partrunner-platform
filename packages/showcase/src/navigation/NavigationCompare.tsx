import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  AppShell,
  GlobalHeader,
  StaffShellProvider,
  type LinkComponent,
  type ShellNavigateEvent,
  type StaffShellContextValue,
  type StaffShellPage,
} from '@partrunner-ai/shell';
import { displayHost, pageLabel, registryOrigin, SIM_APPS, simApp, simPages } from './fixtures';
import {
  clearNavState,
  DEFAULT_FAVORITES,
  FAVORITES_STORAGE_KEY,
  OPTION_STORAGE_KEY,
  resolveInApp,
  routeLink,
  sameLocation,
  TASKS,
  writeWayBack,
  type NavOption,
  type NavTask,
  type SimLocation,
} from './simulation';
import './navigation.css';

const OPTIONS: Array<{ id: NavOption; label: string; hint: string }> = [
  { id: 'a', label: 'A · Barra de apps', hint: 'Todas las apps como barra en el encabezado.' },
  { id: 'b', label: 'B · Selector', hint: 'El nombre de la app abre un menú con todas las apps.' },
  { id: 'c', label: 'C · Selector + Mis apps', hint: 'Mis apps en el menú lateral, la cuadrícula de apps arriba a la derecha, «Buscar o ir a…» y «← app».' },
];

const SELECTOR_KEY = 'pr-showcase-nav-selector';
const START: SimLocation = { app: 'liveops', path: '/general/routes' };

function readOption(): NavOption {
  try {
    const value = window.localStorage.getItem(OPTION_STORAGE_KEY);
    if (value === 'a' || value === 'b' || value === 'c') return value;
  } catch {
    /* storage can be blocked */
  }
  return 'b';
}

function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  } catch {
    /* use the default */
  }
  return [...DEFAULT_FAVORITES];
}

const PAGES: StaffShellPage[] = SIM_APPS.flatMap((app) =>
  simPages(app).map((page) => ({
    app: app.sub,
    label: page.label,
    href: `${registryOrigin(app.sub)}${page.href}`,
    section: page.section,
  })),
);

/**
 * Options A, B and C of the navigation proposal in one view, over simulated
 * apps. A click never leaves the page: links to a registry app change the
 * simulated app, and every other link is blocked.
 */
export function NavigationCompare({ initialOption }: { initialOption?: NavOption } = {}) {
  const [option, setOption] = useState<NavOption>(() => initialOption ?? readOption());
  const [loc, setLoc] = useState<SimLocation>(START);
  const [history, setHistory] = useState<SimLocation[]>([START]);
  const [nonce, setNonce] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [loads, setLoads] = useState(0);
  const [task, setTask] = useState<NavTask | null>(null);
  const [reached, setReached] = useState<{ clicks: number; loads: number } | null>(null);
  const [notice, setNotice] = useState('');
  const [lastEvent, setLastEvent] = useState('');
  const [selector, setSelector] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SELECTOR_KEY) === 'yes';
    } catch {
      return false;
    }
  });
  const [favorites, setFavoritesState] = useState<string[]>(readFavorites);

  const frameRef = useRef<HTMLDivElement>(null);
  const locRef = useRef(loc);
  locRef.current = loc;
  const countsRef = useRef({ clicks, loads });
  countsRef.current = { clicks, loads };
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();

  const chooseOption = (next: NavOption) => {
    setOption(next);
    try {
      window.localStorage.setItem(OPTION_STORAGE_KEY, next);
    } catch {
      /* storage can be blocked */
    }
  };

  const chooseSelector = (next: boolean) => {
    setSelector(next);
    try {
      window.localStorage.setItem(SELECTOR_KEY, next ? 'yes' : 'no');
    } catch {
      /* storage can be blocked */
    }
  };

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 4000);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  /** One simulated navigation: in the same app, or a new app load. */
  const goTo = useCallback((sub: string, rawPath: string) => {
    const current = locRef.current;
    if (!simApp(sub)) return;
    const next = { app: sub, path: resolveInApp(sub, rawPath) };
    if (sameLocation(current, next)) return;
    if (sub !== current.app) {
      // The same key the shell writes for a real cross-app link.
      writeWayBack(current);
      setLoads((value) => value + 1);
    }
    setHistory((list) => [...list, next]);
    setLoc(next);
  }, []);

  const goBack = () => {
    if (history.length < 2) return;
    const previous = history[history.length - 2]!;
    if (previous.app !== loc.app) setLoads((value) => value + 1);
    setHistory(history.slice(0, -1));
    setLoc(previous);
  };

  // Counts pointer clicks and keeps every link inside the simulation. It
  // listens on the document because the «Ir a» palette renders in a portal.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const inFrame = frameRef.current?.contains(target) ?? false;
      if (!inFrame && !target.closest('.pr-goto')) return;

      const control = target.closest('a[href], button, label, [role="menuitem"]');
      const checkbox = target instanceof HTMLInputElement && target.closest('label');
      if (control && !checkbox && event.button === 0 && event.detail > 0) {
        setClicks((value) => value + 1);
      }

      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;
      const route = routeLink(anchor.href, window.location.origin);
      if (route.kind === 'local') {
        // The demo router (the LinkComponent) runs next; the page never navigates.
        event.preventDefault();
      } else if (route.kind === 'app') {
        event.preventDefault();
        // After the event: a render now would unmount the link before React
        // runs its onClick (the shell's onNavigate call).
        setTimeout(() => goTo(route.sub, route.path), 0);
      } else {
        event.preventDefault();
        showNotice(`Enlace bloqueado: ${route.host} no es una app de la simulación.`);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [goTo, showNotice]);

  // Freeze the counters at the first moment the task goal is open.
  useEffect(() => {
    if (task && !reached && sameLocation(loc, task.goal)) setReached({ ...countsRef.current });
  }, [loc, task, reached]);

  const reset = (next: NavTask | null) => {
    clearNavState();
    const start = next?.start ?? START;
    next?.prepare?.();
    setFavoritesState([...DEFAULT_FAVORITES]);
    setLoc(start);
    setHistory([start]);
    setClicks(0);
    setLoads(0);
    setReached(null);
    setTask(next);
    setNotice('');
    setLastEvent('');
    setNonce((value) => value + 1);
  };

  const Link = useMemo<LinkComponent>(
    () =>
      function DemoLink({ href, children, onClick, ...rest }) {
        return (
          <a
            href={href}
            {...rest}
            onClick={(event) => {
              event.preventDefault();
              onClick?.();
              goTo(locRef.current.app, href);
            }}
          >
            {children}
          </a>
        );
      },
    [goTo],
  );

  const setFavorites = useCallback((subs: readonly string[]) => {
    setFavoritesState([...subs]);
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(subs));
    } catch {
      /* storage can be blocked */
    }
  }, []);

  const staff = useMemo<StaffShellContextValue>(
    () => ({
      user: { id: 'demo', name: 'Ada Lovelace', email: 'ada@example.com' },
      profileHref: '#profile',
      preferences: { locale: 'es', theme: 'system' },
      notifications: { unreadCount: 0, href: '#notifications', items: [] },
      setTheme: () => {},
      setLocale: () => {},
      pages: PAGES,
      favoriteApps: favorites,
      setFavoriteApps: setFavorites,
    }),
    [favorites, setFavorites],
  );

  const app = simApp(loc.app) ?? SIM_APPS[0]!;
  const title = pageLabel(app, loc.path);
  const mode = option === 'a' ? 'appbar' : 'switcher';
  const onNavigate = useCallback((event: ShellNavigateEvent) => {
    setLastEvent(`${event.source}: ${event.fromSub ?? '—'} → ${event.toSub ?? '—'}`);
  }, []);

  return (
    <div className="nav-sim">
      <div className="nav-sim__intro">
        <h1 className="nav-sim__title">Navegación</h1>
        <p className="nav-sim__lead">
          Tres opciones sobre apps simuladas. Ningún clic abre una app real.
        </p>
        <div className="nav-sim__toggle" role="group" aria-label="Opción de navegación">
          {OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nav-sim__option"
              aria-pressed={option === item.id}
              onClick={() => chooseOption(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {option === 'c' ? (
          <div className="nav-sim__sub" role="group" aria-label="Selector en el nombre">
            <span className="nav-sim__sub-label">Selector en el nombre:</span>
            {[
              { value: true, label: 'Sí' },
              { value: false, label: 'No' },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className="nav-sim__option nav-sim__option--small"
                aria-pressed={selector === item.value}
                onClick={() => chooseSelector(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
        <p className="nav-sim__hint">
          {OPTIONS.find((item) => item.id === option)!.hint} Prueba también «/» o ⌘K / Ctrl+K para «Ir a».
        </p>
        <section className="nav-sim__tasks" aria-label="Tareas para probar">
          <h2 className="nav-sim__tasks-title">Tareas para probar</h2>
          <ol className="nav-sim__task-list">
            {TASKS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="nav-sim__task"
                  data-active={task?.id === item.id ? 'true' : undefined}
                  onClick={() => reset(item)}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ol>
          {task ? (
            <p className="nav-sim__goal" data-reached={reached ? 'true' : undefined} role="status">
              {reached
                ? `Meta alcanzada: ${reached.clicks} ${reached.clicks === 1 ? 'clic' : 'clics'}, ${reached.loads} ${reached.loads === 1 ? 'carga' : 'cargas'} de app.`
                : 'Haz la tarea con el menú. Se cuentan tus clics.'}
            </p>
          ) : null}
        </section>
      </div>

      <div className="nav-sim__frame" ref={frameRef}>
        <div className="nav-sim__browser">
          <button
            type="button"
            className="nav-sim__back"
            onClick={goBack}
            disabled={history.length < 2}
            aria-label="Atrás"
            title="Atrás"
          >
            <ArrowLeft size={15} aria-hidden />
          </button>
          <div className="nav-sim__address" data-testid="address-bar">
            <span className="nav-sim__lock" aria-hidden>
              https://
            </span>
            {displayHost(loc.app)}
            {loc.path}
          </div>
          <div className="nav-sim__counters" aria-label="Contadores">
            <span>
              Clics <strong data-testid="clicks">{clicks}</strong>
            </span>
            <span>
              Cargas de app <strong data-testid="loads">{loads}</strong>
            </span>
          </div>
          <button type="button" className="nav-sim__reset" onClick={() => reset(null)}>
            Reiniciar
          </button>
        </div>
        {notice ? (
          <p className="nav-sim__notice" role="status">
            {notice}
          </p>
        ) : null}
        <div className="nav-sim__viewport">
          <StaffShellProvider value={staff}>
            <AppShell
              key={`${loc.app}:${nonce}`}
              sections={app.sections}
              navigation={mode}
              appsInSidebar={option === 'c'}
              appSwitcher={option !== 'c' || selector}
              appSub={app.sub}
              currentPath={loc.path}
              subtitle={app.name}
              brandHref={resolveInApp(app.sub, '/')}
              LinkComponent={Link}
              collapseStorageKey="pr-showcase-nav-collapsed"
              onNavigate={onNavigate}
              globalHeader={<GlobalHeader currentSub={app.sub} />}
            >
              <div className="nav-sim__page">
                <p className="nav-sim__page-app">{app.name}</p>
                <h2 className="nav-sim__page-title">{title}</h2>
                <p className="nav-sim__page-copy">
                  Página simulada de <code>{loc.path}</code>.
                </p>
                <p className="nav-sim__page-copy">
                  Último evento: <code>{lastEvent || 'ninguno'}</code>
                </p>
              </div>
            </AppShell>
          </StaffShellProvider>
        </div>
      </div>
    </div>
  );
}
