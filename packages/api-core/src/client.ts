/**
 * Canonical Nexus (Supabase) client for PartRunner backend apps.
 *
 * Tables and RPCs live in explicit domain schemas. Prefer `tbl()` and `rpcOn()`
 * from `./db`; `configureNexusClient()` is the host adapter seam for an existing
 * client or compatibility wrapper.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Accepted credential aliases, canonical spelling first. */
const URL_ENV_KEYS = ['NEXUS2_SUPABASE_URL', 'SUPABASE_URL_NEXUS2'] as const;
const KEY_ENV_KEYS = [
  'NEXUS2_SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY_NEXUS2',
] as const;

/** First of `keys` that is set to a non-empty value. */
function firstSet(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

let factory: (() => SupabaseClient) | null = null;
let cached: SupabaseClient | null = null;

/** Build the default service-role client. Service role bypasses RLS: server-only. */
function defaultFactory(): SupabaseClient {
  const url = firstSet(URL_ENV_KEYS);
  const key = firstSet(KEY_ENV_KEYS);

  if (!url || !key) {
    // Name every accepted spelling: the failure is almost always "set the other
    // one", and an error naming a single variable sends people to add a
    // duplicate rather than to look at what they already have.
    throw new Error(
      'Missing Nexus credentials. Set one of ' +
        `${URL_ENV_KEYS.join(' / ')} and one of ${KEY_ENV_KEYS.join(' / ')}.`
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Override how the Nexus client is constructed. Call once at startup, before
 * any `tbl()` / `rpcOn()` call. Passing `null` restores the default factory.
 *
 * Any previously cached client is discarded so the next access re-resolves.
 */
export function configureNexusClient(next: (() => SupabaseClient) | null): void {
  factory = next;
  cached = null;
}

/**
 * The shared Nexus client, created on first use and memoized for the lifetime
 * of the process (serverless invocations reuse it across warm starts).
 */
export function getNexusClient(): SupabaseClient {
  if (!cached) cached = (factory ?? defaultFactory)();
  return cached;
}

/** Drop the memoized client. Intended for tests. */
export function resetNexusClient(): void {
  cached = null;
}

/** Cheap liveness probe for health endpoints. Never throws. */
export async function checkConnection(): Promise<boolean> {
  try {
    const { error } = await getNexusClient().schema('supply').from('projects').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
