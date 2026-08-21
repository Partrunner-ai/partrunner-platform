/**
 * Maintenance Mode Helper
 *
 * Loads `maintenance_mode` from `system_config` and exposes a validator +
 * cache helper. When enabled, the fleet portal (`/portal/*`) renders a
 * full-screen "Estamos en mantenimiento" page instead of the app.
 *
 * Source of truth lives in `system_config['maintenance_mode']`.
 * Shape:
 * ```jsonc
 * {
 *   "enabled": false,
 *   "title": "Estamos en mantenimiento",
 *   "message": "Estamos realizando mejoras. Volveremos pronto. Gracias por tu paciencia."
 * }
 * ```
 *
 * Why NOT `is_sensitive`?
 *   The state must be readable WITHOUT authentication (fleets often can't log
 *   in while maintenance is on), so it is exposed via the public `/api/config`
 *   endpoint. Sensitive keys are redacted from non-super_admin reads and never
 *   reach `/api/config`, which would defeat the purpose here.
 *
 * On any error (missing row, invalid shape, DB failure) the loader returns the
 * default config (maintenance OFF) and never throws — a broken config row must
 * never lock fleets out of the portal.
 */

import { tbl } from './db';
import { logger } from './logger';

const CTX = 'lib/maintenanceMode';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MaintenanceModeConfig {
  /** When true, the fleet portal shows the maintenance screen. */
  enabled: boolean;
  /** Headline shown on the maintenance screen. */
  title: string;
  /** Body copy shown below the headline. */
  message: string;
}

// ── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_MAINTENANCE_MODE: MaintenanceModeConfig = {
  enabled: false,
  title: 'Estamos en mantenimiento',
  message: 'Estamos realizando mejoras. Volveremos pronto. Gracias por tu paciencia.',
};

// Sane length caps so a typo in the admin form can't ship a multi-megabyte
// payload through the public config endpoint.
const TITLE_MAX = 120;
const MESSAGE_MAX = 1000;

// ── Validation ──────────────────────────────────────────────────────────────

export function validateMaintenanceMode(v: unknown): v is MaintenanceModeConfig {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.enabled === 'boolean' &&
    typeof o.title === 'string' &&
    o.title.length > 0 &&
    o.title.length <= TITLE_MAX &&
    typeof o.message === 'string' &&
    o.message.length > 0 &&
    o.message.length <= MESSAGE_MAX
  );
}

// ── Cache ───────────────────────────────────────────────────────────────────

const TTL_MS = 60 * 1000;
let cached: MaintenanceModeConfig | null = null;
let cacheExpiresAt = 0;

/** Drops the cached config so the next read hits the database. */
export function invalidateMaintenanceModeCache(): void {
  cached = null;
  cacheExpiresAt = 0;
}

/**
 * Reads the config with a 60s TTL cache. On error or invalid shape, returns
 * defaults (maintenance OFF) and never throws.
 */
export async function loadMaintenanceMode(): Promise<MaintenanceModeConfig> {
  const now = Date.now();
  if (cached && now < cacheExpiresAt) {
    return cached;
  }

  try {
    const { data, error } = await tbl('config', 'system_config')
      .select('value')
      .eq('key', 'maintenance_mode')
      .single();

    if (error || !data) {
      logger.warn(CTX, 'maintenance_mode not found, using defaults', { err: error });
      cached = DEFAULT_MAINTENANCE_MODE;
    } else if (!validateMaintenanceMode(data.value)) {
      logger.warn(CTX, 'maintenance_mode invalid shape, using defaults', {
        value: data.value,
      });
      cached = DEFAULT_MAINTENANCE_MODE;
    } else {
      cached = data.value as MaintenanceModeConfig;
    }
  } catch (err) {
    logger.error(CTX, 'Error loading maintenance_mode, using defaults', { err });
    cached = DEFAULT_MAINTENANCE_MODE;
  }

  cacheExpiresAt = now + TTL_MS;
  return cached;
}
