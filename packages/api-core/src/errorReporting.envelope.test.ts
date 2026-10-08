/**
 * Outbound proof with the real Sentry SDK (`@sentry/core` 10, dev dependency).
 *
 * The unit tests check `scrubEvent` on event objects. This test checks what
 * would actually leave the app: a real client, the shared options, and a
 * transport that captures the serialized envelopes, including envelope and
 * item headers (dynamic sampling context) that no event hook can touch.
 */
import {
  ServerRuntimeClient,
  createStackParser,
  createTransport,
  getCurrentScope,
  getIsolationScope,
  logger,
  metrics,
  nodeStackLineParser,
  setCurrentClient,
  startInactiveSpan,
  startSpan,
} from '@sentry/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createErrorReportingOptions, dynamicSamplingContextScrubber } from './observability';

const SECRETS = [
  'ABC010203XY1', // RFC
  'GODE561231HDFRRN09', // CURP
  '002180700000000017', // CLABE
  '5512345678', // phone
  'flota@example.com',
  'Ana Operadora',
  'Juan Perez',
  'SecretTok',
  '203.0.113.9',
  '10.0.0.1',
  'opaqueSecret',
  'Tr0ngPass',
  'OAuthSecret',
  'Rosa Ticket',
  'Luis Standalone',
];

const bodies: string[] = [];
let client: ServerRuntimeClient;

beforeAll(() => {
  const decoder = new TextDecoder();
  client = new ServerRuntimeClient({
    ...createErrorReportingOptions({
      app: 'sube-tu-factura',
      surface: 'fleet',
      dsn: 'https://public@o1.ingest.sentry.io/1',
      environment: 'production',
      release: 'abc123',
      tracesSampleRate: 1,
      tokenRoutePrefixes: ['/conductor'],
    }),
    integrations: [dynamicSamplingContextScrubber({ tokenRoutePrefixes: ['/conductor'] })],
    stackParser: createStackParser(nodeStackLineParser()),
    transport: options =>
      createTransport(options, async request => {
        bodies.push(typeof request.body === 'string' ? request.body : decoder.decode(request.body));
        return { statusCode: 200 };
      }),
  });
  setCurrentClient(client);
  client.init();

  // A debug-id-instrumented bundle whose URL carries a secret query: the SDK
  // copies the frame file name into debug_meta.images[].code_file.
  const bundleFrame = '    at upload (https://app.test/assets/app.js?token=SecretTok:1:1)';
  (globalThis as { _sentryDebugIds?: Record<string, string> })._sentryDebugIds = {
    [`Error\n${bundleFrame}`]: '11111111-1111-1111-1111-111111111111',
  };

  const scope = getCurrentScope();
  scope.setUser({
    id: 'fleet:1',
    email: 'flota@example.com',
    username: 'Juan Perez',
    ip_address: '10.0.0.1',
  });
  scope.setTag('rfc', 'ABC010203XY1');
  scope.setExtra('customer', {
    name: 'Ana Operadora',
    phone: 5512345678,
    accessToken: 'opaqueSecret',
  });
  scope.setContext('payout', { clabe: '002180700000000017', curp: 'GODE561231HDFRRN09' });
  scope.addBreadcrumb({
    category: 'fetch',
    data: {
      url: 'https://www.partrunner.app/conductor/SecretTok?rfc=ABC010203XY1',
      status_code: 500,
    },
  });
  scope.addBreadcrumb({ category: 'console', message: 'payout for flota@example.com' });
  scope.addBreadcrumb({
    category: 'ui.click',
    message: 'div.board > button.ticket-card[aria-label="Ticket "urgente" ] de Ana Operadora"]',
  });
  scope.addBreadcrumb({
    category: 'console',
    message: 'tool createClient {"company":"Juan Perez Transportes"}',
  });
  getIsolationScope().setAttributes?.({ 'user.email': 'flota@example.com' });

  scope.captureException(
    new Error(
      'Upload failed for ABC010203XY1 at https://www.partrunner.app/conductor/SecretTok?x=1 from 203.0.113.9'
    )
  );
  scope.captureMessage('Payout to 002180700000000017 for flota@example.com');
  startSpan(
    {
      // A sanitised, parameterised name: the dynamic sampling context copies
      // custom transaction names into the envelope header before any hook runs.
      name: 'GET /conductor/[token]',
      op: 'http.server',
      attributes: {
        'http.target': '/conductor/SecretTok?rfc=ABC010203XY1',
        'client.address': '203.0.113.9',
        'user.email': 'flota@example.com',
      },
    },
    () => {
      startSpan(
        { name: 'POST https://api.test/conductor/SecretTok?x=1', op: 'http.client' },
        () => {}
      );
      // Browser tracing names INP spans after the clicked element and puts
      // the LCP element selector in an attribute (`htmlTreeAsString`).
      startSpan(
        {
          name: 'div.board > button.ticket-card[aria-label="Ticket de Rosa Ticket"]',
          op: 'ui.interaction.click',
          attributes: { 'lcp.element': 'main > article.ticket[title="Rosa Ticket"]' },
        },
        () => {}
      );
    }
  );
  // A standalone INP span with no active span and no frozen pageload context:
  // the SDK copies its name into the envelope header (dynamic sampling context).
  startInactiveSpan({
    name: 'div.board > button.ticket-card[aria-label="Ticket de Luis Standalone"]',
    op: 'ui.interaction.click',
    experimental: { standalone: true },
  }).end();
  logger.info('payout done for flota@example.com');
  metrics.count('payout', 1, { attributes: { email: 'flota@example.com' } });
  scope.addBreadcrumb({ category: 'console', message: 'Cookie: session=opaqueSecret' });
  scope.setContext('session', { value: 'opaqueSecret' });
  scope.captureMessage('retry with {"accessToken":"opaqueSecret","password":"s;Tr0ngPass!"}');
  scope.captureMessage('callback GET /?code=OAuthSecret failed');
  const bundled = new Error('bundle failure');
  bundled.stack = `Error: bundle failure\n${bundleFrame}`;
  scope.captureException(bundled);
});

afterAll(() => {
  getCurrentScope().setClient(undefined);
});

describe('outbound envelopes', () => {
  it('sends the error, the message and the transaction', async () => {
    await client.flush(2000);
    const all = bodies.join('\n');
    expect(all).toContain('"type":"event"');
    expect(all).toContain('"type":"transaction"');
    expect(all).toContain('"app":"sube-tu-factura"');
    expect(all).toContain('"surface":"fleet"');
    expect(all).toContain('"id":"fleet:1"');
    expect(all).toContain('/conductor/[token]');
    expect(all).toContain('div.board > button.ticket-card[…]');
    expect(all).toContain('main > article.ticket[…]');
    expect(all).toMatch(/"type":"span"/);
    expect(all).toContain('"transaction":"div.board > button.ticket-card[…]"');
  });

  it('keeps debug ids for source maps without the bundle URL secret', async () => {
    await client.flush(2000);
    const all = bodies.join('\n');
    expect(all).toContain('"debug_id":"11111111-1111-1111-1111-111111111111"');
    expect(all).toContain('"code_file":"https://app.test/assets/app.js"');
  });

  it('carries no sensitive value anywhere, headers included', async () => {
    await client.flush(2000);
    const all = bodies.join('\n');
    for (const secret of SECRETS) expect(all, secret).not.toContain(secret);
  });

  it('sends no log or metric items', async () => {
    await client.flush(2000);
    const all = bodies.join('\n');
    expect(all).not.toContain('"type":"log"');
    expect(all).not.toMatch(/"type":"(?:trace_metric|metric)"/);
  });
});
