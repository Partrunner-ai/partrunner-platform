import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  AppShell,
  GlobalHeader,
  StaffShellProvider,
  type LinkComponent,
  type ShellNavigateEvent,
  type StaffPendientesState,
  type StaffShellContextValue,
  type StaffShellPage,
} from '@partrunner-ai/shell';
import { displayHost, pageLabel, registryOrigin, SIM_APPS, simApp, simPages } from './fixtures';
import {
  clearNavState,
  DEFAULT_FAVORITES,
  FAVORITES_STORAGE_KEY,
  resolveInApp,
  routeLink,
  sameLocation,
  TASKS,
  writeWayBack,
  type NavTask,
  type SimLocation,
} from './simulation';
import './navigation.css';

const START: SimLocation = { app: 'liveops', path: '/general/routes' };

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

/** Fixture: «Te toca» (mine) and «De tu equipo» (team), and counts per app. */
const PENDIENTES: StaffPendientesState = {
  mine: 2,
  team: 3,
  teamLabel: 'Finanzas',
  href: '/inicio#pendientes',
  byApp: {
    nexus: { mine: 2, team: 1 },
    liveops: { mine: 0, team: 2 },
  },
  items: [
    {
      id: 'p1',
      bucket: 'mine',
      verb: 'Aprobar',
      queue: 'Tarifas pactadas',
      title: 'Tarifa de Flota Norte',
      subtitle: 'Ruta CDMX - Toluca',
      ageLabel: 'hace 3 h',
      href: '/tarifas/1',
    },
    { id: 'p2', bucket: 'mine', verb: 'Decidir', queue: 'Altas de unidad', title: 'Alta de camioneta 3.5 t', href: '/altas/2' },
    { id: 'p3', bucket: 'team', verb: 'Revisar', queue: 'Documentos', title: 'Póliza vencida de Flota Sur', ageLabel: 'hace 1 d' },
    { id: 'p4', bucket: 'team', verb: 'Aprobar', queue: 'Ajustes', title: 'Ajustes CxP · semana 47', subtitle: '12 ajustes' },
  ],
};

const PAGES: StaffShellPage[] = SIM_APPS.flatMap((app) =>
  simPages(app).map((page) => ({
    app: app.sub,
    label: page.label,
    href: `${registryOrigin(app.sub)}${page.href}`,
    section: page.section,
  })),
);

/**
 * The unified staff navigation over simulated apps. A click never leaves the page: links to a registry app change the
 * simulated app, and every other link is blocked.
 */
export function NavigationDemo() {
  const [loc, setLoc] = useState<SimLocation>(START);
  const [history, setHistory] = useState<SimLocation[]>([START]);
  const [nonce, setNonce] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [loads, setLoads] = useState(0);
  const [task, setTask] = useState<NavTask | null>(null);
  const [reached, setReached] = useState<{ clicks: number; loads: number } | null>(null);
  const [notice, setNotice] = useState('');
  const [lastEvent, setLastEvent] = useState('');
  const [favorites, setFavoritesState] = useState<string[]>(readFavorites);

  const frameRef = useRef<HTMLDivElement>(null);
  const locRef = useRef(loc);
  locRef.current = loc;
  const countsRef = useRef({ clicks, loads });
  countsRef.current = { clicks, loads };
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();

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
      preferences: { locale: 'es', theme: 'system', favoriteApps: favorites },
      notifications: { unreadCount: 0, href: '#notifications', items: [] },
      setTheme: () => {},
      setLocale: () => {},
      pages: PAGES,
      pendientes: PENDIENTES,
      claimPendiente: () => new Promise<void>((resolve) => window.setTimeout(resolve, 600)),
      setFavoriteApps: setFavorites,
    }),
    [favorites, setFavorites],
  );

  const app = simApp(loc.app) ?? SIM_APPS[0]!;
  const title = pageLabel(app, loc.path);
  const onNavigate = useCallback((event: ShellNavigateEvent) => {
    setLastEvent(`${event.source}: ${event.fromSub ?? '—'} → ${event.toSub ?? '—'}`);
  }, []);

  return (
    <div className="nav-sim">
      <div className="nav-sim__intro">
        <h1 className="nav-sim__title">Navegación</h1>
        <p className="nav-sim__lead">
          Apps simuladas. Ningún clic abre una app real.
        </p>
        <p className="nav-sim__hint">
          Mis apps en el menú lateral, la cuadrícula de apps arriba a la derecha, «Buscar o ir a…» y «← app».
          Es la navegación de todas las apps. Prueba también «/» o ⌘K / Ctrl+K para «Ir a».
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
              navigation="unified"
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
