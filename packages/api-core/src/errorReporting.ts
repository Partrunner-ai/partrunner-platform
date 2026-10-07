/**
 * Shared error-reporting policy for PartRunner apps.
 *
 * Every app sends crashes, exceptions and traces to the same error tracker
 * (Sentry). The tracker groups and alerts; this module decides what leaves the
 * app. It is a **shared privacy rule**, not a convenience: fleet pages show
 * RFCs, CURPs, CLABEs, amounts and public links whose path is a secret token,
 * and one app with a weaker filter leaks them for every app.
 *
 * The module is pure and framework-free. It does not import a Sentry SDK: the
 * event types below are structural, so `@sentry/react`, `@sentry/nextjs` and
 * `@sentry/node` events all fit, and the app keeps its own SDK version.
 *
 * What is deliberately NOT here: SDK initialisation, user identity and
 * authorization. The app calls `Sentry.init(createErrorReportingOptions(...))`
 * and sets `Sentry.setUser({ id })` from its own session.
 */

// ── Text redaction ──────────────────────────────────────────────────────────

// Bounded quantifiers only: no unbounded runs that backtrack on long text.
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  // JSON Web Tokens (session cookies, signed links).
  /\beyJ[A-Za-z0-9_-]{5,2048}\.[A-Za-z0-9_-]{5,4096}\.[A-Za-z0-9_-]{5,2048}/g,
  // Authorization header values.
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,4096}/gi,
  // Email address.
  /[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,24}/gi,
  // CURP (18): 4 letters, date, sex, state, consonants, check digits.
  /\b[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d\b/gi,
  // RFC for companies (12) or people (13), with or without separators. The
  // explicit boundaries replace `\b`, which is ASCII-only and misses Ñ and &.
  /(?<![A-Z0-9ÑÁÉÍÓÚÜ&])[A-ZÑ&]{3,4}[\s-]?\d{6}[\s-]?[A-Z0-9]{3}(?![A-Z0-9])/gi,
  // Amounts: $1,234.56 · $ 1234 · 1,234.56 MXN · MXN 1234.
  /(?:\$|MXN)\s?-?\d[\d,]{0,20}(?:\.\d{1,4})?/gi,
  /-?\d[\d,]{0,20}(?:\.\d{1,4})?\s?MXN\b/gi,
  // Phone numbers with separators: +52 55 1234 5678, (55) 1234-5678.
  /\+?\d{1,3}?[\s.-]?\(?\d{2,3}\)?[\s.-]\d{3,4}[\s.-]\d{4}\b/g,
  // CLABE (18), cards, accounts and bare phone numbers: 10+ digits in a row,
  // optionally grouped by spaces or dashes.
  /\b\d(?:[\s-]?\d){9,40}\b/g,
];

/** A string longer than this is masked whole instead of scanned. */
const MAX_REDACT_LENGTH = 4000;

const mask = (match: string) => match.replace(/\S/g, '*');

/**
 * Masks text shaped like a token, email, CURP, RFC, amount, phone, CLABE or
 * account number. Spaces are kept so the shape of a message stays readable.
 */
export function redactSensitiveText(text: string): string {
  if (!text) return text;
  if (text.length > MAX_REDACT_LENGTH) return mask(text);
  let out = text;
  for (const pattern of SENSITIVE_PATTERNS) out = out.replace(pattern, mask);
  return out;
}

// ── URLs ────────────────────────────────────────────────────────────────────

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const OPAQUE_SEGMENT = /^[0-9a-z_-]{20,}$/i;

export interface UrlScrubOptions {
  /**
   * Public routes whose second path segment is a secret token, such as
   * `/conductor/<token>`. That segment never leaves the app.
   */
  tokenRoutePrefixes?: readonly string[];
}

function matchesPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Normalises a pathname: ids become `[id]`, the token of a token route becomes
 * `[token]`, and a segment with sensitive data becomes `[redacted]`. The
 * result also groups errors by route instead of by record.
 */
export function sanitizePath(pathname: string, options: UrlScrubOptions = {}): string {
  const path = (pathname || '/').replace(/\/+$/, '') || '/';
  const tokenRoute = matchesPrefix(path, options.tokenRoutePrefixes ?? []);
  return (
    path
      .split('/')
      .map((segment, index) => {
        if (!segment) return segment;
        if (tokenRoute && index === 2) return '[token]';
        if (
          UUID_SEGMENT.test(segment) ||
          NUMERIC_SEGMENT.test(segment) ||
          OPAQUE_SEGMENT.test(segment)
        ) {
          return '[id]';
        }
        let decoded = segment;
        try {
          decoded = decodeURIComponent(segment);
        } catch {
          /* Malformed encoding: evaluate the raw segment. */
        }
        return redactSensitiveText(decoded) === decoded ? segment : '[redacted]';
      })
      .join('/') || '/'
  );
}

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Absolute or relative URL → same origin, sanitised path, no query string and
 * no hash. The query carries RFCs, folios and session tokens; it is dropped
 * whole. A URL that does not parse comes back redacted, without its query.
 */
