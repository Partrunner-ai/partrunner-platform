import {
  Boxes,
  ClipboardList,
  Headphones,
  Home,
  LineChart,
  Radio,
  ReceiptText,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

import { type AppDomainScheme, buildAppUrl } from './url';

/**
 * Semantic tone of an app tile. The shell maps each tone to a
 * `--pr-tone-{tone}-*` CSS variable pair, so tiles are theme-driven and do NOT
 * depend on any Tailwind color utility being configured in the host app.
 */
export type AppTone = 'yellow' | 'blue' | 'amber' | 'purple' | 'green' | 'rose';

/** Prototype KPI shown on the Nexus home card (mock data for now). */
export interface AppKpi {
  label: string;
  value: string;
  /** Delta vs. previous period, e.g. "+4.2%". */
  delta?: string;
  trend?: 'up' | 'down';
}

export interface AppLink {
  label: string;
  /** Subdomain of the app within the base domain (no env prefix). */
  sub: string;
  /** Short description (tooltip / Home section / a11y). */
  description: string;
  icon: LucideIcon;
  /** Semantic tone driving the tile colors. */
  tone: AppTone;
  /**
   * Legacy Tailwind classes for the icon tile. Kept for backward-compat with
   * apps that style tiles via utilities; the shell prefers `tone`.
   */
  tile?: string;
  /** URL scheme: `'subdomain'` (default) or `'path'`. */
  scheme?: AppDomainScheme;
  /** Optional base-domain override for path-hosted applications. */
  baseDomain?: string;
  /** Path after the host (only for scheme `'path'`). */
  path?: string;
  /**
   * Absolute URL, used verbatim and identically in every environment.
   *
   * Escape hatch for an app that is not on the partrunner.ai topology at all,
   * so neither `scheme` can express it.
   *
   * Because there is no per-environment counterpart, a staging launcher linking
   * here reaches production on purpose: it is the only deployment there is.
   * Do NOT use this for an app that does have a staging host — that is what
   * `hostPrefix` exists for, and hardcoding one environment's URL into the
   * registry is the bug the registry was built to prevent.
   *
   * Supersedes `scheme`/`sub`/`baseDomain`/`path`, which are ignored when set.
   * `comingSoon` still outranks it.
   */
  absoluteUrl?: string;
  /** App has no URL yet — rendered as "Próximamente". */
  comingSoon?: boolean;
  /** Prototype KPIs for the Home card. */
  kpis?: AppKpi[];
}

/** URL of the app, or `null` if not yet available. */
export function appHref(app: AppLink): string | null {
  if (app.comingSoon) return null;
  if (app.absoluteUrl) return app.absoluteUrl;
  return buildAppUrl({
    scheme: app.scheme ?? 'subdomain',
    sub: app.sub,
    path: app.path ?? '',
    baseDomain: app.baseDomain,
  });
}

/**
 * The canonical PartRunner application registry.
 *
 * SOURCE OF TRUTH. Every app launcher consumes this; add or change an app
 * HERE, once. Descriptions name the product area without promising internal
 * modules or routes; those belong to each app-owned navigation manifest.
 */
export const APPS: AppLink[] = [
  {
    label: 'Home',
    sub: 'nexus',
    description: 'Portal de administración de PartRunner',
    icon: Home,
    tone: 'yellow',
    tile: 'bg-pr-yellow/20 text-pr-charcoal',
  },
  {
    label: 'Supply',
    sub: 'supply',
    description: 'Operación de supply y capacidad',
    icon: Boxes,
    tone: 'blue',
    tile: 'bg-blue-500/15 text-blue-500',
  },
  {
    label: 'LiveOps',
    sub: 'liveops',
    description: 'Operación logística en tiempo real',
    icon: Radio,
    tone: 'amber',
    tile: 'bg-orange-500/15 text-orange-500',
  },
  {
    label: 'Solicitudes',
    sub: 'solicitudes',
    description: 'Gestión de solicitudes',
    icon: ClipboardList,
    tone: 'purple',
    tile: 'bg-violet-500/15 text-violet-500',
  },
  {
    label: 'Comercial',
    sub: 'sales',
    description: 'Gestión comercial',
    icon: LineChart,
    tone: 'green',
    tile: 'bg-emerald-500/15 text-emerald-500',
  },
  {
    label: 'Finanzas',
    sub: 'sube-tu-factura',
    description: 'Operación financiera',
    icon: ReceiptText,
    tone: 'amber',
    tile: 'bg-amber-500/15 text-amber-600',
    scheme: 'path',
    baseDomain: 'partrunner.app',
    path: '/admin/finanzas/dashboard',
  },
  {
    label: 'FDS',
    sub: 'fds',
    absoluteUrl: 'https://fds.partrunner.ai',
    description: 'Fleet & Driver Success',
    icon: Headphones,
    tone: 'purple',
    tile: 'bg-violet-500/15 text-violet-500',
  },
  {
    // Comunidad is on the standard topology and has BOTH environments
    // (`staging.community.partrunner.ai` / `community.partrunner.ai`), so it
    // takes the plain `subdomain` scheme and the prefix does the work. It is
    // deliberately NOT an `absoluteUrl`: pinning it to the older
    // `www.partrunner.community` host would hardcode production into the
    // staging launcher, which is exactly the bug this registry prevents.
    //
    // The same deploy also serves the public job board on `careers`. That host
    // is candidate-facing and, by design, cannot reach the portal, so it is not
    // a staff destination and gets no launcher tile.
    label: 'Comunidad',
    sub: 'community',
    description: 'Portal interno de la empresa',
    icon: UsersRound,
    tone: 'rose',
    tile: 'bg-rose-500/15 text-rose-500',
  },
];

/** Look up an app by its subdomain (first match; some share a `sub`). */
export function findApp(sub: string): AppLink | undefined {
  return APPS.find((app) => app.sub === sub);
}
