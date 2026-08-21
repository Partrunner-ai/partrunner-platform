import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import {
  configureAdminVerifier,
  extractApiKey,
  verifyApiKey,
  verifyAuthOrApiKey,
} from './apiKeyAuth';

const db = vi.hoisted(() => ({
  tbl: vi.fn(),
  select: vi.fn(),
  selectEq: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock('../db', () => ({ tbl: db.tbl }));

/** Vercel always populates both `headers` and `query`; mirror that. */
const req = (
  headers: VercelRequest['headers'] = {},
  query: VercelRequest['query'] = {},
) => ({ headers, query }) as unknown as VercelRequest;

beforeEach(() => {
  for (const mock of Object.values(db)) mock.mockReset();
  db.selectEq.mockReturnValue({ maybeSingle: db.maybeSingle });
  db.select.mockReturnValue({ eq: db.selectEq });
  db.updateEq.mockResolvedValue({ error: null });
  db.update.mockReturnValue({ eq: db.updateEq });
  db.tbl.mockReturnValue({ select: db.select, update: db.update });
});

afterEach(() => {
  configureAdminVerifier(null);
});

describe('API key authentication', () => {
  const key = `pk_${'a'.repeat(24)}`;
  const activeKey = {
    id: 'key_1',
    name: 'Reporting',
    scopes: ['export'],
    rate_limit_per_minute: 30,
    rate_limit_per_day: 1_000,
    is_active: true,
    expires_at: null,
    total_requests: 7,
  };

  it('accepts only a non-empty X-API-Key header', () => {
    expect(extractApiKey(req({ 'x-api-key': ` ${key} ` }))).toBe(key);
    expect(extractApiKey(req({ 'x-api-key': ['one', 'two'] }))).toBeNull();
    expect(extractApiKey(req({ 'x-api-key': '   ' }))).toBeNull();
  });

  it('ignores query-string credentials', () => {
    expect(extractApiKey(req({}, { api_key: key }))).toBeNull();
  });

  it('returns null without querying the database when no header is present', async () => {
    await expect(verifyApiKey(req())).resolves.toBeNull();
    expect(db.tbl).not.toHaveBeenCalled();
  });

  it('returns the active key and increments its selected request count', async () => {
    db.maybeSingle.mockResolvedValue({ data: activeKey, error: null });

    await expect(
      verifyApiKey(req({ 'x-api-key': key })),
    ).resolves.toEqual({
      id: activeKey.id,
      name: activeKey.name,
      scopes: activeKey.scopes,
      rate_limit_per_minute: activeKey.rate_limit_per_minute,
      rate_limit_per_day: activeKey.rate_limit_per_day,
    });

    expect(db.select.mock.calls[0]?.[0]).not.toContain('total_requests');
    expect(db.select.mock.calls[1]?.[0]).toContain('total_requests');
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ total_requests: 8 }),
    );
  });

  it('distinguishes a missing key from a database outage', async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(
      verifyApiKey(req({ 'x-api-key': key })),
    ).resolves.toBeNull();

    db.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'database unavailable' },
    });
    await expect(
      verifyApiKey(req({ 'x-api-key': key })),
    ).rejects.toThrow(/lookup failed/i);
  });

  it.each([
    { ...activeKey, is_active: false },
    { ...activeKey, expires_at: '2000-01-01T00:00:00.000Z' },
    { ...activeKey, expires_at: 'not-a-timestamp' },
  ])('rejects a revoked, expired, or malformed key record', async (data) => {
    db.maybeSingle.mockResolvedValue({ data, error: null });
    await expect(
      verifyApiKey(req({ 'x-api-key': key })),
    ).resolves.toBeNull();
  });

  it('does not turn optional usage telemetry failure into failed authentication', async () => {
    db.maybeSingle.mockResolvedValue({ data: activeKey, error: null });
    db.updateEq.mockResolvedValue({
      error: { message: 'telemetry update failed' },
    });

    await expect(
      verifyApiKey(req({ 'x-api-key': key })),
    ).resolves.toMatchObject({ id: activeKey.id });
  });

  it('keeps authentication valid when usage-counter lookup fails', async () => {
    db.maybeSingle
      .mockResolvedValueOnce({ data: activeKey, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'counter column unavailable' },
      });

    await expect(
      verifyApiKey(req({ 'x-api-key': key })),
    ).resolves.toMatchObject({ id: activeKey.id });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('keeps authentication valid when usage telemetry throws', async () => {
    db.maybeSingle.mockResolvedValue({ data: activeKey, error: null });
    db.updateEq.mockRejectedValue(new Error('telemetry transport failed'));

    await expect(
      verifyApiKey(req({ 'x-api-key': key })),
    ).resolves.toMatchObject({ id: activeKey.id });
  });
});

describe('verifyAuthOrApiKey', () => {
  it('throws when no admin verifier has been registered', async () => {
    await expect(verifyAuthOrApiKey(req())).rejects.toThrow(/configureAdminVerifier/);
  });

  it('returns the admin branch when the verifier resolves truthy', async () => {
    const admin = { id: 'adm_1' };
    configureAdminVerifier(async () => admin);

    await expect(verifyAuthOrApiKey(req())).resolves.toEqual({ type: 'admin', admin });
  });

  it('falls through to API key lookup when the verifier resolves null', async () => {
    configureAdminVerifier(async () => null);

    // No API key on the request either, so both branches miss.
    await expect(verifyAuthOrApiKey(req())).resolves.toEqual({ type: null });
  });

  it('does not retain a verifier across configuration resets', async () => {
    configureAdminVerifier(async () => ({ id: 'adm_1' }));
    configureAdminVerifier(null);

    await expect(verifyAuthOrApiKey(req())).rejects.toThrow(/configureAdminVerifier/);
  });
});
