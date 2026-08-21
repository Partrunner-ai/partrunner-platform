/**
 * Server-authoritative feature flags with optional targeting.
 *
 * Storage: `config.admin_feature_flags`.
 *   - `value_bool` — master kill-switch (false → off for everyone)
 *   - `value_json.targeting` — optional allowlist / audience rules
 *
 * Resolution (fail-closed):
 *   1. Missing / unreadable flag → false
 *   2. value_bool === false → false
 *   3. No targeting or mode "all" → true
 *   4. mode "allowlist" → caller must match at least one list for their kind
 *
 * Callers never receive allowlists — only resolved booleans (profile /
 * enabled_for_me). Percentage rollout is intentionally deferred.
 */

import { tbl } from './db';
import { logger } from './logger';

const CTX = 'lib/featureFlags';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** Known admin role codes accepted in targeting.admin_roles. */
export const FEATURE_FLAG_ADMIN_ROLES = [
  'super_admin',
  'product_manager',
  'finance_manager',
  'finance_agent',
  'cs_manager',
  'cs_agent',
  'operations_manager',
  'operations_agent',
  'ops_agent',
  'fds_manager',
  'fds_agent',
  'supply',
  'finance',
  'operations',
  'viewer',
] as const;

export type FeatureFlagAdminRole = (typeof FEATURE_FLAG_ADMIN_ROLES)[number];

export type FeatureFlagTargetingMode = 'all' | 'allowlist';

export interface FeatureFlagTargeting {
  mode: FeatureFlagTargetingMode;
  flotillero_ids?: string[];
  flotillero_rfcs?: string[];
  admin_emails?: string[];
  admin_roles?: string[];
}

/** Envelope stored in value_json. Extra keys are ignored. */
export interface FeatureFlagValueJson {
  targeting?: FeatureFlagTargeting;
}

export interface FeatureFlagRow {
  key: string;
  value_bool: boolean;
  value_json: unknown | null;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export type FeatureFlagContext =
  | { kind: 'user'; flotilleroId?: string | null; rfc?: string | null }
  | { kind: 'admin'; email?: string | null; role?: string | null };

const TTL_MS = 60 * 1000;
let cachedRows: FeatureFlagRow[] | null = null;
let cacheExpiresAt = 0;

export function invalidateFeatureFlagsCache(): void {
  cachedRows = null;
  cacheExpiresAt = 0;
}

export function parseTargeting(valueJson: unknown): FeatureFlagTargeting | null {
  if (!valueJson || typeof valueJson !== 'object' || Array.isArray(valueJson)) return null;
  const envelope = valueJson as FeatureFlagValueJson;
  const raw = envelope.targeting;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!validateTargeting(raw)) return null;
  return normalizeTargeting(raw);
}

/** Validates a targeting object (strict enough for admin PUT). */
export function validateTargeting(v: unknown): v is FeatureFlagTargeting {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const t = v as Record<string, unknown>;
  if (t.mode !== 'all' && t.mode !== 'allowlist') return false;

  const checkStringArray = (key: string, itemOk: (s: string) => boolean): boolean => {
    if (t[key] === undefined) return true;
    if (!Array.isArray(t[key])) return false;
    return (t[key] as unknown[]).every(
      item => typeof item === 'string' && item.trim().length > 0 && itemOk(item.trim())
    );
  };

  if (!checkStringArray('flotillero_ids', s => UUID_RE.test(s))) return false;
  if (!checkStringArray('flotillero_rfcs', s => s.length >= 12 && s.length <= 13)) return false;
  if (!checkStringArray('admin_emails', s => EMAIL_RE.test(s))) return false;
  if (
    !checkStringArray('admin_roles', s =>
      (FEATURE_FLAG_ADMIN_ROLES as readonly string[]).includes(s)
    )
  ) {
    return false;
  }

  return true;
}

function normalizeTargeting(t: FeatureFlagTargeting): FeatureFlagTargeting {
  return {
    mode: t.mode,
    flotillero_ids: (t.flotillero_ids ?? []).map(s => s.trim().toLowerCase()),
    flotillero_rfcs: (t.flotillero_rfcs ?? []).map(s => s.trim().toUpperCase()),
    admin_emails: (t.admin_emails ?? []).map(s => s.trim().toLowerCase()),
    admin_roles: (t.admin_roles ?? []).map(s => s.trim()),
  };
}

/**
 * Pure evaluator — used by API gates and unit tests. Does not touch the DB.
 */
export function evaluateFlag(
  flag: Pick<FeatureFlagRow, 'value_bool' | 'value_json'>,
  ctx: FeatureFlagContext
): boolean {
  if (!flag.value_bool) return false;

  const targeting = parseTargeting(flag.value_json);
  if (!targeting || targeting.mode === 'all') return true;

  // allowlist
  if (ctx.kind === 'user') {
    const id = ctx.flotilleroId?.trim().toLowerCase() ?? '';
    const rfc = ctx.rfc?.trim().toUpperCase() ?? '';
    const ids = targeting.flotillero_ids ?? [];
    const rfcs = targeting.flotillero_rfcs ?? [];
    if (ids.length === 0 && rfcs.length === 0) return false;
    if (id && ids.includes(id)) return true;
    if (rfc && rfcs.includes(rfc)) return true;
    return false;
  }

  const email = ctx.email?.trim().toLowerCase() ?? '';
  const role = ctx.role?.trim() ?? '';
  const emails = targeting.admin_emails ?? [];
  const roles = targeting.admin_roles ?? [];
  if (emails.length === 0 && roles.length === 0) return false;
  if (email && emails.includes(email)) return true;
  if (role && roles.includes(role)) return true;
  return false;
}

export async function loadAllFeatureFlags(): Promise<FeatureFlagRow[]> {
  const now = Date.now();
  if (cachedRows && now < cacheExpiresAt) return cachedRows;

  try {
    const { data, error } = await tbl('config', 'admin_feature_flags')
      .select('key, value_bool, value_json, description, updated_by, updated_at')
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

/** Build / merge value_json while preserving unknown sibling keys. */
export function mergeTargetingIntoValueJson(
  existing: unknown,
  targeting: FeatureFlagTargeting | null | undefined
): FeatureFlagValueJson | null {
  const base: FeatureFlagValueJson =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as FeatureFlagValueJson) }
      : {};

  if (targeting === null) {
    delete base.targeting;
    return Object.keys(base).length === 0 ? null : base;
  }
  if (targeting === undefined) {
    return Object.keys(base).length === 0 ? null : base;
  }
  base.targeting = normalizeTargeting(targeting);
  return base;
}

/** Key shape: snake/dot lowercase segments, e.g. portal_referrals or cxc.ai_suggestions. */
export function isValidFeatureFlagKey(key: string): boolean {
  return /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/.test(key) && key.length <= 80;
}
