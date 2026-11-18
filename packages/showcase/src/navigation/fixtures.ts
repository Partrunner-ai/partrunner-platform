import {
  BarChart3,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Map as MapIcon,
  MessageSquare,
  Route,
  Settings,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { appHref, findApp, type NavItem, type NavSection } from '@partrunner-ai/shell';

/**
 * Simulated apps for the navigation comparison. The labels and paths are the
 * real ones from the 2026-11-18 navigation audit (shortened: each app shows 1-3
 * sections and about 10 items). Nothing here talks to a backend.
 */
export interface SimApp {
  /** Registry `sub`. */
  sub: string;
  /** Name in the switcher, the bar, and «Mis apps». */
  name: string;
  /** Page a link to the app root (`/`) opens. */
  home: string;
  sections: NavSection[];
}

const leaf = (label: string, href: string, icon: LucideIcon = FileText): NavItem => ({
  label,
  href,
  icon,
});
const group = (label: string, icon: LucideIcon, children: NavItem[]): NavItem => ({
  label,
  icon,
  children,
});

export const SIM_APPS: SimApp[] = [
  {
    sub: 'nexus',
    name: 'Nexus',
    home: '/',
    sections: [
      {
        id: 'main',
        items: [
          leaf('Inicio', '/', LayoutDashboard),
          leaf('Estructura', '/estructura', Users),
          leaf('Wiki', '/wiki'),
          leaf('Pregúntale a Runnito', '/ask-nexus', MessageSquare),
        ],
      },
      {
        id: 'pmo',
        label: 'PMO',
        items: [
          leaf('Mis tareas', '/pmo/my-tasks', ClipboardList),
          leaf('Pedir a Producto', '/intake'),
          leaf('Administración', '/pmo/admin', Settings),
        ],
      },
      {
        id: 'producto',
        label: 'Producto',
        items: [
          leaf('Adopción', '/adopcion', BarChart3),
          leaf('Uso', '/uso', BarChart3),
          leaf('Nexurama', '/nexurama'),
        ],
      },
    ],
  },
  {
    sub: 'sales',
    name: 'Comercial',
    home: '/',
    sections: [
      {
        id: 'operacion',
        label: 'Operación',
        items: [
          group('Menú Clientes', Users, [
            leaf('Clientes', '/clientes'),
            leaf('Proyectos', '/proyectos'),
          ]),
          group('Menú Ajustes', Wallet, [
            leaf('Ajustes', '/condiciones-de-pago/ajustes'),
            leaf('Tarifas pactadas', '/tarifas-pactadas'),
            leaf('Fletes en falso', '/fletes-en-falso'),
          ]),
          group('Menú Oportunidades', ClipboardList, [
            leaf('Cotizaciones', '/cotizaciones'),
            leaf('Demanda', '/demanda'),
            leaf('Necesidades', '/necesidades'),
            leaf('Pipeline Comercial', '/comercial/pipeline'),
          ]),
        ],
      },
      {
        id: 'dashboards',
        label: 'Dashboards',
        items: [leaf('Inicio', '/', LayoutDashboard), leaf('Proyecciones', '/proyecciones', BarChart3)],
      },
    ],
  },
  {
    sub: 'solicitudes',
    name: 'Solicitudes',
    home: '/dashboard',
    sections: [
      {
        id: 'solicitudes',
        items: [
          group('Mi Bandeja', ClipboardList, [
            leaf('Resumen', '/dashboard'),
            leaf('Solicitudes Entrantes', '/dashboard/my-incoming'),
            leaf('Solicitudes Realizadas', '/dashboard/my-requests'),
          ]),
          group('Liveops', Truck, [
            leaf('Solicitar Unidad', '/dashboard/need-supply'),
            leaf('Cambiar Conductor/Vehículo', '/dashboard/change'),
            leaf('Colocadas', '/dashboard/colocadas'),
          ]),
          group('Negociador', Users, [
            leaf('Unidades solicitadas', '/dashboard/neg-need-supply'),
            leaf('Solicitudes cotización', '/dashboard/neg-cotizacion'),
            leaf('Referidos para Proyecto', '/dashboard/leads'),
          ]),
          group('Estadísticas', BarChart3, [leaf('Resumen General', '/dashboard/statistics/resumen')]),
        ],
      },
    ],
  },
  {
    sub: 'supply',
    name: 'Supply',
    home: '/onboarding/mi-dia',
    sections: [
      {
        id: 'onboarding',
        label: 'Onboarding',
        items: [
          leaf('Mi día', '/onboarding/mi-dia', LayoutDashboard),
          leaf('Resumen', '/onboarding'),
          leaf('Flotas', '/onboarding/flotas', Truck),
          leaf('Directorio', '/onboarding/directorio/operadores', Users),
        ],
      },
      {
        id: 'operacion',
        label: 'Operación',
        items: [
          leaf('Afiliación', '/afiliacion'),
          leaf('Prospectos', '/prospectos', Users),
          leaf('Tarifas pactadas', '/tarifas-pactadas', Wallet),
          leaf('Necesidad de unidades', '/necesidad-unidades', Truck),
          leaf('Proyectos', '/proyectos'),
        ],
      },
      {
        id: 'dashboards',
        label: 'Dashboards',
        items: [leaf('Supply Tracker', '/supply-tracker', BarChart3), leaf('Rentabilidad', '/rentabilidad', BarChart3)],
      },
    ],
  },
  {
    sub: 'liveops',
    name: 'LiveOps',
    home: '/',
    sections: [
      {
        id: 'operacion',
        label: 'Operación',
        items: [
          leaf('Operación del día', '/general/operacion', LayoutDashboard),
          leaf('Planeador', '/general/planeador', MapIcon),
          group('Rutas', Route, [
            leaf('Todas las rutas', '/general/routes'),
            leaf('Ajustes', '/general/ajustes'),
            leaf('Cuadre', '/general/cuadre'),
            leaf('Incidencias', '/general/incidencias'),
          ]),
          leaf('Equipos', '/general/equipos', Users),
        ],
      },
      {
        id: 'reportes',
        label: 'Reportes',
        items: [leaf('Visión dirección', '/general/reportes/direccion', BarChart3)],
      },
      {
        id: 'dashboards',
        label: 'Dashboards',
        items: [
          leaf('PNRs', '/', LayoutDashboard),
          leaf("KPI's", '/dashboards/kpis', BarChart3),
          leaf('Unidades', '/general/unidades', Truck),
        ],
      },
    ],
  },
  {
    sub: 'sube-tu-factura',
    name: 'Finanzas',
    home: '/admin/finanzas/dashboard',
    sections: [
      {
        id: 'finanzas',
        items: [
          leaf('Inicio', '/admin/dashboard', LayoutDashboard),
          leaf('Cuentas por pagar', '/admin/pagos/resumen', Wallet),
          leaf('Análisis', '/admin/finanzas/dashboard', BarChart3),
          group('Nexurama', FileText, [
            leaf('Crear Factura', '/admin/finanzas/facturacion-clientes'),
            leaf('Clientes', '/admin/finanzas/catalogos/clientes'),
            leaf('Cuentas por cobrar', '/admin/finanzas/cobranza'),
          ]),
          group('Correcciones operativas', Settings, [leaf('Rutas', '/admin/ajustes-daily', Route)]),
          leaf('Administración', '/admin/users', Settings),
        ],
      },
    ],
  },
  {
    sub: 'fds',
    name: 'FDS',
    home: '/',
    sections: [
      {
        id: 'operacion',
        label: 'Operación',
        items: [
          leaf('Aclaraciones', '/', MessageSquare),
          leaf('Pendientes', '/pendientes'),
          leaf('Referidos', '/referidos', Users),
          leaf('Retención', '/retencion'),
          leaf('Capacitación', '/capacitacion'),
        ],
      },
      {
        id: 'atencion',
        label: 'Atención',
        items: [
          leaf('Chat Flotilleros', '/chat/flotilleros', MessageSquare),
          leaf('Tablero de atención', '/chat/tablero', BarChart3),
        ],
      },
      {
        id: 'dashboards',
        label: 'Dashboards',
        items: [leaf('Seguimiento', '/seguimiento', BarChart3), leaf('Salud de flotilleros', '/flotilleros', Truck)],
      },
    ],
  },
];

export function simApp(sub: string): SimApp | undefined {
  return SIM_APPS.find((app) => app.sub === sub);
}

/** Every page of an app, in menu order, with the heading it sits under. */
export function simPages(app: SimApp): Array<{ label: string; href: string; section?: string }> {
  const out: Array<{ label: string; href: string; section?: string }> = [];
  for (const section of app.sections) {
    for (const item of section.items) {
      for (const page of item.children ?? [item]) {
        if (page.href) out.push({ label: page.label, href: page.href, section: item.children ? item.label : section.label });
      }
    }
  }
  return out;
}

/** Label of the page at `path` in `app`, else a title built from the path. */
export function pageLabel(app: SimApp, path: string): string {
  return simPages(app).find((page) => page.href === path)?.label ?? path;
}

/** `https://host` of the registry URL of an app, or `''`. */
export function registryOrigin(sub: string): string {
  const app = findApp(sub);
  const url = app ? appHref(app) : null;
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/** The host a person would see in the address bar (production style). */
export function displayHost(sub: string): string {
  try {
    return new URL(registryOrigin(sub)).host.replace(/^staging\./, '');
  } catch {
    return sub;
  }
}
