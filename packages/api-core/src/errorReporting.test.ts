import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { htmlTreeAsString } from '@sentry/core';
import { describe, expect, it } from 'vitest';
import {
  createErrorReportingOptions,
  DEFAULT_IGNORE_ERRORS,
  dynamicSamplingContextScrubber,
  redactSensitiveText,
  sanitizePath,
  sanitizeUrl,
  scrubBreadcrumb,
  scrubEvent,
  scrubText,
  stripDomAttributeValues,
  stripUrlSecrets,
  withoutUnsafeIntegrations,
  type ScrubbableEvent,
} from './observability';

const TOKEN_ROUTES = { tokenRoutePrefixes: ['/conductor', '/afiliacion'] };
const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImZsZWV0In0.c2lnbmF0dXJlLXZhbHVl';

describe('redactSensitiveText', () => {
  it.each([
    ['RFC persona moral', 'RFC ABC010203XY1 no coincide', 'RFC ************ no coincide'],
    ['RFC persona física', 'emisor GODE561231GR8', 'emisor *************'],
    ['RFC con Ñ', 'emisor ÑAÑO800101AB1', 'emisor *************'],
    ['CURP', 'CURP GODE561231HDFRRN09', 'CURP ******************'],
    ['CLABE', 'clabe 002180700000000017', 'clabe ******************'],
    ['email', 'sent to flota@example.com', 'sent to *****************'],
    ['amount', 'total $12,345.67 pending', 'total ********** pending'],
    ['phone', 'tel +52 55 1234 5678', 'tel *** ** **** ****'],
  ])('masks %s', (_label, input, expected) => {
    expect(redactSensitiveText(input)).toBe(expected);
  });

  it('masks session tokens and authorization values', () => {
    expect(redactSensitiveText(`cookie nexus_token=${JWT}`)).not.toContain('eyJ');
    expect(redactSensitiveText('Authorization: Bearer abcdefgh12345678')).toBe(
      'Authorization: ****** ****************'
    );
  });

  it('leaves ordinary error text readable', () => {
    const text = "TypeError: Cannot read properties of undefined (reading 'map')";
    expect(redactSensitiveText(text)).toBe(text);
  });

  it('masks very long text whole instead of scanning it', () => {
    const long = 'x'.repeat(5000);
    expect(redactSensitiveText(long)).toBe('*'.repeat(5000));
  });
});

describe('sanitizePath and sanitizeUrl', () => {
  it('replaces ids and keeps the route shape', () => {
    expect(sanitizePath('/user/facturas/3f2504e0-4f89-11d3-9a0c-0305e82c3301/42')).toBe(
      '/user/facturas/[id]/[id]'
    );
  });

  it('hides the secret segment of a token route', () => {
    expect(sanitizePath('/conductor/abc123/documentos', TOKEN_ROUTES)).toBe(
      '/conductor/[token]/documentos'
    );
    expect(sanitizePath('/conductor/abc123')).toBe('/conductor/abc123');
  });

  it('redacts a segment that carries sensitive data', () => {
    expect(sanitizePath('/flotas/ABC010203XY1/facturas')).toBe('/flotas/[redacted]/facturas');
  });

  it('drops query and hash and keeps the origin of an absolute URL', () => {
    expect(sanitizeUrl('https://www.partrunner.app/user/flota?rfc=ABC010203XY1#x')).toBe(
      'https://www.partrunner.app/user/flota'
    );
    expect(sanitizeUrl('/api/cfdi/99?token=secret')).toBe('/api/cfdi/[id]');
  });

  it('never keeps the payload of a non-http URL', () => {
    expect(sanitizeUrl('data:text/plain;base64,SGVsbG8=')).toBe('data:[redacted]');
  });
});

describe('scrubText', () => {
  it('sanitises embedded URLs and method paths, then redacts', () => {
    expect(
      scrubText(
        'Failed to fetch https://api.partrunner.app/v1/flotas/123?rfc=ABC010203XY1 for flota@example.com'
      )
    ).toBe('Failed to fetch https://api.partrunner.app/v1/flotas/[id] for *****************');
    expect(scrubText('GET /afiliacion/tok_abc/paso?x=1', TOKEN_ROUTES)).toBe(
      'GET /afiliacion/[token]/paso'
    );
  });
});

describe('scrubBreadcrumb', () => {
  it('sanitises navigation and fetch URLs and drops query data', () => {
    expect(
      scrubBreadcrumb(
        {
          category: 'navigation',
          data: { from: '/conductor/abc123?x=1', to: '/user/facturas/77' },
        },
        TOKEN_ROUTES
      )
    ).toEqual({
      category: 'navigation',
      data: { from: '/conductor/[token]', to: '/user/facturas/[id]' },
    });
    expect(
      scrubBreadcrumb({
        category: 'fetch',
        data: {
          url: 'https://x.test/api?y=1',
          'http.query': '?y=1',
          status_code: 500,
        },
      })
    ).toEqual({
      category: 'fetch',
      data: { url: 'https://x.test/api', status_code: 500 },
    });
  });

  it('redacts console messages', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'RFC ABC010203XY1' }).message).toBe(
      'RFC ************'
    );
  });
});

