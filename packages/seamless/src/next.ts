/**
 * @partrunner-ai/seamless/next — Next.js adapters (server-side).
 *
 * `getNexusSession()` for Server Components / Route Handlers, and
 * `nexusMiddlewareGuard()` for `proxy.ts`/`middleware.ts`. Both verify the
 * shared `nexus_token` and (guard) redirect to Nexus login when absent.
 */
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import {
  nexusLoginUrl,
  type NexusSession,
} from './core';
import {
  NEXUS_SESSION_COOKIE,
  resolveConfig,
  verifyNexusSession,
} from './server';

/**
 * The cookie this deployment actually uses.
 *
 * `resolveConfig` fills `sessionCookie`; the fallback satisfies the optional
 * type. Deployments may override the cookie name.
 */
function cookieName(config: ReturnType<typeof resolveConfig>): string {
  return config.sessionCookie ?? NEXUS_SESSION_COOKIE;
}

/** Read + verify the Nexus session from the request cookies (RSC / handlers). */
export async function getNexusSession(): Promise<NexusSession | null> {
  const config = resolveConfig();
  const store = await cookies();
  const token = store.get(cookieName(config))?.value;
  return verifyNexusSession(token, config.jwtSecret);
}

/**
 * Edge middleware guard. Returns a redirect to Nexus login when there's no
 * valid session, or `null` to let the request proceed. Pass `publicPaths` for
 * routes that must stay open (login callback, health, webhooks…).
 */
export async function nexusMiddlewareGuard(
  req: NextRequest,
  opts: { publicPaths?: string[] } = {},
): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;
  const publicPaths = opts.publicPaths ?? [];
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const config = resolveConfig();
  const token = req.cookies.get(cookieName(config))?.value;
  const session = await verifyNexusSession(token, config.jwtSecret);
  if (session) return null;
  return NextResponse.redirect(nexusLoginUrl(config, req.nextUrl.href));
}
