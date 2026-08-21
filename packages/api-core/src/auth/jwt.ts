/**
 * HS256 JWT signing and verification.
 *
 * The stable wire format keeps previously issued compatible tokens valid:
 * `base64url(header).base64url(payload).signature`
 * with `{"alg":"HS256","typ":"JWT"}` and HMAC-SHA256 over the first two
 * segments, base64 with `+`→`-`, `/`→`_`, `=` stripped.
 *
 * What is deliberately NOT shared: the secret and the identity behind the
 * token. Each caller supplies its own `secret`, so an app holding only the
 * secret for one audience cannot mint or accept another audience's token.
 * Isolation comes from which secret an app is given, not from keeping two
 * copies of the crypto.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Claims this module manages. Callers own everything else in the payload. */
export interface JwtClaims {
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. */
  exp: number;
}

/** Why `verifyJwt` rejected a token. Surfaced so callers can log in their own voice. */
export type JwtRejection = 'malformed' | 'bad_signature' | 'expired';

export interface SignOptions {
  /**
   * Resolved at call time rather than passed by value so a missing environment
   * variable fails on first use with the caller's own error, instead of at
   * module import where the stack says nothing useful.
   */
  secret: () => string;
  /** Token lifetime; each caller chooses its audience policy. */
  expiryHours: number;
}

export interface VerifyOptions {
  secret: () => string;
  /** Called with the reason when a token is rejected. */
  onReject?: (reason: JwtRejection) => void;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(
    /=/g,
    ''
  );
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf-8');
}

function sign(signingInput: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Constant-time string comparison.
 *
 * The implementations this replaced compared signatures with `!==`, which
 * leaks a timing signal proportional to the length of the matching prefix.
 * Remote exploitation of that is difficult, but a constant-time compare costs
 * nothing and removes the question.
 *
 * `timingSafeEqual` throws on length mismatch, so the length check happens
 * first — a differing length is not secret, since the signature length is fixed
 * by the algorithm.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Mint a token. `iat` and `exp` are set here; anything else in `payload` is
 * copied through verbatim.
 */
export function signJwt<T extends object>(
  payload: T,
  { secret, expiryHours }: SignOptions
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, iat: now, exp: now + expiryHours * 60 * 60 })
  );
  return `${header}.${body}.${sign(`${header}.${body}`, secret())}`;
}

/**
 * Verify a token and return its claims, or `null` if it is malformed, badly
 * signed or expired. Never throws — a rejected token is an expected outcome,
 * not an exceptional one.
 */
export function verifyJwt<T>(
  token: string,
  { secret, onReject }: VerifyOptions
): (T & JwtClaims) | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      onReject?.('malformed');
      return null;
    }
    const [header, body, signature] = parts as [string, string, string];

    if (!safeEqual(signature, sign(`${header}.${body}`, secret()))) {
      onReject?.('bad_signature');
      return null;
    }

    const claims = JSON.parse(base64UrlDecode(body)) as T & JwtClaims;
    if (claims.exp < Math.floor(Date.now() / 1000)) {
      onReject?.('expired');
      return null;
    }
    return claims;
  } catch {
    onReject?.('malformed');
    return null;
  }
}
