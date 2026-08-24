/**
 * Server-authoritative feature flag loading from config.admin_feature_flags.
 *
 * Pure evaluation is exported from the browser-safe `./featureFlagDecision`
 * module and the `@partrunner-ai/api-core/feature-flags` package subpath.
 */

import { tbl } from './db';
import {
  evaluateFlag,
  type FeatureFlagContext,
  type FeatureFlagEvaluationRow,
} from './featureFlagDecision';
import { logger } from './logger';

export * from './featureFlagDecision';

const CTX = 'lib/featureFlags';

export interface FeatureFlagRow extends FeatureFlagEvaluationRow {
  key: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

const TTL_MS = 60 * 1000;
let cachedRows: FeatureFlagRow[] | null = null;
let cacheExpiresAt = 0;

export function invalidateFeatureFlagsCache(): void {
  cachedRows = null;
  cacheExpiresAt = 0;
}

export async function loadAllFeatureFlags(): Promise<FeatureFlagRow[]> {
  const now = Date.now();
  if (cachedRows && now < cacheExpiresAt) return cachedRows;

  try {
    const { data, error } = await tbl('config', 'admin_feature_flags')
      .select('key, value_bool, value_json, archived_at, description, updated_by, updated_at')
      .order('key', { ascending: true });

    if (error) {
      logger.warn(CTX, 'failed to load feature flags — denying all', { err: error });
      cachedRows = [];
    } else {
      cachedRows = (data ?? []) as FeatureFlagRow[];
    }
  } catch (err) {
    logger.error(CTX, 'feature flags load threw — denying all', { err });
    cachedRows = [];
  }

  cacheExpiresAt = now + TTL_MS;
  return cachedRows ?? [];
}

/**
 * Server gate: `await isFeatureEnabled('portal_referrals', { kind: 'user', rfc })`.
 * Fail-closed on missing key / DB errors.
 */
export async function isFeatureEnabled(key: string, ctx: FeatureFlagContext): Promise<boolean> {
  const flags = await loadAllFeatureFlags();
  const row = flags.find(f => f.key === key);
  if (!row) return false;
  return evaluateFlag(row, ctx);
}

/** Resolve every flag to a boolean map for a caller (allowlists never leave). */
export async function resolveFeaturesFor(
  ctx: FeatureFlagContext
): Promise<Record<string, boolean>> {
  const flags = await loadAllFeatureFlags();
  const out: Record<string, boolean> = {};
  for (const f of flags) {
    out[f.key] = evaluateFlag(f, ctx);
  }
  return out;
}
