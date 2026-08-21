/**
 * @partrunner-ai/seamless/nav — navigation-manifest contract.
 *
 * Each app exposes `GET /api/nav-manifest` returning a NavManifest; Nexus
 * consumes them to keep its sidebar in sync (add/remove a module in an app and
 * Nexus reflects it without code changes). Icons travel as lucide-react name
 * STRINGS so the manifest is 100% serializable JSON.
 */

/**
 * Canonical menu item pointing at the Nexus portal.
 */
export const NEXUS_NAV_ITEM = { name: 'Nexus', icon: 'Home' } as const;

/** Color accents supported by the PartRunner sidebar. */
export type NavAccent = 'yellow' | 'green' | 'purple' | 'blue' | 'rose';

/** A leaf module of the menu. */
export interface NavManifestItem {
  name: string;
  /** Relative path ('/admin/pagos/resumen', resolved against the app host) or absolute URL. */
  href: string;
  /** lucide-react icon name (e.g. 'FileText'). */
  icon: string;
  /** Required permission code (optional); the consumer decides whether to apply it. */
  permission?: string;
}

/** A grouped section (tile → drill-in). */
export interface NavManifestSection {
  id: string;
  name: string;
  icon: string;
  accent: NavAccent;
  description: string;
  items: NavManifestItem[];
}

/** The full manifest an app exposes. */
export interface NavManifest {
  version: 1;
  /** Stable identifier for the emitting application. */
  app: string;
  /** Base URL to resolve relative hrefs; the consumer may ignore it. */
  baseUrl?: string;
  /** Direct (ungrouped) links — optional. */
  topLevel?: NavManifestItem[];
  sections: NavManifestSection[];
}

/** Build a manifest from an app's config (shallow shape check + pins version). */
export function buildNavManifest(input: {
  app: string;
  baseUrl?: string;
  topLevel?: NavManifestItem[];
  sections: NavManifestSection[];
}): NavManifest {
  return {
    version: 1,
    app: input.app,
    baseUrl: input.baseUrl,
    topLevel: input.topLevel ?? [],
    sections: input.sections ?? [],
  };
}

/** Minimal type guard for a manifest received over the network. */
export function isNavManifest(value: unknown): value is NavManifest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.version === 1 && typeof v.app === 'string' && Array.isArray(v.sections);
}
