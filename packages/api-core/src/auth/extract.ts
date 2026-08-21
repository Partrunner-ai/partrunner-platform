/**
 * Pull a bearer token off an incoming request.
 *
 * Typed against a structural shape rather than `VercelRequest` so this stays
 * usable from Next.js route handlers and any other runtime — it only needs
 * something with headers and, optionally, parsed cookies.
 */

export interface TokenCarrier {
  headers?: Record<string, string | string[] | undefined>;
  /** Parsed cookies, when the runtime provides them (Vercel does). */
  cookies?: Record<string, string | undefined>;
}

/**
 * Returns the token from `Authorization: Bearer <token>`, falling back to the
 * named cookie, or `null`.
 *
 * The cookie name is required rather than defaulted on purpose: it is what
 * separates one audience's session from another's, and a wrong default would
 * silently read the wrong audience's token.
 */
export function extractBearerOrCookie(req: TokenCarrier, cookieName: string): string | null {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;

  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token) return token;
  }

  return req.cookies?.[cookieName] ?? null;
}