export function sanitizeUrl(raw: string, options: UrlScrubOptions = {}): string {
  if (!raw) return raw;
  try {
    const url = new URL(raw, 'https://invalid.local');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return `${url.protocol}[redacted]`;
    }
    const isAbsolute = ABSOLUTE_URL.test(raw) || raw.startsWith('//');
    return `${isAbsolute ? url.origin : ''}${sanitizePath(url.pathname, options)}`;
  } catch {
    return redactSensitiveText(raw.split(/[?#]/)[0] ?? '');
  }
}

const EMBEDDED_URL = /\bhttps?:\/\/[^\s"'<>`]{1,2048}/gi;
/** `GET /api/x?y=z` in transaction names, span descriptions and fetch errors. */
const METHOD_PATH = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s"'<>`]{0,2048})/g;

/**
 * Sanitises every absolute URL and every `METHOD /path` inside free text, then
 * redacts the rest.
 */
export function scrubText(text: string, options: UrlScrubOptions = {}): string {
  if (!text) return text;
  if (text.length > MAX_REDACT_LENGTH) return mask(text);
  return redactSensitiveText(
    text
      .replace(EMBEDDED_URL, url => sanitizeUrl(url, options))
      .replace(
        METHOD_PATH,
        (_match, method: string, path: string) => `${method} ${sanitizeUrl(path, options)}`
      )
  );
}

// ── Events ──────────────────────────────────────────────────────────────────

/**
 * Structural subset of a Sentry event. Every field is optional and loosely
 * typed so that the SDK's own `ErrorEvent` and `TransactionEvent` fit without
 * an SDK dependency.
 */
export interface ScrubbableEvent {
  message?: string;
  logentry?: { message?: string; params?: unknown[] };
  transaction?: string;
  exception?: {
    values?: Array<{ type?: string; value?: string; stacktrace?: unknown }>;
  };
  request?: {
    url?: string;
    query_string?: unknown;
    cookies?: unknown;
    data?: unknown;
    env?: unknown;
    headers?: Record<string, string>;
  };
  user?: { id?: string | number } & Record<string, unknown>;
  breadcrumbs?: ScrubbableBreadcrumb[];
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  spans?: Array<{ description?: string; data?: Record<string, unknown> }>;
}

export interface ScrubbableBreadcrumb {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
}

/** Request headers that carry no identity. Every other header is dropped. */
const SAFE_HEADERS = new Set([
  'accept',
  'accept-language',
  'content-type',
  'host',
  'referer',
  'user-agent',
]);

/**
 * Contexts the SDK fills with runtime facts (versions, trace ids, status
 * codes). Pattern redaction would mangle their ids, so they pass unchanged.
 * Every other context, including user feedback, is redacted.
 */
const SDK_CONTEXTS = new Set([
  'app',
  'browser',
  'cloud_resource',
  'culture',
  'device',
  'os',
  'otel',
  'react',
  'response',
  'runtime',
  'trace',
]);

const URL_KEY = /(?:^|[._])(?:url|href|from|to|referrer|referer)$/i;
const DROPPED_DATA_KEY = /(?:^|[._])(?:query|fragment|cookies?|authorization|password|token)$/i;
const MAX_DEPTH = 8;

function scrubValue(key: string, value: unknown, options: UrlScrubOptions, depth: number): unknown {
  if (typeof value === 'string') {
    return URL_KEY.test(key) ? sanitizeUrl(value, options) : scrubText(value, options);
  }
  if (depth >= MAX_DEPTH) return '[depth]';
  if (Array.isArray(value)) return value.map(item => scrubValue(key, item, options, depth + 1));
  if (value && typeof value === 'object')
    return scrubRecord(value as Record<string, unknown>, options, depth + 1);
  return value;
}

function scrubRecord(
  record: Record<string, unknown>,
  options: UrlScrubOptions,
  depth = 0
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (DROPPED_DATA_KEY.test(key)) continue;
    out[key] = scrubValue(key, value, options, depth);
  }
  return out;
}

/** `beforeBreadcrumb`: URLs normalised, messages and data redacted. */
export function scrubBreadcrumb<B extends ScrubbableBreadcrumb>(
  breadcrumb: B,
  options: UrlScrubOptions = {}
): B {
  return {
    ...breadcrumb,
    ...(breadcrumb.message !== undefined
      ? { message: scrubText(breadcrumb.message, options) }
      : {}),
    ...(breadcrumb.data ? { data: scrubRecord(breadcrumb.data, options) } : {}),
  };
}

function scrubHeaders(headers: Record<string, string>, options: UrlScrubOptions) {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (!SAFE_HEADERS.has(lower)) continue;
    out[name] = lower === 'referer' ? sanitizeUrl(value, options) : value;
  }
  return out;
}

/** Path of the page or route that produced the event, before sanitising. */
export function eventPath(event: ScrubbableEvent): string | undefined {
  const url = event.request?.url;
  if (url) {
    try {
      return new URL(url, 'https://invalid.local').pathname;
    } catch {
      return undefined;
    }
  }
  const transaction = event.transaction?.replace(/^[A-Z]+\s+/, '');
  return transaction?.startsWith('/') ? transaction.split(/[?#]/)[0] : undefined;
}

/**
 * Removes identity and sensitive text from an error or transaction event.
 *
 * - Exception and log messages: URLs sanitised, then pattern-redacted.
 *   Exception types and stack frames are kept, so grouping and source maps
 *   still work.
 * - Request: URL sanitised; query string, cookies, body and env dropped;
 *   headers reduced to an allowlist.
 * - User: only `id` is kept. No email, name or IP address.
 * - Breadcrumbs, `extra`, custom contexts and span descriptions: redacted.
 */
export function scrubEvent<E extends ScrubbableEvent>(event: E, options: UrlScrubOptions = {}): E {
  const out: ScrubbableEvent = { ...event };

  if (event.message !== undefined) out.message = scrubText(event.message, options);
  if (event.logentry) {
    out.logentry = {
      ...event.logentry,
      ...(event.logentry.message !== undefined
        ? { message: scrubText(event.logentry.message, options) }
        : {}),
      ...(event.logentry.params
        ? {
            params: event.logentry.params.map(p => scrubValue('param', p, options, 0)),
          }
        : {}),
    };
  }
  if (event.transaction !== undefined) {
    out.transaction = event.transaction.startsWith('/')
      ? sanitizeUrl(event.transaction, options)
      : scrubText(event.transaction, options);
  }

  if (event.exception?.values) {
    out.exception = {
      ...event.exception,
      values: event.exception.values.map(value =>
        value.value !== undefined ? { ...value, value: scrubText(value.value, options) } : value
      ),
    };
  }

  if (event.request) {
    const { url, headers } = event.request;
    out.request = {
      ...(url !== undefined ? { url: sanitizeUrl(url, options) } : {}),
      ...(headers ? { headers: scrubHeaders(headers, options) } : {}),
    };
  }

  if (event.user) {
    out.user = event.user.id !== undefined ? { id: event.user.id } : {};
  }

  if (event.breadcrumbs) {
    out.breadcrumbs = event.breadcrumbs.map(crumb => scrubBreadcrumb(crumb, options));
  }
  if (event.extra) out.extra = scrubRecord(event.extra, options);
  if (event.contexts) {
    const contexts: Record<string, unknown> = {};
    for (const [name, context] of Object.entries(event.contexts)) {
      contexts[name] = SDK_CONTEXTS.has(name) ? context : scrubValue(name, context, options, 0);
    }
    out.contexts = contexts;
  }
  if (event.spans) {
    out.spans = event.spans.map(span => ({
      ...span,
      ...(span.description !== undefined
        ? { description: scrubText(span.description, options) }
        : {}),
      ...(span.data ? { data: scrubRecord(span.data, options) } : {}),
    }));
  }

  return out as E;
}

// ── SDK options ─────────────────────────────────────────────────────────────

/**
 * Who the user of the failing screen is. Alert routing and the weekly digest
 * split by this tag.
 *
 * - `fleet`: flotilleros and drivers (STF `/user`, registration, onboarding).
 * - `backoffice`: PartRunner staff apps and admin screens.
 * - `client`: customer-facing screens.
 */
export type ErrorReportingSurface = 'fleet' | 'backoffice' | 'client';

export interface ErrorReportingConfig extends UrlScrubOptions {
  /** App registry id, such as `sube-tu-factura` or `nexus-portal`. */
  app: string;
  /** Surface for events whose path `surfaceForPath` does not classify. */
  surface: ErrorReportingSurface;
  /** Without a DSN the SDK stays disabled. */
  dsn?: string | null;
  /** `production`, `preview` or `development`. Defaults to `development`. */
  environment?: string | null;
  /** Commit SHA of the build, so issues map to a deploy and to source maps. */
  release?: string | null;
  /** Share of page loads and requests traced. Defaults to 0.05. */
  tracesSampleRate?: number;
  /** Classifies an event's page or route path when one app serves several surfaces. */
  surfaceForPath?: (path: string) => ErrorReportingSurface | undefined;
  /** Extra noise to ignore, added to the shared defaults. */
  ignoreErrors?: ReadonlyArray<string | RegExp>;
  /** Set `false` to keep the SDK off even when a DSN is present. */
  enabled?: boolean;
}

/** Browser noise that is never actionable. Network failures stay visible. */
export const DEFAULT_IGNORE_ERRORS: ReadonlyArray<string | RegExp> = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  'Non-Error promise rejection captured',
  /^AbortError\b/,
  'signal is aborted without reason',
  'The user aborted a request',
];

/** Scripts injected by browser extensions. */
export const DEFAULT_DENY_URLS: ReadonlyArray<RegExp> = [
  /^(?:chrome|moz|safari(?:-web)?)-extension:\/\//i,
  /^chrome:\/\//i,
  /extensions\//i,
];

export const DEFAULT_TRACES_SAMPLE_RATE = 0.05;

export interface ErrorReportingOptions {
  dsn: string | undefined;
  enabled: boolean;
  environment: string;
  release: string | undefined;
  sendDefaultPii: false;
  tracesSampleRate: number;
  maxBreadcrumbs: number;
  initialScope: { tags: { app: string } };
  ignoreErrors: Array<string | RegExp>;
  denyUrls: RegExp[];
  beforeSend: <E extends ScrubbableEvent>(event: E) => E;
  beforeSendTransaction: <E extends ScrubbableEvent>(event: E) => E;
  beforeBreadcrumb: <B extends ScrubbableBreadcrumb>(breadcrumb: B) => B;
}

/**
 * Options to spread into `Sentry.init`. Every event gets the `app` and
 * `surface` tags and passes through `scrubEvent` before it leaves the app.
 *
 * ```ts
 * Sentry.init({
 *   ...createErrorReportingOptions({
 *     app: 'sube-tu-factura',
 *     surface: 'fleet',
 *     dsn: import.meta.env.VITE_SENTRY_DSN,
 *     environment: import.meta.env.VITE_VERCEL_ENV,
 *     release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA,
 *     tokenRoutePrefixes: ['/conductor', '/afiliacion'],
 *     surfaceForPath: path => (path.startsWith('/admin') ? 'backoffice' : undefined),
 *   }),
 *   integrations: [Sentry.browserTracingIntegration()],
 * });
 * ```
 */
export function createErrorReportingOptions(config: ErrorReportingConfig): ErrorReportingOptions {
  const urlOptions: UrlScrubOptions = {
    tokenRoutePrefixes: config.tokenRoutePrefixes ?? [],
  };
  const dsn = config.dsn || undefined;

  const tag = <E extends ScrubbableEvent>(event: E): E => {
    // Classify on the raw path: sanitising first would hide the route prefix.
    const path = eventPath(event);
    const surface =
      (typeof event.tags?.surface === 'string' ? event.tags.surface : undefined) ??
      (path !== undefined ? config.surfaceForPath?.(path) : undefined) ??
      config.surface;
    const scrubbed = scrubEvent(event, urlOptions);
    return {
      ...scrubbed,
      tags: { ...scrubbed.tags, app: config.app, surface },
    };
  };

  return {
    dsn,
    enabled: Boolean(dsn) && config.enabled !== false,
    environment: config.environment || 'development',
    release: config.release || undefined,
    sendDefaultPii: false,
    tracesSampleRate: config.tracesSampleRate ?? DEFAULT_TRACES_SAMPLE_RATE,
    maxBreadcrumbs: 50,
    initialScope: { tags: { app: config.app } },
    ignoreErrors: [...DEFAULT_IGNORE_ERRORS, ...(config.ignoreErrors ?? [])],
    denyUrls: [...DEFAULT_DENY_URLS],
    beforeSend: tag,
    beforeSendTransaction: tag,
    beforeBreadcrumb: breadcrumb => scrubBreadcrumb(breadcrumb, urlOptions),
  };
}
