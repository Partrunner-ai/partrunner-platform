/** Lowercases and strips diacritics so "Gestión" and "gestion" compare equal. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase();
}

/**
 * Splits a search query into normalized words. Matching is per word, in any order:
 * data often stores names with doubled spaces or splits them across fields, and apps
 * that search on the server match per word, so a single contiguous substring would
 * hide rows the server already returned ("ana  maria lopez" vs "ana maria lopez", or
 * "ana lopez" skipping a middle name).
 */
export function searchTokens(query: string): string[] {
  return normalizeSearch(query).split(/\s+/).filter(Boolean);
}

/** True when every query word appears somewhere in `text`; an empty query matches all. */
export function matchesSearch(text: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  const normalized = normalizeSearch(text);
  return tokens.every((token) => normalized.includes(token));
}