describe('scrubEvent', () => {
  const stacktrace = {
    frames: [{ filename: '/assets/index-Dz8k2a9QpL3mN7vX1yB4.js', lineno: 1 }],
  };
  const event: ScrubbableEvent = {
    message: 'Upload failed for ABC010203XY1',
    transaction: 'GET /api/flotas/123/facturas?rfc=ABC010203XY1',
    exception: {
      values: [
        {
          type: 'Error',
          value: 'CLABE 002180700000000017 invalid',
          stacktrace,
        },
      ],
    },
    request: {
      url: 'https://www.partrunner.app/conductor/tok_secret?step=2',
      query_string: 'step=2',
      cookies: { nexus_token: JWT },
      data: { rfc: 'ABC010203XY1' },
      env: { REMOTE_ADDR: '10.0.0.1' },
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Cookie: `nexus_token=${JWT}`,
        Authorization: 'Bearer abcdefgh12345678',
        Referer: 'https://www.partrunner.app/user/flota?rfc=ABC010203XY1',
      },
    },
    user: {
      id: 'u-1',
      email: 'flota@example.com',
      ip_address: '10.0.0.1',
      username: 'Flota',
    },
    extra: {
      note: 'mail flota@example.com',
      token: 'abc',
      nested: { amount: '$1,000.00' },
    },
    contexts: {
      trace: {
        trace_id: '0123456789abcdef0123456789abcdef',
        span_id: '0123456789abcdef',
      },
      feedback: {
        message: 'my RFC is ABC010203XY1',
        contact_email: 'flota@example.com',
      },
    },
    spans: [
      {
        description: 'GET https://api.test/v1/x?rfc=ABC010203XY1',
        data: { 'http.query': 'rfc=x' },
      },
    ],
    tags: { surface: 'fleet' },
  };

  const out = scrubEvent(event, TOKEN_ROUTES);

  it('redacts messages but keeps exception types and stack frames for grouping', () => {
    expect(out.message).toBe('Upload failed for ************');
    expect(out.exception?.values?.[0]).toEqual({
      type: 'Error',
      value: 'CLABE ****************** invalid',
      stacktrace,
    });
    expect(out.transaction).toBe('GET /api/flotas/[id]/facturas');
  });

  it('keeps only a sanitised URL and safe headers from the request', () => {
    expect(out.request).toEqual({
      url: 'https://www.partrunner.app/conductor/[token]',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://www.partrunner.app/user/flota',
      },
    });
  });

  it('keeps only the user id', () => {
    expect(out.user).toEqual({ id: 'u-1' });
  });

  it('redacts extra and contexts but keeps trace ids', () => {
    expect(out.extra).toEqual({
      note: 'mail *****************',
      nested: { amount: '[redacted]' },
    });
    expect(out.contexts?.trace).toEqual(event.contexts?.trace);
    expect(out.contexts?.feedback).toEqual({
      message: 'my RFC is ************',
      contact_email: '[redacted]',
    });
  });

  it('sanitises span descriptions and drops span query data', () => {
    expect(out.spans).toEqual([{ description: 'GET https://api.test/v1/x', data: {} }]);
  });

  it('does not mutate the input event', () => {
    expect(event.user?.email).toBe('flota@example.com');
    expect(event.request?.cookies).toBeDefined();
  });

  it('leaves no sensitive value anywhere in the serialised event', () => {
    const json = JSON.stringify(out);
    for (const secret of [
      'ABC010203XY1',
      '002180700000000017',
      'flota@example.com',
      'tok_secret',
      JWT,
      'abcdefgh12345678',
      '10.0.0.1',
    ]) {
      expect(json).not.toContain(secret);
    }
  });
});

