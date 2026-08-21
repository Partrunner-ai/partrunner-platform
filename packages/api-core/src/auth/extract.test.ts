import { describe, expect, it } from 'vitest';
import { extractBearerOrCookie } from './extract';

describe('extractBearerOrCookie', () => {
  it('prefers the Authorization header', () => {
    const req = {
      headers: { authorization: 'Bearer header-token' },
      cookies: { admin_token: 'cookie-token' },
    };
    expect(extractBearerOrCookie(req, 'admin_token')).toBe('header-token');
  });

  it('falls back to the named cookie', () => {
    expect(extractBearerOrCookie({ cookies: { admin_token: 'c' } }, 'admin_token')).toBe('c');
  });

  it('reads only the cookie it was asked for — audiences must not cross', () => {
    const req = { cookies: { user_token: 'fleet-owner-token' } };
    expect(extractBearerOrCookie(req, 'admin_token')).toBeNull();
  });

  it('returns null when nothing is present', () => {
    expect(extractBearerOrCookie({}, 'admin_token')).toBeNull();
    expect(extractBearerOrCookie({ headers: {}, cookies: {} }, 'admin_token')).toBeNull();
  });

  it('ignores a non-Bearer scheme', () => {
    const req = { headers: { authorization: 'Basic abc' }, cookies: { admin_token: 'c' } };
    expect(extractBearerOrCookie(req, 'admin_token')).toBe('c');
  });

  it('ignores an empty Bearer value and falls through', () => {
    const req = { headers: { authorization: 'Bearer   ' }, cookies: { admin_token: 'c' } };
    expect(extractBearerOrCookie(req, 'admin_token')).toBe('c');
  });

  it('handles a header delivered as an array', () => {
    const req = { headers: { authorization: ['Bearer t'] } };
    expect(extractBearerOrCookie(req, 'admin_token')).toBe('t');
  });
});
