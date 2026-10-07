import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger as baseLogger, newRequestId, type Logger } from '../logger';
import type { ApiResponse } from '../types';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HandlerOptions {
  ctx: string;
  methods: readonly Method[];
  /**
   * Exact HTTP(S) origins allowed to make credentialed browser requests.
   * An empty list permits server-to-server and same-origin requests that send
   * no Origin header, but no cross-origin browser client.
   */
  allowedOrigins: readonly string[];
}

/**
 * Called once per request after the handler has finished, whether it succeeded
 * or threw. Where an app sends this — usage tables, an APM vendor, nowhere — is
 * the app's business, so it is injected rather than implemented here.
 */
export type RequestRecorder = (params: {
  req: VercelRequest;
  statusCode: number | null;
  durationMs: number;
}) => Promise<void> | void;

let recorder: RequestRecorder | null = null;

/**
 * Register per-request telemetry. Call once at startup; pass `null` to unset.
 *
 * Unset by default: an app that never calls this pays nothing, and no request
 * is ever failed because instrumentation is missing.
 */
export function configureRequestRecorder(fn: RequestRecorder | null): void {
  recorder = fn;
}

/**
 * Called when a handler throws, with the error the 500 envelope hides from the
 * client. Where it goes — an error tracker, nowhere — is the app's business.
 */
export type ErrorReporter = (params: {
  err: unknown;
  req: VercelRequest;
  ctx: string;
}) => Promise<void> | void;

let errorReporter: ErrorReporter | null = null;

/** Upper bound on how long a report may delay the 500 response. */
export const ERROR_REPORT_TIMEOUT_MS = 2000;

/**
 * Register error reporting for handler exceptions. Call once at startup; pass
 * `null` to unset. Unset by default.
 *
 * The reporter runs BEFORE the 500 response is written: Vercel can freeze a
 * function as soon as its response ends, so a report sent afterwards may never
 * leave. It is awaited for at most `ERROR_REPORT_TIMEOUT_MS`, and a reporter
 * that throws or hangs never changes the response. Make it flush its own
 * transport (for Sentry: `captureException` then `await flush(1500)`).
 */
export function configureErrorReporter(fn: ErrorReporter | null): void {
  errorReporter = fn;
}

async function reportError(params: Parameters<ErrorReporter>[0]): Promise<void> {
  if (!errorReporter) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => errorReporter?.(params)),
      new Promise<void>(resolve => {
        timer = setTimeout(resolve, ERROR_REPORT_TIMEOUT_MS);
      }),
    ]);
  } catch {
    /* error reporting never breaks the business path */
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type Handler = (
  req: VercelRequest,
  res: VercelResponse,
  logger: Logger
) => Promise<unknown> | unknown;

function canonicalOrigin(value: string, label: string): string {
  const candidate = value.trim();
  // Validate the authority-only wire shape before URL normalizes away empty
  // userinfo, query delimiters, or dot-segment paths.
  if (
    !/^https?:\/\/[^/?#@\\\s]+\/?$/i.test(candidate) ||
    candidate.replace(/\/$/, '').endsWith(':')
  ) {
    throw new TypeError(`${label} must be an exact HTTP(S) origin`);
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new TypeError(`${label} must be an exact HTTP(S) origin`);
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(`${label} must be an exact HTTP(S) origin`);
  }

  return url.origin;
}

export function withHandler(opts: HandlerOptions, fn: Handler) {
  const allowedOrigins = new Set(
    opts.allowedOrigins.map((origin) =>
      canonicalOrigin(origin, 'Configured allowed origin'),
    ),
  );

  return async (req: VercelRequest, res: VercelResponse) => {
    const rawOrigin = req.headers.origin;
    if (rawOrigin !== undefined) {
      let origin: string;
      try {
        if (typeof rawOrigin !== 'string') {
          throw new TypeError('Request origin must be singular');
        }
        origin = canonicalOrigin(rawOrigin, 'Request origin');
      } catch {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Origen no autorizado',
        } as ApiResponse);
      }

      if (!allowedOrigins.has(origin)) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Origen no autorizado',
        } as ApiResponse);
      }

      // Credentialed CORS must echo one validated origin. Wildcards are never
      // emitted, and Referer is not an authentication signal.
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', [...opts.methods, 'OPTIONS'].join(', '));
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-API-Key',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') return res.status(200).end();

    const requestId = newRequestId();
    res.setHeader('x-request-id', requestId);
    const logger = baseLogger.child({ request_id: requestId });

    if (!opts.methods.includes(req.method as Method)) {
      return res.status(405).json({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: `Use ${opts.methods.join('/')} request`,
      } as ApiResponse);
    }

    const startedAt = Date.now();
    // Set when the handler throws, so the recorded duration excludes the time
    // spent reporting the error.
    let failedAt: number | undefined;
    try {
      await fn(req, res, logger);
    } catch (err) {
      failedAt = Date.now();
      logger.error(opts.ctx, 'Unhandled error', { err });
      await reportError({ err, req, ctx: opts.ctx });
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
        } as ApiResponse);
      }
    } finally {
      // Runs AFTER the handler has written its response, so the client already
      // has its bytes: the await adds no perceived latency, it only keeps the
      // function alive a few extra ms.
      //
      // Awaited on purpose rather than fired and forgotten. On Vercel, work
      // still pending when the response returns can be frozen along with the
      // function, and there is no `waitUntil` here — silently dropping events
      // would be worse than spending those milliseconds.
      //
      // The try/catch is belt and braces: a recorder is expected to swallow its
      // own failures, but a buggy one must never take down a response that has
      // already been sent.
      if (recorder) {
        try {
          await recorder({
            req,
            statusCode: res.statusCode ?? null,
            durationMs: (failedAt ?? Date.now()) - startedAt,
          });
        } catch {
          /* instrumentation never breaks the business path */
        }
      }
    }
  };
}