describe('createErrorReportingOptions', () => {
  const base = {
    app: 'sube-tu-factura',
    surface: 'fleet' as const,
    dsn: 'https://key@o1.ingest.sentry.io/1',
    environment: 'production',
    release: 'abc123',
    ...TOKEN_ROUTES,
    surfaceForPath: (path: string) =>
      path.startsWith('/admin') ? ('backoffice' as const) : undefined,
  };

  it('is disabled without a DSN or when switched off', () => {
    expect(createErrorReportingOptions({ ...base, dsn: '' }).enabled).toBe(false);
    expect(createErrorReportingOptions({ ...base, dsn: null }).dsn).toBeUndefined();
    expect(createErrorReportingOptions({ ...base, enabled: false }).enabled).toBe(false);
    expect(createErrorReportingOptions(base).enabled).toBe(true);
  });

  it('never sends default PII and defaults environment and sample rate', () => {
    const options = createErrorReportingOptions({
      app: 'fds',
      surface: 'backoffice',
    });
    expect(options.sendDefaultPii).toBe(false);
    expect(options.environment).toBe('development');
    expect(options.tracesSampleRate).toBe(0.05);
    expect(options.release).toBeUndefined();
    expect(options.initialScope).toEqual({ tags: { app: 'fds' } });
  });

  it('adds app noise to the shared ignore list', () => {
    const options = createErrorReportingOptions({
      ...base,
      ignoreErrors: ['Custom noise'],
    });
    expect(options.ignoreErrors).toEqual([...DEFAULT_IGNORE_ERRORS, 'Custom noise']);
  });

  it('tags app and surface from the raw path, then scrubs', () => {
    const { beforeSend } = createErrorReportingOptions(base);
    const admin = beforeSend<ScrubbableEvent>({
      request: { url: 'https://www.partrunner.app/admin/finanzas/77?x=1' },
    });
    expect(admin.tags).toEqual({
      app: 'sube-tu-factura',
      surface: 'backoffice',
    });
    expect(admin.request?.url).toBe('https://www.partrunner.app/admin/finanzas/[id]');

    const fleet = beforeSend<ScrubbableEvent>({
      request: { url: 'https://www.partrunner.app/conductor/tok_secret' },
    });
    expect(fleet.tags).toEqual({ app: 'sube-tu-factura', surface: 'fleet' });

    const server = createErrorReportingOptions(base).beforeSendTransaction<ScrubbableEvent>({
      transaction: 'POST /admin/pagos/99',
    });
    expect(server.tags?.surface).toBe('backoffice');
    expect(server.transaction).toBe('POST /admin/pagos/[id]');
  });

  it('lets an explicit surface tag win over the path rule', () => {
    const { beforeSend } = createErrorReportingOptions(base);
    const event = beforeSend({
      request: { url: 'https://x.test/admin' },
      tags: { surface: 'client' },
    });
    expect(event.tags?.surface).toBe('client');
  });

  it('scrubs breadcrumbs through the same URL rules', () => {
    const { beforeBreadcrumb } = createErrorReportingOptions(base);
    expect(
      beforeBreadcrumb({
        category: 'navigation',
        data: { to: '/afiliacion/tok_1' },
      }).data
    ).toEqual({
      to: '/afiliacion/[token]',
    });
  });
});

