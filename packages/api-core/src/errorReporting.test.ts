import { describe, expect, it } from 'vitest';
import {
  createErrorReportingOptions,
  DEFAULT_IGNORE_ERRORS,
  redactSensitiveText,
  sanitizePath,
  sanitizeUrl,
  scrubBreadcrumb,
  scrubEvent,
  scrubText,
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

  it('redacts extra and custom contexts but not SDK contexts', () => {
    expect(out.extra).toEqual({
      note: 'mail *****************',
      nested: { amount: '*********' },
    });
    expect(out.contexts?.trace).toEqual(event.contexts?.trace);
    expect(out.contexts?.feedback).toEqual({
      message: 'my RFC is ************',
      contact_email: '*****************',
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
