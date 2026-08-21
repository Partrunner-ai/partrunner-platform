/**
 * Password hashing and opaque single-use tokens.
 *
 * Opaque tokens are the ones you email or text: magic links, password resets,
 * verification codes. They are NOT JWTs — nothing is encoded in them. The
 * random value goes to the user and only its SHA-256 digest is stored, so a
 * leaked database cannot be replayed against the endpoints that accept them.
 */

import { createHash, randomBytes } from 'node:crypto';

/**
 * Default bcrypt cost factor. Bcrypt records the cost inside each hash, so a
 * future increase affects new hashes without invalidating old ones.
 */
export const DEFAULT_BCRYPT_ROUNDS = 12;

/**
 * `bcryptjs` is not a dependency of this package; it is imported lazily so it never lands
 * in the module graph of an endpoint that only verifies tokens. It is a heavy
 * pure-JS implementation and a serverless cold start pays for every byte.
 */
async function bcrypt() {
  try {
    return (await import('bcryptjs')).default;
  } catch {
    throw new Error(
      'hashPassword/verifyPassword require `bcryptjs`, which this package does not install. ' +
        'Install it, or drop these two functions if your app authenticates another way.'
    );
  }
}

export async function hashPassword(
  password: string,
  rounds: number = DEFAULT_BCRYPT_ROUNDS
): Promise<string> {
  return (await bcrypt()).hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await bcrypt()).compare(password, hash);
}

/** Cryptographically random hex string. Give this to the user; store the digest. */
export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}

/** SHA-256 digest of an opaque token. Store this, never the token itself. */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
