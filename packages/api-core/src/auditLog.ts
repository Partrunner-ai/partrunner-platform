import { tbl } from './db';
import { logger } from './logger';

const CTX = 'lib/auditLog';

/**
 * Persist an admin action to the admin_audit_log table.
 * Fire-and-forget: never blocks the caller, errors are logged to stderr.
 */
export function logAdminAction(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  // `| null` because three callers pass an explicit `null` as the positional
  // placeholder for "no details" on their way to `req`, and the body below
  // already normalises with `details ?? null`. Accepting it is closer to how
  // the function is actually used than making those call sites say `undefined`.
  details?: Record<string, unknown> | null,
  req?: { headers?: Record<string, string | string[] | undefined> }
): void {
  const ipAddress =
    (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    (req?.headers?.['x-real-ip'] as string) ??
    null;
  const userAgent = (req?.headers?.['user-agent'] as string) ?? null;

  tbl('core', 'admin_audit_log')
    .insert({
      admin_user_id: adminId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    // Two-argument `then` rather than `.then().catch()`: the builder is a
    // PromiseLike, and `catch` is not part of that contract. It happens to
    // work because postgrest hands back a real Promise underneath, but the
    // rejection handler belongs on `then`, which PromiseLike does guarantee.
    .then(
      ({ error }) => {
        if (error) {
          logger.error(CTX, 'Failed to write audit log', {
            err: error.message,
            action,
            entityType,
            entityId,
          });
        }
      },
      (err: unknown) => {
        logger.error(CTX, 'Audit log unexpected error', { err });
      }
    );
}
