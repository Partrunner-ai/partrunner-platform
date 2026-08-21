/**
 * @partrunner-ai/api-core/auth — authentication primitives.
 *
 * Primitives only. This module knows how to sign, verify, hash and extract; it
 * knows nothing about who your users are, which table they live in, or what
 * they are allowed to do. Identity lookup and role policy stay in the app that
 * owns them.
 *
 * That boundary is the point. PartRunner has two audiences — staff and fleet
 * owners — with separate identity stores and separate secrets. Sharing the
 * crypto makes the two consistent; sharing the *secret* is what would break
 * the isolation, and nothing here does that. An app is only able to accept the
 * tokens it holds the secret for.
 *
 * Behind its own subpath so `bcryptjs` never reaches consumers that don't
 * authenticate with passwords.
 */

export {
  signJwt,
  verifyJwt,
  type JwtClaims,
  type JwtRejection,
  type SignOptions,
  type VerifyOptions,
} from './auth/jwt';

export {
  DEFAULT_BCRYPT_ROUNDS,
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from './auth/secrets';

export { extractBearerOrCookie, type TokenCarrier } from './auth/extract';
