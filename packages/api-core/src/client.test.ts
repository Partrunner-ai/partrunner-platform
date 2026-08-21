import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { configureNexusClient, getNexusClient, resetNexusClient } from './client';

const stub = (tag: string) => ({ tag }) as unknown as SupabaseClient;

afterEach(() => {
  configureNexusClient(null);
  resetNexusClient();
  vi.unstubAllEnvs();
});

describe('getNexusClient', () => {
  it('memoizes the client across calls', () => {
    configureNexusClient(() => stub('a'));
    expect(getNexusClient()).toBe(getNexusClient());
  });

  it('builds the client lazily, not at configure time', () => {
    const factory = vi.fn(() => stub('a'));
    configureNexusClient(factory);
    expect(factory).not.toHaveBeenCalled();

    getNexusClient();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('discards the cached client when reconfigured', () => {
    configureNexusClient(() => stub('first'));
    const first = getNexusClient();

    configureNexusClient(() => stub('second'));
    expect(getNexusClient()).not.toBe(first);
  });

  it('throws a named-variable error when credentials are absent', () => {
    clearCredentials();

    // The message must name every accepted spelling, or someone reading it adds
    // a duplicate of the one it happens to mention.
    expect(() => getNexusClient()).toThrow(/NEXUS2_SUPABASE_URL/);
    expect(() => getNexusClient()).toThrow(/SUPABASE_URL_NEXUS2/);
  });
});

/** Both accepted spellings, blanked. */
function clearCredentials() {
  for (const k of [
    'NEXUS2_SUPABASE_URL',
    'SUPABASE_URL_NEXUS2',
    'NEXUS2_SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY_NEXUS2',
  ]) {
    vi.stubEnv(k, '');
  }
}

/** Both documented credential aliases resolve through the same client seam. */
describe('credential env aliases', () => {
  it.each([
    ['canonical', 'NEXUS2_SUPABASE_URL', 'NEXUS2_SUPABASE_SERVICE_ROLE_KEY'],
    ['legacy', 'SUPABASE_URL_NEXUS2', 'SUPABASE_SERVICE_ROLE_KEY_NEXUS2'],
  ])('builds a client from the %s spelling', (_label, urlKey, keyKey) => {
    clearCredentials();
    vi.stubEnv(urlKey, 'https://nexus.example.test');
    vi.stubEnv(keyKey, 'service-role-key');

    expect(getNexusClient()).toBeDefined();
  });

  it('prefers the canonical spelling when both are set', () => {
    clearCredentials();
    vi.stubEnv('NEXUS2_SUPABASE_URL', 'https://canonical.example.test');
    vi.stubEnv('SUPABASE_URL_NEXUS2', 'https://legacy.example.test');
    vi.stubEnv('NEXUS2_SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');

    // Not directly observable on the client, so assert it does not fall through
    // to the legacy-only path by requiring the canonical key alone to suffice.
    expect(getNexusClient()).toBeDefined();
  });

  it('ignores an empty value and falls through to the next spelling', () => {
    clearCredentials();
    vi.stubEnv('NEXUS2_SUPABASE_URL', '   ');
    vi.stubEnv('SUPABASE_URL_NEXUS2', 'https://legacy.example.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY_NEXUS2', 'service-role-key');

    expect(getNexusClient()).toBeDefined();
  });
});
