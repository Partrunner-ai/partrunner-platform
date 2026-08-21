/**
 * Lightweight structured logger for serverless functions.
 * - Production: JSON lines for log aggregators.
 * - Development: plain console output with context prefix.
 *
 * Use `log.child({...})` at the top of a handler to bind request-scoped fields
 * (e.g. request_id, invoice_uuid) to every subsequent log line.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type LogLevel = keyof typeof LEVELS;

const MIN_LEVEL: number = (() => {
  const raw = (process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug')).toLowerCase();
  return (LEVELS as Record<string, number>)[raw] ?? LEVELS.info;
})();

type Meta = Record<string, unknown>;

function serializeError(err: unknown): Meta {
  if (err instanceof Error) {
    const out: Meta = { message: err.message, name: err.name };
    if (err.stack) out.stack = err.stack;
    const code = (err as { code?: unknown }).code;
    if (code !== undefined) out.code = code;
    return out;
  }
  return { value: err };
}

function normalizeMeta(meta?: Meta): Meta | undefined {
  if (!meta) return undefined;
  const out: Meta = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = k === 'err' || v instanceof Error ? serializeError(v) : v;
  }
  return out;
}

function emit(level: LogLevel, context: string, message: string, bound: Meta, meta?: Meta) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const mergedMeta = { ...bound, ...(normalizeMeta(meta) ?? {}) };
  const hasMeta = Object.keys(mergedMeta).length > 0;

  if (IS_PROD) {
    const entry = {
      level,
      ts: new Date().toISOString(),
      ctx: context,
      msg: message,
      ...(hasMeta ? { meta: mergedMeta } : {}),
    };
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    fn(JSON.stringify(entry));
  } else {
    const prefix = `[${context}]`;
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    fn(prefix, message, hasMeta ? mergedMeta : '');
  }
}

export interface Logger {
  debug(ctx: string, msg: string, meta?: Meta): void;
  info(ctx: string, msg: string, meta?: Meta): void;
  warn(ctx: string, msg: string, meta?: Meta): void;
  error(ctx: string, msg: string, meta?: Meta): void;
  child(bindings: Meta): Logger;
}

function make(bound: Meta): Logger {
  return {
    debug: (ctx, msg, meta) => emit('debug', ctx, msg, bound, meta),
    info: (ctx, msg, meta) => emit('info', ctx, msg, bound, meta),
    warn: (ctx, msg, meta) => emit('warn', ctx, msg, bound, meta),
    error: (ctx, msg, meta) => emit('error', ctx, msg, bound, meta),
    child: bindings => make({ ...bound, ...bindings }),
  };
}

/** Canonical structured logger. Prefer the per-request logger from `withHandler`; use this only in shared lib code where no request logger is available. */
export const logger: Logger = make({});

export function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