describe('review regressions', () => {
  it('ships no lookbehind, which older iOS Safari cannot parse', () => {
    const source = readFileSync(join(import.meta.dirname, 'errorReporting.ts'), 'utf8');
    expect(source).not.toMatch(/\(\?<[!=]/);
  });

  it('keeps the RFC boundary character when masking', () => {
    expect(redactSensitiveText('(ABC010203XY1)')).toBe('(************)');
    expect(redactSensitiveText('ABC010203XY1')).toBe('************');
  });

  it('masks IP addresses and truncated JWTs', () => {
    expect(redactSensitiveText('connect ECONNREFUSED 203.0.113.45:5432 from 2001:db8::1')).toBe(
      'connect ECONNREFUSED ************:5432 from ***********'
    );
    expect(redactSensitiveText('at 12:30:45')).toBe('at 12:30:45');
    expect(redactSensitiveText('eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImFAYi5jb20ifQ')).not.toContain(
      'eyJ'
    );
  });

  it('sanitises relative paths and host paths without a scheme in free text', () => {
    expect(
      scrubText('Request failed: /conductor/AbCdEf12345?rfc=foo&folio=F-998', TOKEN_ROUTES)
    ).toBe('Request failed: /conductor/[token]');
    expect(scrubText('see app.partrunner.com/conductor/AbCdEf12345?x=1', TOKEN_ROUTES)).toBe(
      'see app.partrunner.com/conductor/[token]'
    );
    expect(scrubText('ratio 3 / 4 and 10/07/2026')).toBe('ratio 3 / 4 and 10/07/2026');
  });

  it('is idempotent on its own output', () => {
    const once = scrubText('GET /afiliacion/tok_abc/paso?x=1 https://a.test/u/42', TOKEN_ROUTES);
    expect(scrubText(once, TOKEN_ROUTES)).toBe(once);
  });

  it('matches token routes nested, with trailing slashes and in any case', () => {
    const options = { tokenRoutePrefixes: ['/api/conductor/', '/Afiliacion'] };
    expect(sanitizePath('/api/conductor/AbCdEf12345/docs', options)).toBe(
      '/api/conductor/[token]/docs'
    );
    expect(sanitizePath('/AFILIACION/tok.short~1', options)).toBe('/AFILIACION/[token]');
  });

  it('keeps long kebab-case route names readable', () => {
    expect(sanitizePath('/api/weekly-adjustments-approve/x')).toBe(
      '/api/weekly-adjustments-approve/x'
    );
    expect(sanitizePath('/api/finance/payment-receipt-archive')).toBe(
      '/api/finance/payment-receipt-archive'
    );
    expect(sanitizePath('/r/a1b2c3d4e5f6g7h8i9j0k')).toBe('/r/[id]');
  });

  it('scrubs trace data and otel attributes but keeps trace ids', () => {
    const out = scrubEvent(
      {
        contexts: {
          trace: {
            trace_id: '0123456789abcdef0123456789abcdef',
            span_id: '0123456789abcdef',
            op: 'http.server',
            data: {
              'http.target': '/conductor/SecretTok?rfc=XAXX010101000',
              'url.full': 'https://a.com/conductor/SecretTok?x=1',
              'url.path': '/conductor/SecretTok',
              'client.address': '203.0.113.9',
            },
          },
          otel: { attributes: { 'http.target': '/conductor/SecretTok?x=1' } },
        },
      },
      TOKEN_ROUTES
    );
    expect(out.contexts?.trace).toEqual({
      trace_id: '0123456789abcdef0123456789abcdef',
      span_id: '0123456789abcdef',
      op: 'http.server',
      data: {
        'http.target': '/conductor/[token]',
        'url.full': 'https://a.com/conductor/[token]',
        'url.path': '/conductor/[token]',
        'client.address': '[redacted]',
      },
    });
    expect(JSON.stringify(out.contexts?.otel)).not.toContain('SecretTok');
  });

  it('scrubs app tags, fingerprints, mechanism data, frame vars, frame URLs and threads', () => {
    const frames = [
      {
        filename: 'https://www.partrunner.app/conductor/SecretTok?x=1',
        abs_path: '/assets/index-Dz8k2a9QpL3mN7vX1yB4.js',
        function: 'onSubmit',
        lineno: 3,
        vars: { rfc: 'ABC010203XY1' },
      },
    ];
    const out = scrubEvent(
      {
        tags: { rfc: 'XAXX010101000', email: 'a@b.com', app: 'stf', release_channel: 'stable' },
        fingerprint: ['{{ default }}', 'flota@example.com'],
        exception: {
          values: [
            {
              type: 'Error',
              mechanism: { data: { url: '/x?rfc=ABC010203XY1' } },
              stacktrace: { frames },
            },
          ],
        },
        threads: { values: [{ stacktrace: { frames } }] },
      },
      TOKEN_ROUTES
    );
    const expectedFrame = {
      filename: 'https://www.partrunner.app/conductor/[token]',
      abs_path: '/assets/index-Dz8k2a9QpL3mN7vX1yB4.js',
      function: 'onSubmit',
      lineno: 3,
    };
    expect(out.tags).toEqual({
      rfc: '[redacted]',
      email: '[redacted]',
      app: 'stf',
      release_channel: 'stable',
    });
    expect(out.fingerprint).toEqual(['{{ default }}', '*****************']);
    expect(out.exception?.values?.[0]?.mechanism).toEqual({ data: { url: '/x' } });
    expect(out.exception?.values?.[0]?.stacktrace).toEqual({ frames: [expectedFrame] });
    expect(out.threads?.values?.[0]?.stacktrace).toEqual({ frames: [expectedFrame] });
  });

  it('keeps dates and deep primitives readable', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: 1 } } } } } } } } };
    const out = scrubEvent({ extra: { when: new Date('2026-10-07T00:00:00Z'), deep } });
    expect(out.extra?.when).toBe('2026-10-07T00:00:00.000Z');
    expect(JSON.stringify(out.extra?.deep)).toContain('[depth]');
    expect(scrubEvent({ extra: { n: 5 } }).extra).toEqual({ n: 5 });
  });

  it('scrubs streamed spans and never sends logs', () => {
    const options = createErrorReportingOptions({
      app: 'fds',
      surface: 'backoffice',
      ...TOKEN_ROUTES,
    });
    expect(
      options.beforeSendSpan({
        description: 'GET /conductor/SecretTok?x=1',
        data: { 'user.email': 'a@b.com', 'user.ip_address': '10.0.0.1', 'http.query': 'x=1' },
      })
    ).toEqual({
      description: 'GET /conductor/[token]',
      data: { 'user.email': '[redacted]', 'user.ip_address': '[redacted]' },
    });
    expect(options.enableLogs).toBe(false);
    expect(options.beforeSendLog({ message: 'payout for ABC010203XY1' })).toBeNull();
  });
});

