import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { signJwt, verifyJwt, type JwtRejection } from './jwt';

const secret = () => 'test-secret';
const other = () => 'a-different-secret';

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Reproduces the established wire format independently. If `signJwt` stops
 * matching this, already-issued session tokens become unverifiable — so
 * this is pinned rather than derived from the implementation under test.
 */
function legacySign(payload: object, key: string, expiryHours: number, now: number): string {
  const b64 = (s: string) =>
    Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(
    JSON.stringify({ ...payload, iat: now, exp: now + expiryHours * 60 * 60 })
  );
  const sig = createHmac('sha256', key)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${header}.${body}.${sig}`;
}

describe('wire compatibility', () => {
  it('produces byte-identical tokens to the implementation it replaces', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T00:00:00Z'));
    const now = Math.floor(Date.now() / 1000);

    const payload = { adminId: 'a1', email: 'admin@example.com', role: 'super_admin' };
    expect(signJwt(payload, { secret, expiryHours: 24 })).toBe(
      legacySign(payload, 'test-secret', 24, now)
    );
  });

  it('verifies a token minted by the old implementation', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = legacySign({ flotilleroId: 'f1' }, 'test-secret', 168, now);

    expect(verifyJwt<{ flotilleroId: string }>(token, { secret })?.flotilleroId).toBe('f1');
  });
});

describe('signJwt / verifyJwt', () => {
  it('round-trips the caller payload and adds iat/exp', () => {
    const claims = verifyJwt<{ sub: string }>(
      signJwt({ sub: 'u1' }, { secret, expiryHours: 1 }),
      { secret }
    );

    expect(claims?.sub).toBe('u1');
    expect(claims?.exp).toBe(claims!.iat + 3600);
  });

  it('honours differing lifetimes per audience', () => {
    const staff = verifyJwt(signJwt({}, { secret, expiryHours: 24 }), { secret })!;
    const fleet = verifyJwt(signJwt({}, { secret, expiryHours: 168 }), { secret })!;

    expect(staff.exp - staff.iat).toBe(24 * 3600);
    expect(fleet.exp - fleet.iat).toBe(168 * 3600);
  });

  it('rejects a token signed with a different secret — the audience boundary', () => {
    const reasons: JwtRejection[] = [];
    const token = signJwt({ sub: 'u1' }, { secret: other, expiryHours: 1 });

    expect(verifyJwt(token, { secret, onReject: r => reasons.push(r) })).toBeNull();
    expect(reasons).toEqual(['bad_signature']);
  });

  it('rejects an expired token', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T00:00:00Z'));
    const token = signJwt({ sub: 'u1' }, { secret, expiryHours: 1 });

    vi.setSystemTime(new Date('2026-08-08T01:00:01Z'));
    const reasons: JwtRejection[] = [];
    expect(verifyJwt(token, { secret, onReject: r => reasons.push(r) })).toBeNull();
    expect(reasons).toEqual(['expired']);
  });

  it('rejects a tampered payload', () => {
    const token = signJwt({ role: 'viewer' }, { secret, expiryHours: 1 });
    const [h, , s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ role: 'super_admin', iat: 0, exp: 9e9 }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    expect(verifyJwt(`${h}.${forged}.${s}`, { secret })).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['two segments', 'a.b'],
    ['four segments', 'a.b.c.d'],
    ['garbage', 'not-a-token'],
  ])('rejects a malformed token (%s) without throwing', (_label, token) => {
    const reasons: JwtRejection[] = [];
    expect(verifyJwt(token, { secret, onReject: r => reasons.push(r) })).toBeNull();
    expect(reasons).toEqual(['malformed']);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    // timingSafeEqual throws on length mismatch; the length guard must come first.
    const token = signJwt({ sub: 'u1' }, { secret, expiryHours: 1 });
    const [h, b] = token.split('.');

    expect(() => verifyJwt(`${h}.${b}.short`, { secret })).not.toThrow();
    expect(verifyJwt(`${h}.${b}.short`, { secret })).toBeNull();
  });

  it('reads the secret at call time, not at import time', () => {
    const spy = vi.fn(() => 'test-secret');
    expect(spy).not.toHaveBeenCalled();

    signJwt({ sub: 'u1' }, { secret: spy, expiryHours: 1 });
    expect(spy).toHaveBeenCalled();
  });
});
