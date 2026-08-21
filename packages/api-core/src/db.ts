// Schema-aware helpers sobre el cliente Supabase.
//
// Centralizan el acceso a Nexus 2, donde las tablas y RPCs viven en schemas
// como `finance`, `supply`, `identity`, etc.
//
// Patrón de uso:
//
//   // antes
//   await getNexusClient().from('invoices').select(...)
//
//   // después
//   await tbl('finance', 'invoices').select(...)
//
// `tbl('finance', 'invoices')` siempre equivale a
// `getNexusClient().schema('finance').from('invoices')`. Las RPCs usan
// `rpcOn(schema, name, args)` por la misma razón.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getNexusClient } from './client';
import { logger } from './logger';

const CTX = 'lib/db';

/**
 * The query-builder type produced by `client.schema(s).from(n)`.
 *
 * Derived structurally from `SupabaseClient` because supabase-js does not
 * export its internal `PostgrestQueryBuilder` name. Naming that internal type
 * in a bundled declaration can resolve to `any` under `skipLibCheck`.
 *
 * Keep this expressed via publicly exported types only.
 */
type NexusQueryBuilder = ReturnType<ReturnType<SupabaseClient['schema']>['from']>;

export type SchemaName =
  | 'public'
  | 'identity'
  | 'core'
  | 'finance'
  | 'sales'
  | 'supply'
  | 'comms'
  | 'analytics'
  | 'config'
  | 'integrations'
  | 'engagement'
  | 'ops';

/**
 * Devuelve un query builder apuntando a la tabla `name` en el schema correcto.
 * @param schema      Schema destino en Nexus 2
 * @param name        Nombre de la tabla en Nexus 2
 * @param legacyName  Obsoleto; se conserva temporalmente para no convertir
 *                    esta retirada del flag en un refactor masivo de firmas.
 */
export const tbl = (
  schema: SchemaName,
  name: string,
  _legacyName?: string
): NexusQueryBuilder => {
  const client = getNexusClient();
  return client.schema(schema).from(name);
};

// ── PostgREST schema-cache auto-heal ────────────────────────────────────────
//
// PostgREST caches schema metadata. `rpcOn()` detects cache-miss errors,
// triggers one best-effort reload through the configured helper, and retries
// once. A genuinely missing function still surfaces instead of looping.

// PostgREST error codes that mean "the schema cache is stale / out of sync".
// PGRST202 = function not found, PGRST205 = table not found,
// PGRST204 = column not found, PGRST200 = relationship not found.
// See https://postgrest.org/en/stable/references/errors.html
const PGRST_SCHEMA_CACHE_CODES = new Set(['PGRST202', 'PGRST205', 'PGRST204', 'PGRST200']);

// Backoff between the reload signal and the retry. PostgREST reloads its cache
// asynchronously on the `pgrst` NOTIFY, so we give it a beat before retrying.
const RELOAD_BACKOFF_MS = 500;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const isSchemaCacheMiss = (error: { code?: string | null } | null | undefined): boolean =>
  !!error?.code && PGRST_SCHEMA_CACHE_CODES.has(error.code);

// Coalesce concurrent reload requests so one stale cache does not fan out into
// repeated reload calls.
let reloadInFlight: Promise<void> | null = null;

/**
 * Best-effort PostgREST schema-cache reload. Calls the SECURITY DEFINER helper
 * `public.fn_pgrst_reload()` (which runs `NOTIFY pgrst, 'reload schema'` +
 * `'reload config'`). Never throws — a failure here just means the retry will
 * likely re-fail and surface the original error.
 *
 * Exported for the tiny chance another module wants to force a reload (and for
 * unit testing the auto-heal path).
 */
export const reloadPostgrestSchema = (): Promise<void> => {
  if (!reloadInFlight) {
    reloadInFlight = (async () => {
      try {
        // The reload helper is intentionally anchored in the public schema.
        const { error } = await getNexusClient().schema('public').rpc('fn_pgrst_reload');
        if (error) {
          logger.warn(CTX, 'fn_pgrst_reload returned an error (best-effort, ignoring)', {
            code: error.code,
            message: error.message,
          });
        }
      } catch (err) {
        logger.warn(CTX, 'fn_pgrst_reload threw (best-effort, ignoring)', { err });
      }
    })().finally(() => {
      reloadInFlight = null;
    });
  }
  return reloadInFlight;
};

/**
 * Igual que `tbl` pero para funciones RPC. En Nexus 2 las funciones viven
 * dentro de su schema (`finance.fn_approve_billing_requests`, etc.).
 *
 * Resiliencia añadida: si la llamada falla con un error de cache de esquema
 * desincronizada de PostgREST (PGRST202 y variantes), dispara UN reload de
 * esquema y reintenta UNA sola vez. Si el reintento también falla, devuelve el
 * error tal cual (no enmascara funciones genuinamente ausentes).
 *
 * @param schema  Schema destino en Nexus 2 (ignorado en legacy)
 * @param name    Nombre de la función. En legacy debe coincidir con el
 *                nombre real en `public` (incluyendo prefijos si aplica,
 *                p. ej. `pi_refresh_views`).
 * @param args    Argumentos de la función (mismo shape para ambos paths)
 */
export const rpcOn = async (schema: SchemaName, name: string, args?: Record<string, unknown>) => {
  const run = () => {
    const client = getNexusClient();
    return client.schema(schema).rpc(name, args);
  };

  const first = await run();
  if (!isSchemaCacheMiss(first.error)) {
    return first;
  }

  logger.warn(CTX, 'PostgREST schema-cache miss on RPC; auto-healing (reload + retry once)', {
    schema,
    fn: name,
    code: first.error?.code,
  });

  // (a) reload, (b) short backoff, (c) retry ONCE.
  await reloadPostgrestSchema();
  await sleep(RELOAD_BACKOFF_MS);
  const second = await run();

  if (isSchemaCacheMiss(second.error)) {
    logger.error(CTX, 'PostgREST schema-cache miss persisted after auto-heal; surfacing error', {
      schema,
      fn: name,
      code: second.error?.code,
    });
  } else if (!second.error) {
    logger.info(CTX, 'PostgREST schema-cache auto-heal succeeded after reload', {
      schema,
      fn: name,
    });
  }

  return second;
};