describe('second review regressions', () => {
  it('reduces the response context to status and size, and scrubs trace tags', () => {
    const out = scrubEvent({
      contexts: {
        response: {
          status_code: 500,
          body_size: 12,
          cookies: { session: 'abc' },
          headers: { 'set-cookie': 'nexus_token=x' },
        },
        trace: { trace_id: 't1', span_id: 's1', tags: { owner: 'flota@example.com' } },
      },
    });
    expect(out.contexts?.response).toEqual({ type: undefined, status_code: 500, body_size: 12 });
    expect(out.contexts?.trace).toEqual({
      trace_id: 't1',
      span_id: 's1',
      tags: { owner: '*****************' },
    });
  });

  it('keeps runtime versions that look like IPs but scrubs other runtime fields', () => {
    const out = scrubEvent({
      contexts: {
        browser: { name: 'Chrome', version: '129.0.0.0' },
        os: { name: 'iOS', version: '17.4.1', build: '21E236' },
        device: { model: 'iPhone15,2', owner: 'flota@example.com' },
      },
    });
    expect(out.contexts?.browser).toEqual({ name: 'Chrome', version: '129.0.0.0' });
    expect(out.contexts?.os).toEqual({ name: 'iOS', version: '17.4.1', build: '21E236' });
    expect(out.contexts?.device).toEqual({ model: 'iPhone15,2', owner: '*****************' });
  });

  it('scrubs top-level fields it does not know and keeps SDK metadata', () => {
    const debugMeta = { images: [{ type: 'sourcemap', debug_id: 'abc', code_file: '/a.js' }] };
    const out = scrubEvent({
      server_name: '203.0.113.45',
      event_id: '0123456789abcdef0123456789abcdef',
      release: '1.2.3-20261007123456',
      debug_meta: debugMeta,
      custom: 'flota@example.com',
    } as ScrubbableEvent);
    const record = out as Record<string, unknown>;
    expect(record.server_name).toBe('[redacted]');
    expect(record.event_id).toBe('0123456789abcdef0123456789abcdef');
    expect(record.release).toBe('1.2.3-20261007123456');
    expect(record.debug_meta).toEqual(debugMeta);
    expect(record.custom).toBe('*****************');
  });

  it('scrubs breadcrumb categories', () => {
    expect(scrubBreadcrumb({ category: 'flota@example.com' }).category).toBe('*****************');
    expect(scrubBreadcrumb({ category: 'ui.click' }).category).toBe('ui.click');
  });

  it('applies key rules whatever the value type, and masks keys that are data', () => {
    const out = scrubEvent({
      extra: {
        amount: 1234.56,
        phone: 5512345678,
        accessToken: 'opaqueSecret',
        'x-api-key': 'k',
        'flota@example.com': true,
        count: 3,
        startedAt: 1791393615188,
        orderNumber: 12345678901,
      },
    });
    expect(out.extra).toEqual({
      amount: '[redacted]',
      phone: '[redacted]',
      '*****************': true,
      count: 3,
      startedAt: 1791393615188,
      orderNumber: '[redacted]',
    });
  });

  it('scrubs allowlisted header values', () => {
    const out = scrubEvent({
      request: {
        method: 'POST',
        url: 'https://x.test/a',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/129.0.0.0 Safari/537.36',
          'Content-Type': 'text/plain; owner=flota@example.com',
          Host: '203.0.113.45',
          Accept: 'text/html',
        },
      },
    });
    expect(out.request).toEqual({
      method: 'POST',
      url: 'https://x.test/a',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/129.0.0.0 Safari/537.36',
        'Content-Type': 'text/plain; owner=*****************',
        Host: '************',
        Accept: 'text/html',
      },
    });
    const weird = scrubEvent({ request: { headers: { 'user-agent': 'bot flota@example.com' } } });
    expect(weird.request?.headers).toEqual({});
  });

  it('hides IP-literal hosts in URLs and frame file names', () => {
    expect(sanitizeUrl('http://203.0.113.45:8080/api?token=secret')).toBe('http://[ip]:8080/api');
    expect(sanitizeUrl('http://[2001:db8::1]/x/42')).toBe('http://[ip]/x/[id]');
    expect(scrubText('fetch http://10.0.0.1/api failed')).toBe('fetch http://[ip]/api failed');
    const out = scrubEvent({
      exception: {
        values: [{ stacktrace: { frames: [{ filename: 'http://10.1.2.3/assets/app.js?v=1' }] } }],
      },
    });
    expect(out.exception?.values?.[0]?.stacktrace).toEqual({
      frames: [{ filename: 'http://[ip]/assets/app.js' }],
    });
  });
});

describe('third review regressions', () => {
  it('matches token routes through percent-encoding', () => {
    expect(sanitizePath('/%63onductor/SecretTok', TOKEN_ROUTES)).toBe('/%63onductor/[token]');
    expect(stripUrlSecrets('https://x.test/%63onductor/SecretTok/a.js', TOKEN_ROUTES)).toBe(
      'https://x.test/%63onductor/[token]/a.js'
    );
  });

  it('sanitises keys and context names that carry URLs', () => {
    const out = scrubEvent(
      {
        extra: { '/conductor/AbC123?folio=F-1': true },
        contexts: { 'https://x.test/conductor/AbC123': { ok: true } },
      },
      TOKEN_ROUTES
    );
    expect(out.extra).toEqual({ '/conductor/[token]': true });
    expect(out.contexts).toEqual({ 'https://x.test/conductor/[token]': { ok: true } });
  });

  it('applies key rules to unknown top-level fields', () => {
    const out = scrubEvent({
      accessToken: 'opaqueSecret',
      amount: 1234.56,
      note: 'flota@example.com',
    } as ScrubbableEvent) as Record<string, unknown>;
    expect(out).not.toHaveProperty('accessToken');
    expect(out.amount).toBe('[redacted]');
    expect(out.note).toBe('*****************');
  });

  it('masks IPv6 addresses with leading compression and keeps code paths readable', () => {
    expect(redactSensitiveText('connect ECONNREFUSED ::1:5432')).toBe(
      'connect ECONNREFUSED ********'
    );
    expect(redactSensitiveText('from ::ffff:10.0.0.1 now')).toBe('from *************** now');
    expect(redactSensitiveText('std::vector Foo::bar at 12:30:45')).toBe(
      'std::vector Foo::bar at 12:30:45'
    );
  });
});

