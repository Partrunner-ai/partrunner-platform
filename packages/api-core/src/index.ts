/**
 * @partrunner-ai/api-core — framework-agnostic Node backend primitives.
 *
 * Nothing exported here depends on a specific HTTP runtime, so this entry point
 * is safe from Next.js route handlers, Vercel functions, Railway services and
 * scripts alike. Vercel-specific request/response adapters live behind the
 * `@partrunner-ai/api-core/vercel` subpath and are NOT re-exported here — that
 * separation is what keeps `@vercel/node` out of Next.js consumers.
 */

export {
  checkConnection,
  configureNexusClient,
  getNexusClient,
  resetNexusClient,
} from './client';

export { reloadPostgrestSchema, rpcOn, tbl, type SchemaName } from './db';

export { logger, newRequestId, type Logger } from './logger';

export type { ApiResponse } from './types';

export * from './auditLog';
export * from './featureFlags';
export * from './identityRoles';
export * from './maintenanceMode';
export * from './paginate';
export * from './safeNext';
