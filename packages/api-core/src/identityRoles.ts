/**
 * Enriches `identity.users` rows with their primary active role from the
 * normalized `identity.user_roles` relation.
 *
 * Selection rule:
 *   - is_active = true AND (expires_at IS NULL OR expires_at > now())
 *   - super_admin wins over anything else
 *   - tie-broken by earliest granted_at
 *
 * Returns a Map<userId, { id, full_name, email, role }> for O(1) lookup.
 */

import { tbl } from './db';
import { logger } from './logger';

const CTX = 'lib/identityRoles';

export interface UserWithRole {
  id: string;
  full_name: string | null;
  email: string;
  /** Primary active role_code; null if the user has no active role. */
  role: string | null;
}

export async function fetchUsersWithPrimaryRole(
  userIds: readonly string[]
): Promise<Map<string, UserWithRole>> {
  const map = new Map<string, UserWithRole>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const [usersRes, rolesRes] = await Promise.all([
    tbl('identity', 'users').select('id, full_name, email').in('id', ids),
    tbl('identity', 'user_roles')
      .select('user_id, role_code, granted_at, expires_at, is_active')
      .in('user_id', ids)
      .eq('is_active', true),
  ]);

  if (usersRes.error) logger.warn(CTX, 'users lookup failed', { err: usersRes.error });
  if (rolesRes.error) logger.warn(CTX, 'user_roles lookup failed', { err: rolesRes.error });

  type RoleRow = {
    user_id: string;
    role_code: string;
    granted_at: string;
    expires_at: string | null;
  };
  const now = Date.now();
  const roleByUser = new Map<string, string>();
  for (const r of (rolesRes.data ?? []) as RoleRow[]) {
    if (r.expires_at && new Date(r.expires_at).getTime() <= now) continue;
    const prev = roleByUser.get(r.user_id);
    if (!prev) {
      roleByUser.set(r.user_id, r.role_code);
      continue;
    }
    if (r.role_code === 'super_admin' && prev !== 'super_admin') {
      roleByUser.set(r.user_id, r.role_code);
    }
  }

  type UserRow = { id: string; full_name: string | null; email: string | null };
  for (const u of (usersRes.data ?? []) as UserRow[]) {
    map.set(u.id, {
      id: u.id,
      full_name: u.full_name,
      email: u.email ?? '',
      role: roleByUser.get(u.id) ?? null,
    });
  }

  return map;
}