describe('architecture review regressions', () => {
  it('redacts bare name keys in app data but keeps runtime product names', () => {
    const out = scrubEvent({
      extra: { customer: { name: 'Ana Operadora', username: 'ana' } },
      contexts: {
        browser: { name: 'Chrome', version: '129.0.0.0' },
        device: { name: "Ana's iPhone", model: 'iPhone15,2' },
      },
    });
    expect(out.extra).toEqual({ customer: { name: '[redacted]', username: '[redacted]' } });
    expect(out.contexts?.browser).toEqual({ name: 'Chrome', version: '129.0.0.0' });
    expect(out.contexts?.device).toEqual({ name: '[redacted]', model: 'iPhone15,2' });
  });
});

describe('fifth review regressions', () => {
  it('masks cookie headers and credential assignments in text and JSON strings', () => {
    expect(redactSensitiveText('Cookie: session=opaqueSecret; theme=dark')).toBe(
      'Cookie: ********************* **********'
    );
    expect(redactSensitiveText('retry with token=opaqueSecret&x=1')).toBe(
      'retry with token=************&x=1'
    );
    expect(redactSensitiveText('{"accessToken":"opaqueSecret","ok":true}')).toBe(
      '{"accessToken":"************","ok":true}'
    );
    expect(redactSensitiveText('x-api-key: abcdef123')).toBe('x-api-key: *********');
    expect(redactSensitiveText('session expired, sign in again')).toBe(
      'session expired, sign in again'
    );
  });

  it('turns metrics off and pins static tracing', () => {
    const options = createErrorReportingOptions({ app: 'fds', surface: 'backoffice' });
    expect(options.enableMetrics).toBe(false);
    expect(options.beforeSendMetric({ name: 'payout' })).toBeNull();
    expect(options.traceLifecycle).toBe('static');
  });
});

describe('sixth review regressions', () => {
  it('masks quoted credentials through their closing quote, and short values', () => {
    expect(redactSensitiveText('{"password":"s;Tr0ng Pass!","ok":true}')).toBe(
      '{"password":"******* *****","ok":true}'
    );
    expect(redactSensitiveText("auth token='a b;c' sent")).toBe("auth token='* ***' sent");
    expect(redactSensitiveText('session=a')).toBe('session=*');
  });

  it('sanitises root paths that carry only a query or a hash', () => {
    expect(scrubText('GET /?code=OAuthSecret done')).toBe('GET / done');
    expect(scrubText('redirect to /#access_token=secret')).toBe('redirect to /');
    expect(scrubText('ratio 3 / 4')).toBe('ratio 3 / 4');
  });

  it('applies key rules to context names', () => {
    const out = scrubEvent({
      contexts: {
        session: { value: 'opaqueSecret' },
        authorization: { scheme: 'x' },
        customer_email: { primary: 'x' },
        browser: { name: 'Chrome' },
      },
    });
    expect(out.contexts).toEqual({ customer_email: '[redacted]', browser: { name: 'Chrome' } });
  });
});

describe('seventh review regressions', () => {
  it('consumes the whole relative path, punctuation included', () => {
    expect(scrubText('GET /conductor/abc+SecretTok?code=OAuthSecret', TOKEN_ROUTES)).toBe(
      'GET /conductor/[token]'
    );
    expect(scrubText('see /files/a;b@c/x?y=1 now')).toBe('see /files/a;b@c/x now');
  });

  it('strips URL secrets from debug_meta but keeps debug ids', () => {
    const out = scrubEvent(
      {
        debug_meta: {
          images: [
            {
              type: 'sourcemap',
              debug_id: '11111111-1111-1111-1111-111111111111',
              code_file: 'https://app.test/conductor/SecretTok/app.js?token=x',
            },
          ],
        },
      },
      TOKEN_ROUTES
    );
    expect(out.debug_meta).toEqual({
      images: [
        {
          type: 'sourcemap',
          debug_id: '11111111-1111-1111-1111-111111111111',
          code_file: 'https://app.test/conductor/[token]/app.js',
        },
      ],
    });
  });
});

describe('eighth review regressions', () => {
  it('never cuts a long value short inside the length bound', () => {
    const url = `https://x.test/?padding=${'a'.repeat(2100)}&code=OAuthSecret`;
    expect(scrubText(`failed ${url}`)).toBe('failed https://x.test/');
    const quoted = `{"token":"${'b'.repeat(2100)}Secret"}`;
    expect(redactSensitiveText(quoted)).not.toContain('Secret');
  });

  it('masks short authorization values', () => {
    expect(redactSensitiveText('Authorization: Basic YTpi')).toBe('Authorization: ***** ****');
    expect(redactSensitiveText('Bearer abc')).toBe('****** ***');
  });

  it('scrubs IPs and URLs in user agents but keeps product versions', () => {
    const out = scrubEvent(
      {
        request: {
          headers: {
            'User-Agent':
              'ExampleBot/1.0 (+http://203.0.113.9/conductor/SecretTok) Chrome/129.0.0.0',
          },
        },
      },
      TOKEN_ROUTES
    );
    expect(out.request?.headers).toEqual({
      'User-Agent': 'ExampleBot/1.0 (+http://[ip]/conductor/[token] Chrome/129.0.0.0',
    });
  });
});

