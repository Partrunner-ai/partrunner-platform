import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BCRYPT_ROUNDS,
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from './secrets';

describe('password hashing', () => {
  it('round-trips a password', async () => {
    const hash = await hashPassword('correct horse', 4); // low cost keeps the suite fast
    await expect(verifyPassword('correct horse', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong horse', hash)).resolves.toBe(false);
  });

  it('salts, so the same password hashes differently each time', async () => {
    const [a, b] = await Promise.all([hashPassword('same', 4), hashPassword('same', 4)]);
    expect(a).not.toBe(b);
  });

  it('records the cost factor in the hash, so raising it later is non-breaking', async () => {
    // bcrypt encodes cost as `$2<x>$NN$`; an old hash keeps verifying at its own cost.
    const cheap = await hashPassword('pw', 4);
    expect(cheap).toMatch(/^\$2[aby]\$04\$/);
    await expect(verifyPassword('pw', cheap)).resolves.toBe(true);
  });

  it('defaults to the cost every stored PartRunner hash was written with', () => {
    expect(DEFAULT_BCRYPT_ROUNDS).toBe(12);
  });
});

describe('opaque tokens', () => {
  it('generates 32 random bytes as hex by default', () => {
    const t = generateOpaqueToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(t).not.toBe(generateOpaqueToken());
  });

  it('honours a custom length', () => {
    expect(generateOpaqueToken(8)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('hashes deterministically, so the digest can be looked up', () => {
    const t = generateOpaqueToken();
    expect(hashOpaqueToken(t)).toBe(hashOpaqueToken(t));
    expect(hashOpaqueToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not leak the token — the digest differs from the token', () => {
    const t = generateOpaqueToken();
    expect(hashOpaqueToken(t)).not.toBe(t);
  });
});
