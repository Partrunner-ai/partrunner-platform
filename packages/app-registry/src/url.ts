/**
 * Environment-aware URL builder for PartRunner apps.
 *
 * The app topology is MIXED:
 *  - `subdomain` (default): `https://{prefix}{sub}.partrunner.ai{path}`
 *  - `path`: one host where each module is a path,
 *    `https://{prefix}partrunner.app{path}`
 *
 * Framework-agnostic: this package NEVER reads `import.meta.env` (breaks in
 * CJS/Next) and only reads `process.env.NEXT_PUBLIC_*` as a best-effort default
 * for Next apps. Vite (or any) apps inject config explicitly at startup:
 *
 *   configureAppRegistry({
 *     hostPrefix: import.meta.env.VITE_APPS_HOST_PREFIX ?? '',
 *     baseDomain: import.meta.env.VITE_APPS_BASE_DOMAIN,
 *   });
 */

export type AppDomainScheme = 'subdomain' | 'path';

export interface AppRegistryConfig {
  /**
   * Host prefix per environment. Staging/dev default `'staging.'`; in prod set
   * to `''` (empty) to hit the bare domains.
   */
  hostPrefix: string;
  /** Base domain for `subdomain` apps. Default `partrunner.ai`. */
  baseDomain: string;
}

/**
 * Best-effort default from Next public env.
 *
 * IMPORTANT: these must be *static* `process.env.NEXT_PUBLIC_*` member accesses.
 * Next/webpack inlines them with the build-time literal in BOTH server and
 * client bundles, so cross-app URLs resolve correctly client-side (a dynamic
 * `process.env[key]` is NOT inlined → client always fell back to `staging.`).
 * The thunk + try/catch keeps it safe under Vite/browser (no `process` global),
 * where consumers call `configureAppRegistry()` instead.
 */
function envDefault(read: () => string | undefined): string | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

const config: AppRegistryConfig = {
  hostPrefix: envDefault(() => process.env.NEXT_PUBLIC_APPS_HOST_PREFIX) ?? 'staging.',
  baseDomain: envDefault(() => process.env.NEXT_PUBLIC_APPS_BASE_DOMAIN) ?? 'partrunner.ai',
};

/**
 * Override the host prefix / base domain. Call once at app startup. Non-Next
 * apps (Vite) MUST call this to point at the right environment.
 */
export function configureAppRegistry(next: Partial<AppRegistryConfig>): void {
  if (next.hostPrefix !== undefined) config.hostPrefix = next.hostPrefix;
  if (next.baseDomain !== undefined) config.baseDomain = next.baseDomain;
}

/** Read the current resolved config (mostly for debugging/tests). */
export function getAppRegistryConfig(): Readonly<AppRegistryConfig> {
  return { ...config };
}

export interface BuildUrlOpts {
  /** Host scheme. Default `'subdomain'`. */
  scheme?: AppDomainScheme;
  /** Subdomain (only for scheme `'subdomain'`). */
  sub?: string;
  /** Path after the host (should start with `/`). Default `''`. */
  path?: string;
  /** Base-domain override for a path-hosted application. */
  baseDomain?: string;
  /**
   * Host-prefix override, symmetric with `baseDomain`.
   *
   * The module-level config is a best-effort read of
   * `process.env.NEXT_PUBLIC_*`. Callers with an explicit environment can
   * override the host prefix; pass `''` for an unprefixed domain.
   */
  hostPrefix?: string;
}

/** Build an app URL from its scheme (subdomain or path). */
export function buildAppUrl(opts: BuildUrlOpts): string {
  const { scheme = 'subdomain', sub = '', path = '', baseDomain, hostPrefix } = opts;
  const domain = baseDomain ?? config.baseDomain;
  const prefix = hostPrefix ?? config.hostPrefix;
  if (scheme === 'path') {
    return `https://${prefix}${domain}${path}`;
  }
  return `https://${prefix}${sub}.${domain}${path}`;
}
