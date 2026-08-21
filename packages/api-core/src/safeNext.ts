const DEFAULT_ADMIN_PATH = '/admin/dashboard';

/**
 * Validates a post-auth redirect target. Only relative paths under `/admin`
 * are allowed — rejects open redirects and protocol-relative URLs.
 */
export function safeNext(next?: string | string[] | null): string {
  const raw = Array.isArray(next) ? next[0] : next;
  if (!raw || typeof raw !== 'string') return DEFAULT_ADMIN_PATH;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/admin')) return DEFAULT_ADMIN_PATH;
  if (trimmed.startsWith('//') || trimmed.includes('://')) return DEFAULT_ADMIN_PATH;
  return trimmed;
}
