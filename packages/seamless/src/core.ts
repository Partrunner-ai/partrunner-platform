/**
 * @partrunner-ai/seamless — browser-safe framework-agnostic core.
 *
 * This entry contains claims, URL helpers, role checks, redirect sanitizing,
 * and brand constants. Secret resolution, JWT verification, and cookie
 * operations live behind `@partrunner-ai/seamless/server`.
 */

/** Claims carried by a verified Nexus session. */
export interface NexusSession {
  userId: string;
  email: string;
  /** Active role codes (snapshot at login). */
  roles: string[];
  iss?: string;
  sub?: string;
  aud?: string | string[];
  jti?: string;
  nbf?: number;
  exp?: number;
  iat?: number;
  [claim: string]: unknown;
}

/** The public URL information browser-safe helpers need. */
export interface NexusUrlConfig {
  /** Nexus host, without a trailing slash. */
  nexusUrl: string;
}

/** Nexus login URL with `next` back to the current app. */
export function nexusLoginUrl(
  config: NexusUrlConfig,
  currentUrl: string,
): string {
  const url = new URL('/login', config.nexusUrl);
  url.searchParams.set('next', currentUrl);
  return url.toString();
}

/** Nexus portal URL for links back to the canonical hub. */
export function nexusHomeUrl(config: NexusUrlConfig): string {
  return config.nexusUrl;
}

export function hasRole(
  session: NexusSession | null,
  role: string,
): boolean {
  return !!session?.roles?.includes(role);
}

export function isSuperAdmin(session: NexusSession | null): boolean {
  return hasRole(session, 'super_admin');
}

/** Sanitize `next` to prevent open redirects (internal paths only). */
export function safeNextPath(next: string | null | undefined): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}

/** Brand palette for entry and exit transitions. */
export const BRAND = {
  yellow: '#FDD238',
  yellowGradient:
    'linear-gradient(165deg, #FFE573 0%, #FDD238 45%, #ECB800 100%)',
  black: '#1A1A1A',
} as const;
