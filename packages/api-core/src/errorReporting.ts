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
 * Browser support: no lookbehind or other syntax that older Safari (iOS < 16.4)
 * cannot parse. A parse error here would stop the whole app from loading.
 *
 * What is deliberately NOT here: SDK initialisation, user identity and
 * authorization. The app calls `Sentry.init(createErrorReportingOptions(...))`
 * and sets `Sentry.setUser({ id })` from its own session.
 */

// ── Text redaction ──────────────────────────────────────────────────────────

interface SensitivePattern {
  re: RegExp;
  /** The first capture group is a boundary character that stays unmasked. */
  keepsBoundary?: true;
  /** An IP address pattern; `ipAddresses: false` skips it (version strings). */
  ip?: true;
  /** Groups: boundary, key (both kept), value (masked). */
  keepsValueOnly?: true;
}

// Bounded quantifiers only: no unbounded runs that backtrack on long text.
const SENSITIVE_PATTERNS: readonly SensitivePattern[] = [
  // JSON Web Tokens (session cookies, signed links), also cut after the payload.
  { re: /\beyJ[A-Za-z0-9_-]{5,2048}\.[A-Za-z0-9_-]{2,4096}(?:\.[A-Za-z0-9_-]{0,2048})?/g },
  // Authorization header values.
  { re: /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,4096}/gi },
  // Cookie headers: everything after the header name.
  {
    re: /(^|[^A-Za-z0-9_-])((?:set-)?cookie\s{0,3}:\s{0,3})([^\r\n]{1,4096})/gi,
    keepsValueOnly: true,
  },
  // Credential assignments in text and serialized JSON: `token=…`,
  // `"accessToken":"…"`, `session: …`, `x-api-key=…`. The key stays readable.
  // Quoted values are masked up to their closing quote, punctuation included.
  {
    re: /(^|[^A-Za-z0-9_])([A-Za-z0-9_-]{0,32}(?:token|secret|password|passwd|api[_-]?key|session|sid|cookie|authorization|credential)[A-Za-z0-9_-]{0,32}"?\s{0,3}[:=]\s{0,3}")((?:[^"\\]|\\.){1,2048})/gi,
    keepsValueOnly: true,
  },
  {
    re: /(^|[^A-Za-z0-9_])([A-Za-z0-9_-]{0,32}(?:token|secret|password|passwd|api[_-]?key|session|sid|cookie|authorization|credential)[A-Za-z0-9_-]{0,32}'?\s{0,3}[:=]\s{0,3}')((?:[^'\\]|\\.){1,2048})/gi,
    keepsValueOnly: true,
  },
  {
    re: /(^|[^A-Za-z0-9_])([A-Za-z0-9_-]{0,32}(?:token|secret|password|passwd|api[_-]?key|session|sid|cookie|authorization|credential)[A-Za-z0-9_-]{0,32}["']?\s{0,3}[:=]\s{0,3})([^\s"',;&}]{1,2048})/gi,
    keepsValueOnly: true,
  },
  // Email address.
  { re: /[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,24}/gi },
  // CURP (18): 4 letters, date, sex, state, consonants, check digits.
  { re: /\b[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d\b/gi },
  // RFC for companies (12) or people (13), with or without separators. The
  // boundary group replaces `\b` (ASCII-only, misses Ñ and &) and a
  // lookbehind (unsupported before iOS 16.4).
  {
    re: /(^|[^A-Z0-9ÑÁÉÍÓÚÜ&])([A-ZÑ&]{3,4}[\s-]?\d{6}[\s-]?[A-Z0-9]{3})(?![A-Z0-9])/gi,
    keepsBoundary: true,
  },
  // IPv6, compressed (`2001:db8::1`) or full. Clock times never contain `::`.
  {
    re: /\b(?:[0-9A-F]{1,4}:){1,7}:(?:[0-9A-F]{1,4}(?::[0-9A-F]{1,4}){0,6})?\b|\b(?:[0-9A-F]{1,4}:){7}[0-9A-F]{1,4}\b/gi,
    ip: true,
  },
  // IPv6 with leading compression (`::1`, `::ffff:10.0.0.1`). The boundary
  // group keeps `std::vector` and `Foo::bar` readable.
  {
    re: /(^|[^0-9A-F:])(::[0-9A-F]{1,4}(?::[0-9A-F]{1,4}){0,6}(?::(?:\d{1,3}\.){3}\d{1,3})?)(?![0-9A-Z.])/gi,
    keepsBoundary: true,
    ip: true,
  },
  // IPv4.
  { re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, ip: true },
  // Amounts: $1,234.56 · $ 1234 · 1,234.56 MXN · MXN 1234.
  { re: /(?:\$|MXN)\s?-?\d[\d,]{0,20}(?:\.\d{1,4})?/gi },
  { re: /-?\d[\d,]{0,20}(?:\.\d{1,4})?\s?MXN\b/gi },
  // Phone numbers with separators: +52 55 1234 5678, (55) 1234-5678.
  { re: /\+?\d{1,3}?[\s.-]?\(?\d{2,3}\)?[\s.-]\d{3,4}[\s.-]\d{4}\b/g },
  // CLABE (18), cards, accounts and bare phone numbers: 10+ digits in a row,
  // optionally grouped by spaces or dashes.
  { re: /\b\d(?:[\s-]?\d){9,40}\b/g },
];

/** A string longer than this is masked whole instead of scanned. */
const MAX_REDACT_LENGTH = 4000;

const mask = (match: string) => match.replace(/\S/g, '*');

/**
 * Masks text shaped like a token, email, CURP, RFC, IP address, amount, phone,
 * CLABE or account number. Spaces are kept so the shape of a message stays
 * readable.
 */
export function redactSensitiveText(text: string, options: { ipAddresses?: boolean } = {}): string {
  if (!text) return text;
  if (text.length > MAX_REDACT_LENGTH) return mask(text);
  let out = text;
  for (const { re, keepsBoundary, keepsValueOnly, ip } of SENSITIVE_PATTERNS) {
    if (ip && options.ipAddresses === false) continue;
    if (keepsValueOnly) {
      out = out.replace(
        re,
        (_match, boundary: string, key: string, value: string) => `${boundary}${key}${mask(value)}`
      );
      continue;
    }
    out = keepsBoundary
      ? out.replace(re, (_match, boundary: string, value: string) => `${boundary}${mask(value)}`)
      : out.replace(re, mask);
  }
  return out;
}

// ── URLs ────────────────────────────────────────────────────────────────────

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
/** Long ids and tokens. The digit keeps long kebab-case route names readable. */
const OPAQUE_SEGMENT = /^(?=[0-9a-z_-]*\d)[0-9a-z_-]{20,}$/i;
/** Markers this module writes. Kept as they are so sanitising is idempotent. */
const MARKER_SEGMENT = /^\[(?:id|token|redacted)\]$/;

export interface UrlScrubOptions {
  /**
   * Public routes whose next path segment is a secret token, such as
   * `/conductor` for `/conductor/<token>`. Matching ignores case and trailing
   * slashes; the segment right after the prefix never leaves the app.
   */
  tokenRoutePrefixes?: readonly string[];
}

/** Index of the token segment in `path.split('/')`, or -1. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function tokenSegmentIndex(path: string, prefixes: readonly string[]): number {
  // Match on decoded segments: `/%63onductor/<token>` is the same route.
  const lower = path
    .split('/')
    .map(segment => decodeSegment(segment).toLowerCase())
    .join('/');
  for (const raw of prefixes) {
    const prefix = raw.toLowerCase().replace(/\/+$/, '');
    if (!prefix) continue;
    if (lower === prefix || lower.startsWith(`${prefix}/`)) return prefix.split('/').length;
  }
  return -1;
}

/**
 * Normalises a pathname: ids become `[id]`, the token of a token route becomes
 * `[token]`, and a segment with sensitive data becomes `[redacted]`. The
 * result also groups errors by route instead of by record.
 */
export function sanitizePath(pathname: string, options: UrlScrubOptions = {}): string {
  const path = (pathname || '/').replace(/\/+$/, '') || '/';
  const tokenIndex = tokenSegmentIndex(path, options.tokenRoutePrefixes ?? []);
  return (
    path
      .split('/')
      .map((segment, index) => {
        if (!segment || MARKER_SEGMENT.test(segment)) return segment;
        if (index === tokenIndex) return '[token]';
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
const IPV4_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** The origin, with an IP-literal host replaced by `[ip]`. */
function safeOrigin(url: URL): string {
  const host = url.hostname;
  if (!IPV4_HOST.test(host) && !host.startsWith('[')) return url.origin;
  return `${url.protocol}//[ip]${url.port ? `:${url.port}` : ''}`;
}

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
    return `${isAbsolute ? safeOrigin(url) : ''}${sanitizePath(url.pathname, options)}`;
  } catch {
    return redactSensitiveText(raw.split(/[?#]/)[0] ?? '');
  }
}

/**
 * Stack-frame file names: drops the query and hash and hides a token-route
 * secret, but keeps every other segment, so hashed bundle names still match
 * their source maps.
 */
export function stripUrlSecrets(raw: string, options: UrlScrubOptions = {}): string {
  if (!raw) return raw;
  const [base = ''] = raw.split(/[?#]/);
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/]*)?(\/.*)?$/i.exec(base);
  if (!match) return base;
  const origin = (match[1] ?? '').replace(
    /^([a-z][a-z0-9+.-]*:\/\/)(?:\d{1,3}(?:\.\d{1,3}){3}|\[[^\]]*\])/i,
    '$1[ip]'
  );
  const path = match[2] ?? '';
  const tokenIndex = tokenSegmentIndex(path, options.tokenRoutePrefixes ?? []);
  if (tokenIndex < 0) return `${origin}${path}`;
  const segments = path.split('/');
  if (segments[tokenIndex]) segments[tokenIndex] = '[token]';
  return `${origin}${segments.join('/')}`;
}

const URL_CHARS = `[^\\s"'<>\`]{1,2048}`;
const EMBEDDED_URL = new RegExp(`\\bhttps?:\\/\\/${URL_CHARS}`, 'gi');
/** `app.partrunner.com/conductor/<token>` without a scheme. */
const HOST_PATH = new RegExp(
  `(^|[\\s'"(=,])((?:[a-z0-9-]{1,63}\\.){1,10}[a-z]{2,24}(?::\\d{1,5})?\\/${URL_CHARS.replace('{1,2048}', '{0,2048}')})`,
  'gi'
);
/**
 * A path at the start of the text or after a space, quote, `(`, `=` or `,`:
 * `GET /api/x?y=z`, `Request failed: /conductor/<token>?rfc=…`.
 */
const RELATIVE_PATH = new RegExp(
  `(^|[\\s'"(=,])(\\/(?:[^\\s"'<>\`?#]{1,2048}(?:[?#]${URL_CHARS})?|[?#]${URL_CHARS}))`,
  'g'
);

/**
 * Sanitises every URL and path inside free text (with or without a scheme or
 * host), then redacts the rest.
 */
export function scrubText(text: string, options: UrlScrubOptions = {}): string {
  if (!text) return text;
  if (text.length > MAX_REDACT_LENGTH) return mask(text);
  return redactSensitiveText(
    text
      .replace(EMBEDDED_URL, url => sanitizeUrl(url, options))
      .replace(HOST_PATH, (_match, boundary: string, hostPath: string) => {
        return `${boundary}${sanitizeUrl(`https://${hostPath}`, options).replace(/^https:\/\//, '')}`;
      })
      .replace(
        RELATIVE_PATH,
        (_match, boundary: string, path: string) => `${boundary}${sanitizeUrl(path, options)}`
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
  fingerprint?: string[];
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: unknown;
      mechanism?: { data?: Record<string, unknown> };
    }>;
  };
  threads?: { values?: Array<{ stacktrace?: unknown }> };
  request?: {
    method?: string;
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
  spans?: ScrubbableSpan[];
  debug_meta?: unknown;
}

export interface ScrubbableBreadcrumb {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface ScrubbableSpan {
  description?: string;
  data?: Record<string, unknown>;
  links?: Array<{ attributes?: Record<string, unknown> }>;
}

export interface ScrubbableLog {
  message?: unknown;
  attributes?: Record<string, unknown>;
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

/** Tags this module sets. App code tags pass through the scrubber. */
const OWN_TAGS = new Set(['app', 'surface']);

/** `accessToken`, `x-api-key`, `url.full` → `access_token`, `x_api_key`, `url_full`. */
function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toLowerCase();
}

const keyWords = (words: string) => new RegExp(`(?:^|_)(?:${words})(?:_|$)`);
/** Values that are URLs or paths. */
const URL_KEY = keyWords('url|uri|href|from|to|referrer|referer|target|path|full');
/** Credentials and raw request parts: the whole entry is dropped. */
const SECRET_KEY = keyWords(
  'query|fragment|cookies?|authorization|auth|password|passwd|secret|token|api_?key|session|credentials?|signature|private_key|body'
);
/** Money and identity: the value is replaced whatever its type. */
const SENSITIVE_KEY = keyWords(
  'amount|monto|importe|subtotal|price|precio|salary|salario|balance|saldo|clabe|rfc|curp|phone|telefono|tel|email|correo|mail|account_number|cuenta|card|tarjeta|name|username|nombre|apellidos?|razon_social|address|direccion|ip|ip_address'
);
/** Numbers under these keys are times, not phones or accounts. */
const TEMPORAL_KEY = keyWords(
  'timestamp|time|date|epoch|ms|at|ts|start|end|duration|started|finished'
);
/** Version-like values that pattern redaction would mangle (`129.0.0.0`). */
const VERSION_KEY = keyWords('version|build|kernel_version');
const SAFE_VERSION = /^[\w.+\- ()]{1,64}$/;
/**
 * SDK runtime contexts whose `name` is a product name (`Chrome`, `iOS`,
 * `node`), not a person. `device` is not here: mobile SDKs put the owner's
 * device name there.
 */
const RUNTIME_NAMED_CONTEXTS = new Set(['app', 'browser', 'os', 'runtime', 'cloud_resource']);
const REDACTED = '[redacted]';
const MAX_DEPTH = 8;

function scrubValue(key: string, value: unknown, options: UrlScrubOptions, depth: number): unknown {
  if (typeof value === 'string') {
    return URL_KEY.test(normalizeKey(key))
      ? sanitizeUrl(value, options)
      : scrubText(value, options);
  }
  if (typeof value === 'number') {
    // 10+ integer digits is a phone, CLABE or account unless the key says time.
    return Math.abs(Math.trunc(value)) >= 1e9 && !TEMPORAL_KEY.test(normalizeKey(key))
      ? REDACTED
      : value;
  }
  if (typeof value === 'bigint') return REDACTED;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (depth >= MAX_DEPTH) return '[depth]';
  if (Array.isArray(value)) return value.map(item => scrubValue(key, item, options, depth + 1));
  return scrubRecord(value as Record<string, unknown>, options, depth + 1);
}

/** Applies the key rules to one entry and writes the result to `out`. */
function scrubEntry(
  out: Record<string, unknown>,
  key: string,
  value: unknown,
  options: UrlScrubOptions,
  depth: number
): void {
  const normalized = normalizeKey(key);
  if (SECRET_KEY.test(normalized)) return;
  // A key can itself be data (`{ 'flota@example.com': true }`).
  const safeKey = scrubText(key, options);
  if (SENSITIVE_KEY.test(normalized) && value !== null && value !== undefined) {
    out[safeKey] = REDACTED;
    return;
  }
  out[safeKey] = scrubValue(key, value, options, depth);
}

function scrubRecord(
  record: Record<string, unknown>,
  options: UrlScrubOptions,
  depth = 0
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) scrubEntry(out, key, value, options, depth);
  return out;
}

/** Trace fields that are ids or enums. Everything else in `trace` is scrubbed. */
const TRACE_KEEP = new Set([
  'trace_id',
  'span_id',
  'parent_span_id',
  'op',
  'status',
  'origin',
  'type',
  'sampled',
]);

/**
 * Contexts are scrubbed field by field. Trace ids and version strings are
 * kept; `response` keeps only its status code and body size (it can carry
 * cookies and `set-cookie` headers); every other field goes through the key
 * rules and pattern redaction.
 */
function scrubContext(name: string, context: unknown, options: UrlScrubOptions): unknown {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return scrubValue(name, context, options, 0);
  }
  const record = context as Record<string, unknown>;
  if (name === 'response') {
    const out: Record<string, unknown> = {};
    for (const key of ['type', 'status_code', 'body_size']) {
      if (typeof record[key] === 'number' || key === 'type') out[key] = record[key];
    }
    return out;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (name === 'trace' && TRACE_KEEP.has(key)) {
      out[key] = value;
    } else if (
      (VERSION_KEY.test(normalizeKey(key)) ||
        (key === 'name' && RUNTIME_NAMED_CONTEXTS.has(name))) &&
      typeof value === 'string' &&
      SAFE_VERSION.test(value)
    ) {
      out[key] = value;
    } else {
      scrubEntry(out, key, value, options, 1);
    }
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
    ...(breadcrumb.category !== undefined
      ? { category: scrubText(breadcrumb.category, options) }
      : {}),
    ...(breadcrumb.data ? { data: scrubRecord(breadcrumb.data, options) } : {}),
  };
}

/** `beforeSendSpan`: description and attributes scrubbed (streamed and standalone spans). */
export function scrubSpan<S extends ScrubbableSpan>(span: S, options: UrlScrubOptions = {}): S {
  return {
    ...span,
    ...(span.description !== undefined
      ? { description: scrubText(span.description, options) }
      : {}),
    ...(span.data ? { data: scrubRecord(span.data, options) } : {}),
    ...(Array.isArray(span.links)
      ? {
          links: span.links.map(link =>
            link?.attributes ? { ...link, attributes: scrubRecord(link.attributes, options) } : link
          ),
        }
      : {}),
  };
}

/** A user agent is printable ASCII without `@`; anything else is dropped. */
const SAFE_USER_AGENT = /^[A-Za-z0-9 .,;:/()+_~-]{1,512}$/;

function scrubHeaders(headers: Record<string, string>, options: UrlScrubOptions) {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (!SAFE_HEADERS.has(lower) || typeof value !== 'string') continue;
    if (lower === 'referer') {
      out[name] = sanitizeUrl(value, options);
    } else if (lower === 'user-agent') {
      // Browser versions look like IPv4 (`Chrome/129.0.0.0`): keep them, mask the rest.
      if (SAFE_USER_AGENT.test(value))
        out[name] = redactSensitiveText(value, { ipAddresses: false });
    } else {
      out[name] = scrubText(value, options);
    }
  }
  return out;
}

/** Frames keep everything grouping and source maps need; local variables go. */
function scrubStacktrace(stacktrace: unknown, options: UrlScrubOptions): unknown {
  if (!stacktrace || typeof stacktrace !== 'object') return stacktrace;
  const { frames } = stacktrace as { frames?: unknown };
  if (!Array.isArray(frames)) return stacktrace;
  return {
    ...stacktrace,
    frames: frames.map(frame => {
      if (!frame || typeof frame !== 'object') return frame;
      const rest = { ...(frame as Record<string, unknown>) };
      delete rest.vars;
      for (const key of ['filename', 'abs_path']) {
        const value = rest[key];
        if (typeof value === 'string') rest[key] = stripUrlSecrets(value, options);
      }
      return rest;
    }),
  };
}

/**
 * Debug ids map frames to source maps and stay. The SDK copies each frame's
 * file name into `code_file`, so that URL loses its query and token secret
 * the same way the frame's file name does.
 */
function scrubDebugMeta(debugMeta: unknown, options: UrlScrubOptions): unknown {
  if (!debugMeta || typeof debugMeta !== 'object') return debugMeta;
  const { images } = debugMeta as { images?: unknown };
  if (!Array.isArray(images)) return debugMeta;
  return {
    ...debugMeta,
    images: images.map(image => {
      if (!image || typeof image !== 'object') return image;
      const out = { ...(image as Record<string, unknown>) };
      for (const key of ['code_file', 'debug_file']) {
        const value = out[key];
        if (typeof value === 'string') out[key] = stripUrlSecrets(value, options);
      }
      return out;
    }),
  };
}

/** Fields `scrubEvent` rewrites explicitly. */
const HANDLED_FIELDS = new Set([
  'message',
  'logentry',
  'transaction',
  'fingerprint',
  'exception',
  'threads',
  'request',
  'user',
  'tags',
  'breadcrumbs',
  'extra',
  'contexts',
  'spans',
  'debug_meta',
]);

/**
 * SDK metadata kept as is: ids, times, levels, release, SDK and module
 * versions, debug ids (source maps) and measurements. `server_name`,
 * `logger` and anything unknown are scrubbed.
 */
const STRUCTURAL_FIELDS = new Set([
  'event_id',
  'timestamp',
  'start_timestamp',
  'level',
  'platform',
  'release',
  'dist',
  'environment',
  'type',
  'sdk',
  'modules',
  'measurements',
  'transaction_info',
  'sdkProcessingMetadata',
]);

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
 * - Messages, exception values, fingerprints, tags set by app code and
 *   exception mechanism data: URLs sanitised, then pattern-redacted.
 *   Exception types and stack frames are kept, so grouping and source maps
 *   still work; frame local variables are dropped and frame file names lose
 *   their query and token-route secret.
 * - Request: URL sanitised; query string, cookies, body and env dropped;
 *   headers reduced to an allowlist.
 * - User: only `id` is kept. No email, name or IP address.
 * - Breadcrumbs, `extra`, spans, `trace` data, `otel` and custom contexts:
 *   scrubbed.
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
  if (event.fingerprint) {
    out.fingerprint = event.fingerprint.map(part =>
      typeof part === 'string' ? scrubText(part, options) : part
    );
  }

  if (event.exception?.values) {
    out.exception = {
      ...event.exception,
      values: event.exception.values.map(value => ({
        ...value,
        ...(value.value !== undefined ? { value: scrubText(value.value, options) } : {}),
        ...(value.stacktrace !== undefined
          ? { stacktrace: scrubStacktrace(value.stacktrace, options) }
          : {}),
        ...(value.mechanism?.data
          ? { mechanism: { ...value.mechanism, data: scrubRecord(value.mechanism.data, options) } }
          : {}),
      })),
    };
  }
  if (event.threads?.values) {
    out.threads = {
      ...event.threads,
      values: event.threads.values.map(thread =>
        thread.stacktrace !== undefined
          ? { ...thread, stacktrace: scrubStacktrace(thread.stacktrace, options) }
          : thread
      ),
    };
  }

  if (event.request) {
    const { url, headers, method } = event.request;
    out.request = {
      ...(typeof method === 'string' && /^[A-Z]{3,7}$/.test(method) ? { method } : {}),
      ...(url !== undefined ? { url: sanitizeUrl(url, options) } : {}),
      ...(headers ? { headers: scrubHeaders(headers, options) } : {}),
    };
  }

  if (event.user) {
    out.user = event.user.id !== undefined ? { id: event.user.id } : {};
  }

  if (event.tags) {
    const tags: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(event.tags)) {
      if (OWN_TAGS.has(name)) {
        tags[name] = value;
      } else {
        scrubEntry(tags, name, value, options, 0);
      }
    }
    out.tags = tags;
  }

  if (event.breadcrumbs) {
    out.breadcrumbs = event.breadcrumbs.map(crumb => scrubBreadcrumb(crumb, options));
  }
  if (event.extra) out.extra = scrubRecord(event.extra, options);
  if (event.contexts) {
    const contexts: Record<string, unknown> = {};
    for (const [name, context] of Object.entries(event.contexts)) {
      const normalized = normalizeKey(name);
      // A context named after a credential or identity field gets the same
      // key rules as `extra`. SDK context names are never such words.
      if (SECRET_KEY.test(normalized)) continue;
      const safeName = scrubText(name, options);
      contexts[safeName] =
        SENSITIVE_KEY.test(normalized) && !RUNTIME_NAMED_CONTEXTS.has(name)
          ? REDACTED
          : scrubContext(name, context, options);
    }
    out.contexts = contexts;
  }
  if (event.spans) out.spans = event.spans.map(span => scrubSpan(span, options));
  if (event.debug_meta) out.debug_meta = scrubDebugMeta(event.debug_meta, options);

  // Every other top-level field is scrubbed unless it is structural SDK
  // metadata that carries no user content (ids, times, release, debug ids).
  const extraFields = out as Record<string, unknown>;
  for (const [key, value] of Object.entries(event)) {
    if (HANDLED_FIELDS.has(key) || STRUCTURAL_FIELDS.has(key)) continue;
    delete extraFields[key];
    scrubEntry(extraFields, key, value, options, 0);
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
  beforeSendSpan: <S extends ScrubbableSpan>(span: S) => S;
  /** Sentry Logs stay off: see `createErrorReportingOptions`. */
  enableLogs: false;
  beforeSendLog: <L extends ScrubbableLog>(log: L) => L | null;
  /** Sentry Metrics stay off, for the same reason as logs. */
  enableMetrics: false;
  beforeSendMetric: <M>(metric: M) => M | null;
  /** Spans are sent inside transactions, where `beforeSendTransaction` scrubs them. */
  traceLifecycle: 'static';
  beforeBreadcrumb: <B extends ScrubbableBreadcrumb>(breadcrumb: B) => B;
}

/**
 * Options to spread into `Sentry.init`. Every event gets the `app` and
 * `surface` tags and passes through `scrubEvent` before it leaves the app;
 * spans, logs and breadcrumbs pass through their own scrubbers.
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
    beforeSendSpan: span => scrubSpan(span, urlOptions),
    // Fail closed. Sentry merges scope attributes into a log AFTER
    // `beforeSendLog` runs, so no hook can scrub them: logs are not sent.
    enableLogs: false,
    beforeSendLog: () => null,
    // Same for metrics: on by default in Sentry 10, and scope attributes are
    // merged after `beforeSendMetric`.
    enableMetrics: false,
    beforeSendMetric: () => null,
    // Streamed spans (`traceLifecycle: 'stream'`) use another callback shape
    // with names and attributes that `beforeSendSpan` does not visit.
    traceLifecycle: 'static',
    beforeBreadcrumb: breadcrumb => scrubBreadcrumb(breadcrumb, urlOptions),
  };
}