describe('performance', () => {
  it('stays linear on adversarial inputs at the length bound', () => {
    const inputs = [
      '/'.repeat(3999),
      ' /a'.repeat(1333),
      'token='.repeat(666),
      '1-'.repeat(1999),
      ':a'.repeat(1999),
      `https://${'a/'.repeat(1990)}`,
      ('abc@' + '1'.repeat(10) + ' ').repeat(250),
    ];
    const started = performance.now();
    for (const input of inputs) scrubText(input.slice(0, 3999), TOKEN_ROUTES);
    // Measured at ~10 ms in total; the bound only catches catastrophic backtracking.
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('ninth review regressions', () => {
  it('masks a whole Authorization header, Digest parameters included', () => {
    expect(
      redactSensitiveText(
        'Authorization: Digest username="alice", nonce="opaqueNonce", response="opaqueResponse"'
      )
    ).not.toMatch(/alice|opaqueNonce|opaqueResponse/);
  });

  it('removes URL credentials from frame and debug file names', () => {
    expect(stripUrlSecrets('https://alice:opaquePassword@example.test/app.js')).toBe(
      'https://example.test/app.js'
    );
    expect(stripUrlSecrets('https://alice:pw@10.0.0.1/app.js')).toBe('https://[ip]/app.js');
    expect(sanitizeUrl('https://alice:pw@example.test/x')).toBe('https://example.test/x');
  });

  it('masks IPv6 addresses that end in compression', () => {
    expect(redactSensitiveText('connect ECONNREFUSED 2001:db8::')).toBe(
      'connect ECONNREFUSED **********'
    );
    expect(redactSensitiveText('fe80:: up')).toBe('****** up');
    expect(redactSensitiveText('std::vector Foo::bar')).toBe('std::vector Foo::bar');
  });
});

describe('session integrations', () => {
  it('removes integrations whose payloads bypass the hooks', () => {
    const defaults = [{ name: 'BrowserSession' }, { name: 'Dedupe' }, { name: 'ProcessSession' }];
    expect(withoutUnsafeIntegrations(defaults)).toEqual([{ name: 'Dedupe' }]);
  });
});

describe('tenth review regressions', () => {
  it('fails closed on URLs that do not parse', () => {
    expect(sanitizeUrl('https://example.test:bad/conductor/SecretTok', TOKEN_ROUTES)).toBe(
      '[unparsed-url]'
    );
    expect(
      scrubText('fetch https://example.test:bad/conductor/SecretTok failed', TOKEN_ROUTES)
    ).toBe('fetch [unparsed-url] failed');
  });
});

/** A minimal element for Sentry's real `htmlTreeAsString` (no DOM in Node). */
function fakeElement(
  tagName: string,
  attrs: Record<string, string> = {},
  className = '',
  parentNode: unknown = null
) {
  return {
    tagName,
    className,
    id: attrs.id ?? '',
    parentNode,
    getAttribute: (name: string) => attrs[name] ?? null,
  };
}

describe('DOM interaction breadcrumbs', () => {
  const board = () => fakeElement('DIV', {}, 'board');
  const selectorFor = (label: string, parent: unknown = board()) =>
    htmlTreeAsString(
      fakeElement(
        'BUTTON',
        { 'aria-label': label, type: 'button' },
        'ticket-card',
        parent
      ) as never,
      { maxStringLength: 4000 }
    );

  it.each([
    'Ticket de Juana Prueba: no puedo subir',
    'Ticket "urgente" ] de Juana Prueba',
    'Juana Prueba > div[title="x"]',
    'x"] > span.Juana.Prueba[title="y',
    "Ticket de Juana Prueba' ] [x",
  ])('keeps only the real element path for aria-label %s', label => {
    const message = selectorFor(label);
    expect(message).toContain('Juana');
    const out = scrubBreadcrumb({ category: 'ui.click', message }).message;
    expect(out).toBe('div.board > button.ticket-card[…]');
  });

  it('stops at the first attribute, also on an ancestor', () => {
    const labelled = fakeElement('SECTION', { title: 'Cliente Juana Prueba' }, 'panel');
    const out = scrubBreadcrumb({
      category: 'ui.click',
      message: selectorFor('x', labelled),
    }).message;
    expect(out).toBe('section.panel[…]');
  });

  it('is idempotent through beforeBreadcrumb and beforeSend', () => {
    const { beforeBreadcrumb, beforeSend } = createErrorReportingOptions({
      app: 'fds',
      surface: 'backoffice',
    });
    const crumb = beforeBreadcrumb({ category: 'ui.click', message: selectorFor('Juana Prueba') });
    const event = beforeSend<ScrubbableEvent>({ breadcrumbs: [crumb] });
    expect(event.breadcrumbs).toEqual([
      { category: 'ui.click', message: 'div.board > button.ticket-card[…]' },
    ]);
  });

  it('is idempotent on its own output', () => {
    const once = stripDomAttributeValues(selectorFor('Juana Prueba'));
    expect(stripDomAttributeValues(once)).toBe(once);
  });

  it('redacts license plates by key', () => {
    expect(
      scrubEvent({ extra: { placa: 'ABC-123-D', vehicle: { licensePlate: '123ABC4' } } }).extra
    ).toEqual({ placa: '[redacted]', vehicle: { licensePlate: '[redacted]' } });
  });

  it('leaves non-DOM breadcrumbs alone', () => {
    expect(scrubBreadcrumb({ category: 'navigation', message: 'value [a="b"]' }).message).toBe(
      'value [a="b"]'
    );
  });

  it('removes console breadcrumbs from outgoing events', () => {
    const { beforeSend } = createErrorReportingOptions({ app: 'sales', surface: 'backoffice' });
    const event = beforeSend<ScrubbableEvent>({
      breadcrumbs: [
        {
          category: 'console',
          message: 'tool createClient {"company":"Transportes Juana","notes":"llamar"}',
          data: { arguments: [{ company: 'Transportes Juana' }] },
        },
        { category: 'navigation', data: { to: '/x' } },
      ],
    });
    expect(event.breadcrumbs).toEqual([{ category: 'navigation', data: { to: '/x' } }]);
  });
});

describe('DOM selectors in spans and web vitals', () => {
  const button = (label: string) =>
    htmlTreeAsString(
      fakeElement(
        'BUTTON',
        { 'aria-label': label, type: 'button' },
        'ticket-card',
        fakeElement('DIV', {}, 'board')
      ) as never,
      { maxStringLength: 4000 }
    );
  const article = (title: string) =>
    htmlTreeAsString(
      fakeElement('ARTICLE', { title }, 'ticket', fakeElement('MAIN')) as never,
      { maxStringLength: 4000 }
    );

  it('cuts the INP interaction span description', () => {
    const { beforeSendSpan } = createErrorReportingOptions({ app: 'fds', surface: 'backoffice' });
    const description = button('Ticket de Juana Prueba');
    expect(description).toContain('Juana');
    const span = beforeSendSpan({
      op: 'ui.interaction.click',
      description,
      data: { 'sentry.op': 'ui.interaction.click' },
    } as never) as { description: string };
    expect(span.description).toBe('div.board > button.ticket-card[…]');
  });

  it('cuts lcp.element and cls.source.N on the transaction', () => {
    const event = scrubEvent({
      type: 'transaction',
      contexts: {
        trace: {
          data: {
            'lcp.element': article('Cliente Juana Prueba'),
            'cls.source.1': button('Juana Prueba'),
          },
        },
      },
      spans: [{ op: 'ui.interaction.click', description: button('Juana Prueba') }],
    } as unknown as ScrubbableEvent);
    const all = JSON.stringify(event);
    expect(all).not.toContain('Juana');
    expect(all).toContain('main > article.ticket[…]');
    expect(all).toContain('div.board > button.ticket-card[…]');
  });

  it('cuts an attribute selector inside a message', () => {
    expect(scrubText('Invalid value at input.rfc[name="Juana Prueba"] in form')).toBe(
      'Invalid value at input.rfc[…]'
    );
  });

  it('keeps brackets that are not SDK attribute selectors', () => {
    expect(scrubText('items[0] failed: data-x=[1,2]')).toBe('items[0] failed: data-x=[1,2]');
  });

  it('is idempotent', () => {
    const once = scrubText(button('Juana Prueba'));
    expect(scrubText(once)).toBe(once);
  });

  it.each([
    ['type', 'input.rfc[type="text"][name="Juana Prueba"]'],
    ['alt', 'img.avatar[alt="Foto de Juana Prueba"]'],
    ['title', "td.cell[title='Juana Prueba']"],
  ])('cuts when %s is the first attribute', (_attribute, selector) => {
    expect(scrubText(selector)).toBe(`${selector.slice(0, selector.indexOf('['))}[…]`);
  });

  it('cuts before the length check, so a long label keeps the element path', () => {
    const description = button(`Ticket de Juana Prueba ${'x '.repeat(3000)}`);
    expect(description.length).toBeGreaterThan(4000);
    // The SDK keeps the first element whole and drops ancestors past the limit.
    expect(scrubText(description)).toBe('button.ticket-card[…]');
  });
});

describe('dynamicSamplingContextScrubber', () => {
  const run = (transaction: string | undefined) => {
    let hook: ((dsc: { transaction?: string }) => void) | undefined;
    dynamicSamplingContextScrubber(TOKEN_ROUTES).setup({
      on: (_name, callback) => {
        hook = callback;
      },
    });
    const dsc: { transaction?: string; trace_id: string } = { transaction, trace_id: 'abc' };
    hook?.(dsc);
    return dsc;
  };

  it('cuts a selector name and scrubs paths in place', () => {
    expect(run('div.board > button.ticket-card[aria-label="Juana Prueba"]').transaction).toBe(
      'div.board > button.ticket-card[…]'
    );
    expect(run('GET /conductor/SecretTok').transaction).toBe('GET /conductor/[token]');
  });

  it('keeps parameterised names and other fields', () => {
    expect(run('/tickets/:id')).toEqual({ transaction: '/tickets/:id', trace_id: 'abc' });
    expect(run(undefined)).toEqual({ transaction: undefined, trace_id: 'abc' });
  });
});
