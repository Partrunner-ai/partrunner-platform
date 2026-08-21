import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Simple in-memory rate limiting
 * Note: This resets on each function cold start in Vercel
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (resets on cold start)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_CONFIG = {
  // Max requests per window
  maxRequests: 30,
  // Time window in milliseconds (1 minute)
  windowMs: 60 * 1000,
  // Cleanup interval
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
};

// Cleanup old entries periodically
let lastCleanup = Date.now();
const cleanupOldEntries = () => {
  const now = Date.now();
  if (now - lastCleanup < RATE_LIMIT_CONFIG.cleanupInterval) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
};

/**
 * Get client identifier from request
 */
const getClientId = (req: VercelRequest): string => {
  // Use forwarded IP or direct IP
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? (forwarded.split(',')[0]?.trim() ?? 'unknown')
      : req.socket?.remoteAddress || 'unknown';

  return ip;
};

/**
 * Check rate limit for a request
 * Returns true if request should be allowed, false if rate limited
 */
export const checkRateLimit = (
  req: VercelRequest
): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} => {
  cleanupOldEntries();

  const clientId = getClientId(req);
  const now = Date.now();

  let entry = rateLimitStore.get(clientId);

  if (!entry || now > entry.resetTime) {
    // Create new entry
    entry = {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs,
    };
    rateLimitStore.set(clientId, entry);

    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.maxRequests - 1,
      resetIn: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  // Increment count
  entry.count++;

  const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequests - entry.count);
  const resetIn = Math.ceil((entry.resetTime - now) / 1000);

  return {
    allowed: entry.count <= RATE_LIMIT_CONFIG.maxRequests,
    remaining,
    resetIn,
  };
};

/**
 * Middleware-style rate limiter that sends response if limited
 * Returns true if request should continue, false if response was sent
 */
export const applyRateLimit = (req: VercelRequest, res: VercelResponse): boolean => {
  const { allowed, remaining, resetIn } = checkRateLimit(req);

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_CONFIG.maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', resetIn.toString());

  if (!allowed) {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Demasiadas solicitudes. Intenta de nuevo en ${resetIn} segundos.`,
    });
    return false;
  }

  return true;
};
