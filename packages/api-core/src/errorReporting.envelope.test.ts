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
  startSpan,
} from '@sentry/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createErrorReportingOptions } from './observability';

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
    integrations: [],
    stackParser: createStackParser(nodeStackLineParser()),
    transport: options =>
      createTransport(options, async request => {
        bodies.push(typeof request.body === 'string' ? request.body : decoder.decode(request.body));
        return { statusCode: 200 };
      }),
  });
  setCurrentClient(client);
  client.init();

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
    }
  );
  logger.info('payout done for flota@example.com');
  metrics.count('payout', 1, { attributes: { email: 'flota@example.com' } });
  scope.addBreadcrumb({ category: 'console', message: 'Cookie: session=opaqueSecret' });
  scope.captureMessage('retry with {"accessToken":"opaqueSecret"}');
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
