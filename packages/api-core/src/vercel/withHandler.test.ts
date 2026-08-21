import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { configureRequestRecorder, withHandler } from './withHandler';

function res() {
  const r = {
    statusCode: 200,
    headersSent: false,
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      r.statusCode = code;
      return r;
    }),
    json: vi.fn(() => r),
    end: vi.fn(() => r),
  };
  return r as unknown as VercelResponse & typeof r;
}

const req = (
  method = 'GET',
  headers: VercelRequest['headers'] = {},
) => ({ method, headers, query: {} }) as unknown as VercelRequest;

const options = {
  ctx: 'test',
  methods: ['GET'] as const,
  allowedOrigins: ['https://app.example.test'],
};

afterEach(() => {
  configureRequestRecorder(null);
});

describe('withHandler CORS contract', () => {
  it.each([
    '',
    ' ',
    '*',
    'ftp://app.example.test',
    'https://user@app.example.test',
    'https://@app.example.test',
    'https://app.example.test/path',
    'https://app.example.test/%2e',
    'https://app.example.test?',
    'https://app.example.test?mode=test',
    'https://app.example.test#fragment',
  ])('rejects an invalid configured origin (%s)', (origin) => {
    expect(() =>
      withHandler(
        { ...options, allowedOrigins: [origin] },
        async () => {},
      ),
    ).toThrow(/allowed origin/i);
  });

  it('canonicalizes configured origins and echoes only an exact request origin', async () => {
    const handler = vi.fn();
    const r = res();
    await withHandler(
      {
        ...options,
        allowedOrigins: ['https://APP.example.test:443/'],
      },
      handler,
    )(req('GET', { origin: 'https://app.example.test' }), r);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(r.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://app.example.test',
    );
    expect(r.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Credentials',
      'true',
    );
    expect(r.setHeader).toHaveBeenCalledWith('Vary', 'Origin');
  });

  it.each([
    { origin: 'https://app.example.test.evil.test' },
    {
      origin: 'https://evil.example.test',
      referer: 'https://app.example.test/allowed-looking-path',
    },
  ])('rejects a disallowed origin without trusting prefixes or Referer', async (headers) => {
    const handler = vi.fn();
    const r = res();
    await withHandler(options, handler)(req('GET', headers), r);

    expect(handler).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(403);
    expect(r.setHeader).not.toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      expect.anything(),
    );
    expect(r.setHeader).not.toHaveBeenCalledWith(
      'Access-Control-Allow-Credentials',
      expect.anything(),
    );
  });

  it.each([
    'not a URL',
    'https://app.example.test, https://evil.example.test',
  ])('rejects a malformed request origin (%s)', async (origin) => {
    const handler = vi.fn();
    const r = res();
    await withHandler(options, handler)(req('GET', { origin }), r);

    expect(handler).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(403);
  });

  it('runs requests without Origin and emits no credentialed CORS headers', async () => {
    const handler = vi.fn();
    const r = res();
    await withHandler(options, handler)(req(), r);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(r.setHeader).not.toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      expect.anything(),
    );
    expect(r.setHeader).not.toHaveBeenCalledWith(
      'Access-Control-Allow-Credentials',
      expect.anything(),
    );
  });

  it('answers allowed preflight requests with the API-key header advertised', async () => {
    const handler = vi.fn();
    const r = res();
    await withHandler(options, handler)(
      req('OPTIONS', { origin: 'https://app.example.test' }),
      r,
    );

    expect(handler).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.end).toHaveBeenCalled();
    expect(r.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-API-Key',
    );
  });
});

describe('withHandler request recorder', () => {
  it('does not require a recorder', async () => {
    const r = res();
    await withHandler(options, async () => {})(req(), r);
    expect(r.status).not.toHaveBeenCalledWith(500);
  });

  it('reports the status code the handler produced', async () => {
    const seen: unknown[] = [];
    configureRequestRecorder(p => void seen.push(p));

    const r = res();
    await withHandler(options, async (_q, s) => {
      s.status(201);
    })(req(), r);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ statusCode: 201 });
  });

  it('still records when the handler throws', async () => {
    const recorder = vi.fn();
    configureRequestRecorder(recorder);

    const r = res();
    await withHandler(options, async () => {
      throw new Error('boom');
    })(req(), r);

    // The error is swallowed into a 500 envelope, and the call is still recorded.
    expect(r.status).toHaveBeenCalledWith(500);
    expect(recorder).toHaveBeenCalledTimes(1);
  });

  it('never lets a failing recorder break an already-sent response', async () => {
    configureRequestRecorder(() => {
      throw new Error('telemetry is down');
    });

    const r = res();
    await expect(
      withHandler(options, async (_q, s) => {
        s.status(200);
      })(req(), r)
    ).resolves.toBeUndefined();
  });

  it('does not record preflight requests, which short-circuit before the handler', async () => {
    const recorder = vi.fn();
    configureRequestRecorder(recorder);

    await withHandler(options, async () => {})(
      req('OPTIONS', { origin: 'https://app.example.test' }),
      res(),
    );
    expect(recorder).not.toHaveBeenCalled();
  });
});
