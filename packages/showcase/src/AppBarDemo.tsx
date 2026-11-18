import { useMemo, useState } from 'react';
import { Boxes, FileText, Truck } from 'lucide-react';
import {
  AppShell,
  GlobalHeader,
  StaffShellProvider,
  type LinkComponent,
  type NavSection,
  type StaffShellContextValue,
} from '@partrunner-ai/shell';

// Fixture data only: nothing here talks to a backend.
const SECTIONS: NavSection[] = [
  { id: 'main', items: [{ href: '/', label: 'Resumen', icon: Boxes }] },
  {
    id: 'ops',
    label: 'Operación',
    items: [
      { href: '/fleets', label: 'Flotas', icon: Truck },
      { href: '/units', label: 'Unidades', icon: Truck },
      { href: '/documents', label: 'Documentos', icon: FileText },
    ],
  },
];

const STAFF: StaffShellContextValue = {
  user: { id: 'demo', name: 'Ada Lovelace', email: 'ada@example.com' },
  profileHref: '#profile',
  preferences: { locale: 'es', theme: 'system' },
  notifications: { unreadCount: 0, href: '#notifications', items: [] },
  setTheme: () => {},
  setLocale: () => {},
  pages: [
    {
      app: 'sales',
      label: 'Cotizaciones',
      href: 'https://sales.partrunner.ai/quotes',
      section: 'Ventas',
    },
    {
      app: 'liveops',
      label: 'Rutas de la semana',
      href: 'https://liveops.partrunner.ai/routes',
      section: 'Operación',
    },
  ],
};

/**
 * `navigation="appbar"` with fixture data. Press ⌘K / Ctrl+K or «Ir a…» to try
 * the palette. Pages of the demo app route in place; other apps are real links
 * built by the app registry.
 */
export function AppBarDemo() {
  const [path, setPath] = useState('/fleets');
  const [events, setEvents] = useState<string[]>([]);

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
              setPath(href);
            }}
          >
            {children}
          </a>
        );
      },
    [],
  );

  return (
    <StaffShellProvider value={STAFF}>
      <AppShell
        sections={SECTIONS}
        navigation="appbar"
        appSub="supply"
        currentPath={path}
        subtitle="Supply"
        LinkComponent={Link}
        collapseStorageKey="pr-showcase-appbar-collapsed"
        onNavigate={(event) =>
          setEvents((list) => [`${event.source}: ${event.fromSub} → ${event.toSub ?? '—'} ${event.href}`, ...list].slice(0, 5))
        }
        globalHeader={<GlobalHeader currentSub="supply" start={<strong>Supply</strong>} />}
      >
        <div style={{ padding: 32, display: 'grid', gap: 12 }}>
          <h1 style={{ margin: 0 }}>App bar and «Ir a»</h1>
          <p style={{ margin: 0, color: 'var(--pr-fg-muted)' }}>
            Current page: <code>{path}</code>. Widen the window until the bar shows (the
            header slot needs 680px); the launcher button is always there.
          </p>
          <pre style={{ margin: 0, fontSize: 12 }}>
            {events.length ? events.join('\n') : 'onNavigate events appear here.'}
          </pre>
        </div>
      </AppShell>
    </StaffShellProvider>
  );
}
