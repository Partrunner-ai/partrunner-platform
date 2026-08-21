/**
 * @partrunner-ai/seamless/server — server and edge session operations.
 *
 * Import this subpath only from trusted server code. It resolves secret
 * environment variables, verifies shared JWTs, and manages HttpOnly cookies.
 */
import { buildAppUrl } from '@partrunner-ai/app-registry/url';
import { jwtVerify } from 'jose';

import {
  nexusLoginUrl,
  type NexusSession,
  type NexusUrlConfig,
} from './core';

/** Cookie name for the session issued by Nexus. */
export const NEXUS_SESSION_COOKIE = 'nexus_token';

export interface SeamlessConfig extends NexusUrlConfig {
  /** Shared secret across all apps. Never expose this to browser code. */
  jwtSecret: string;
  /** Cookie used by this deployment. */
  sessionCookie?: string;
  /** Parent domain used by sibling portals that share a session. */
  cookieDomain?: string;
}

/** Where the session cookie lives. */
export interface SessionCookieConfig {
  name: string;
  /** Absent means a host-only cookie. */
  domain?: string;
}

const JWT_SECRET_KEYS = [
  'NEXUS_UNIFIED_JWT_SECRET',
  'UNIFIED_JWT_SECRET',
  'NEXUS2_UNIFIED_JWT_SECRET',
] as const;

const COOKIE_DOMAIN_KEYS = [
  'NEXUS_COOKIE_DOMAIN',
  'SESSION_COOKIE_DOMAIN',
  'NEXUS2_COOKIE_DOMAIN',
  'COOKIE_DOMAIN',
] as const;

function firstSet(
  env: Record<string, string | undefined>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function resolveNexusUrl(
  env: Record<string, string | undefined>,
): string {
  const nexusUrl =
    env.NEXT_PUBLIC_NEXUS_URL ??
    buildAppUrl({
      scheme: 'subdomain',
      sub: 'nexus',
      ...(env.NEXT_PUBLIC_APPS_HOST_PREFIX !== undefined
        ? { hostPrefix: env.NEXT_PUBLIC_APPS_HOST_PREFIX }
        : {}),
      ...(env.NEXT_PUBLIC_APPS_BASE_DOMAIN
        ? { baseDomain: env.NEXT_PUBLIC_APPS_BASE_DOMAIN }
        : {}),
    });
  return nexusUrl.replace(/\/$/, '');
}

/**
 * Does `host` sit under `cookieDomain`, using the same matching rule as a
 * browser cookie domain?
 */
export function cookieDomainAppliesTo(
  host: string,
  cookieDomain: string,
): boolean {
  const apex = cookieDomain.replace(/^\./, '').toLowerCase();
  const candidate = host.toLowerCase();
  return candidate === apex || candidate.endsWith(`.${apex}`);
}

/** Resolve the cookie name and the domain this host can actually use. */
export function resolveSessionCookie(
  env: Record<string, string | undefined> = process.env,
  host?: string,
): SessionCookieConfig {
  const name = env.NEXUS_TOKEN_COOKIE?.trim() || NEXUS_SESSION_COOKIE;
  const domain = firstSet(env, COOKIE_DOMAIN_KEYS);
  if (!domain) return { name };
  if (host !== undefined) {
    return cookieDomainAppliesTo(host, domain)
      ? { name, domain }
      : { name };
  }
  return env.NODE_ENV === 'development' ? { name } : { name, domain };
}

/** Every cookie scope that sign-out must expire. */
export function sessionCookiesToClear(
  env: Record<string, string | undefined> = process.env,
): SessionCookieConfig[] {
  const { name, domain } = resolveSessionCookie(env);
  return domain ? [{ name }, { name, domain }] : [{ name }];
}

/** Expire every current and migration-era scope of the session cookie. */
export function clearSessionCookies(
  response: { headers: Headers },
  env: Record<string, string | undefined> = process.env,
): void {
  for (const { name, domain } of sessionCookiesToClear(env)) {
    const parts = [
      `${name}=`,
      'Path=/',
      'Max-Age=0',
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (domain) parts.push(`Domain=${domain}`);
    if (env.NODE_ENV === 'production') parts.push('Secure');
    response.headers.append('set-cookie', parts.join('; '));
  }
}

/** Resolve the full server session configuration from environment values. */
export function resolveConfig(
  env: Record<string, string | undefined> = process.env,
  host?: string,
): SeamlessConfig {
  const jwtSecret = firstSet(env, JWT_SECRET_KEYS);
  if (!jwtSecret) {
    throw new Error(
      `[seamless] No JWT secret in the environment. Set one of: ${JWT_SECRET_KEYS.join(', ')}.`,
    );
  }

  const cookie = resolveSessionCookie(env, host);
  return {
    jwtSecret,
    nexusUrl: resolveNexusUrl(env),
    sessionCookie: cookie.name,
    ...(cookie.domain ? { cookieDomain: cookie.domain } : {}),
  };
}

let cachedKey: Uint8Array | null = null;
let cachedSecret: string | null = null;

function keyFor(secret: string): Uint8Array {
  if (cachedKey && cachedSecret === secret) return cachedKey;
  cachedKey = new TextEncoder().encode(secret);
  cachedSecret = secret;
  return cachedKey;
}

/** Verify signature and expiry of a Nexus token. */
export async function verifyNexusSession(
  token: string | undefined | null,
  secret: string,
): Promise<NexusSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, keyFor(secret), {
      algorithms: ['HS256'],
    });
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      return null;
    }
    const roles = Array.isArray(payload.roles)
      ? payload.roles.filter((role): role is string => typeof role === 'string')
      : [];
    return {
      ...payload,
      userId: payload.userId,
      email: payload.email,
      roles,
    };
  } catch {
    return null;
  }
}

/** Exchange a one-time Nexus SSO code for verified session claims. */
export async function exchangeSsoCode(
  config: NexusUrlConfig,
  code: string,
  origin: string,
): Promise<NexusSession | null> {
  try {
    const response = await fetch(
      new URL('/api/auth/sso/exchange', config.nexusUrl),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ code }),
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      userId?: string;
      email?: string;
      roles?: unknown;
    };
    if (!data.userId || !data.email) return null;
    const roles = Array.isArray(data.roles)
      ? data.roles.filter((role): role is string => typeof role === 'string')
      : [];
    return { userId: data.userId, email: data.email, roles };
  } catch {
    return null;
  }
}

/** Sanitize a redirect that may target a sibling sharing the session cookie. */
export function safeNextUrl(
  next: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  if (!next) return '/';
  if (next.startsWith('/') && !next.startsWith('//')) return next;

  const { domain } = resolveSessionCookie(env);
  if (!domain) return '/';

  try {
    const url = new URL(next);
    if (url.protocol !== 'https:') return '/';
    if (!cookieDomainAppliesTo(url.hostname, domain)) return '/';
    return url.toString();
  } catch {
    return '/';
  }
}

/**
 * Return the central login destination, or `null` while the current host cannot
 * share Nexus's cookie and must keep its local login.
 */
export function loginDestination(
  currentUrl: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  let host: string | undefined;
  try {
    host = new URL(currentUrl).hostname;
  } catch {
    // Fail through to environment-only resolution without guessing a host.
  }
  if (!resolveSessionCookie(env, host).domain) return null;
  return nexusLoginUrl({ nexusUrl: resolveNexusUrl(env) }, currentUrl);
}
