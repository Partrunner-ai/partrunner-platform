import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';
import { tbl } from '../db';
import { logger } from '../logger';

const CTX = 'lib/apiKeyAuth';

export interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
}

export type ApiKeyScope = 'public' | 'admin' | 'export' | 'user';

/**
 * Extract API key from request
 * Credentials belong in a header, never in a URL that proxies, analytics,
 * browser history, and referrers may persist.
 */
export function extractApiKey(req: VercelRequest): string | null {
  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey !== 'string') return null;
  return headerKey.trim() || null;
}

function firstHeader(
  req: VercelRequest,
  name: string,
): string | undefined {
  const value = req.headers[name];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first.trim() || undefined : undefined;
}

function clientIp(req: VercelRequest): string {
  return (
    firstHeader(req, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    firstHeader(req, 'x-real-ip') ||
    'unknown'
  );
}

async function recordApiKeyUsage(
  keyId: string,
  req: VercelRequest,
): Promise<void> {
  try {
    const { data, error } = await tbl('identity', 'api_keys')
      .select('total_requests')
      .eq('id', keyId)
      .maybeSingle();
    if (error || !data) {
      logger.warn(CTX, 'API key usage counter lookup failed', {
        keyId,
        code: error?.code,
        message: error?.message,
      });
      return;
    }

    const currentRequests = Number(data.total_requests);
    const totalRequests =
      Number.isSafeInteger(currentRequests) && currentRequests >= 0
        ? currentRequests + 1
        : 1;

    const { error: usageError } = await tbl('identity', 'api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        last_used_ip: clientIp(req),
        total_requests: totalRequests,
      })
      .eq('id', keyId);
    if (usageError) {
      logger.warn(CTX, 'API key usage metadata update failed', {
        keyId,
        code: usageError.code,
        message: usageError.message,
      });
    }
  } catch (err) {
    logger.warn(CTX, 'API key usage metadata update failed', {
      keyId,
      err,
    });
  }
}

/**
 * Verify API key and return key info if valid
 */
export async function verifyApiKey(req: VercelRequest): Promise<ApiKey | null> {
  const key = extractApiKey(req);

  if (!key) {
    return null;
  }

  // Validate format (pk_xxxxx)
  if (!key.startsWith('pk_') || key.length < 20) {
    logger.warn(CTX, 'Invalid API key format');
    return null;
  }

  // Hash the key for lookup
  const keyHash = createHash('sha256').update(key).digest('hex');

  // Look up the stored hash; raw keys are never persisted.
  const { data, error } = await tbl('identity', 'api_keys')
    .select(
      'id, name, scopes, rate_limit_per_minute, rate_limit_per_day, is_active, expires_at',
    )
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (error) {
    logger.error(CTX, 'API key lookup failed', {
      code: error.code,
      message: error.message,
    });
    throw new Error('API key lookup failed');
  }

  if (!data) {
    logger.warn(CTX, 'API key not found');
    return null;
  }

  // Check if active
  if (!data.is_active) {
    logger.warn(CTX, 'API key is revoked');
    return null;
  }

  // Check expiration
  if (data.expires_at) {
    const expiresAt = Date.parse(data.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      logger.warn(CTX, 'API key is expired or has an invalid expiry');
      return null;
    }
  }

  // Usage metadata is best-effort. Authentication truth comes from the lookup
  // above; a telemetry write outage must not turn a valid key into a 401.
  await recordApiKeyUsage(data.id, req);

  return {
    id: data.id,
    name: data.name,
    scopes: data.scopes,
    rate_limit_per_minute: data.rate_limit_per_minute,
    rate_limit_per_day: data.rate_limit_per_day,
  };
}

/**
 * Check if API key has required scope
 */
export function hasScope(apiKey: ApiKey, requiredScope: ApiKeyScope): boolean {
  return apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes('admin');
}

/**
 * Log API key usage for auditing
 */
export async function logApiKeyUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  req: VercelRequest
): Promise<void> {
  // Persist audit metadata separately from authentication.
  await tbl('identity', 'api_key_usage_log').insert({
    api_key_id: apiKeyId,
    endpoint,
    method,
    status_code: statusCode,
    ip_address: clientIp(req),
    user_agent: firstHeader(req, 'user-agent') ?? null,
  });
}

/**
 * Middleware to require API key authentication
 * Use for endpoints that should be accessible via API key
 */
export function withApiKeyAuth(
  handler: (
    req: VercelRequest,
    res: VercelResponse,
    apiKey: ApiKey
  ) => Promise<void | VercelResponse>,
  requiredScope?: ApiKeyScope
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const apiKey = await verifyApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'API key inválida o no proporcionada',
      });
    }

    if (requiredScope && !hasScope(apiKey, requiredScope)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `API key no tiene permiso '${requiredScope}'`,
      });
    }

    return handler(req, res, apiKey);
  };
}

/**
 * Verifies an admin session. Supplied by the host app via
 * `configureAdminVerifier`, because admin identity is app-specific: it reads
 * that app's admin table and JWT secret. Resolves to a truthy admin object, or
 * `null` when the request carries no valid admin session.
 */
export type AdminVerifier = (req: VercelRequest) => Promise<unknown>;

let adminVerifier: AdminVerifier | null = null;

/**
 * Register the admin-session verifier used by `verifyAuthOrApiKey`.
 *
 * This is dependency injection rather than an import because admin auth lives
 * in the host app, not the platform — api-core must not know about any
 * particular app's admin table. Call once at startup; pass `null` to unset.
 */
export function configureAdminVerifier(fn: AdminVerifier | null): void {
  adminVerifier = fn;
}

/**
 * Middleware that allows either admin auth or API key auth.
 *
 * Requires `configureAdminVerifier()` to have been called — throws otherwise.
 * Failing loudly is deliberate: silently skipping the admin branch would turn a
 * missing-wiring bug into blanket 401s for every admin, which is far harder to
 * diagnose than an explicit error on the first call.
 */
export async function verifyAuthOrApiKey(req: VercelRequest): Promise<{
  type: 'admin' | 'api_key' | null;
  admin?: unknown;
  apiKey?: ApiKey;
}> {
  if (!adminVerifier) {
    throw new Error(
      'verifyAuthOrApiKey requires an admin verifier. ' +
        'Call configureAdminVerifier() from @partrunner-ai/api-core/vercel at startup.'
    );
  }

  // First try admin auth (for browser/admin panel)
  const admin = await adminVerifier(req);

  if (admin) {
    return { type: 'admin', admin };
  }

  // Then try API key (for programmatic access)
  const apiKey = await verifyApiKey(req);

  if (apiKey) {
    return { type: 'api_key', apiKey };
  }

  return { type: null };
}
