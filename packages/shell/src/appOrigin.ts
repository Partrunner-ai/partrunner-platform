/**
 * App-origin comparison. Production serves an app at `www.<host>` while the
 * registry holds `<host>` (the apex redirects to `www.`). Both are one app.
 * Only a leading `www.` is an alias: `staging.<host>` is a different app origin.
 */
export function canonicalOrigin(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.origin === 'null') return '';
    const host = parsed.hostname.replace(/^www\./i, '');
    return `${parsed.protocol}//${host}${parsed.port ? `:${parsed.port}` : ''}`;
  } catch {
    return '';
  }
}

/** Do two URLs belong to the same app origin, treating `www.<host>` as `<host>`? */
export function sameAppOrigin(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = canonicalOrigin(a);
  return left !== '' && left === canonicalOrigin(b);
}
