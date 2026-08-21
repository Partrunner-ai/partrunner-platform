/**
 * paginate.ts
 *
 * Helper to fetch all rows for a Supabase query, bypassing PostgREST's
 * server-side `db-max-rows` cap (default 1000 on Supabase Cloud).
 *
 * `.limit(N)` on a supabase-js builder cannot exceed the server's
 * `db-max-rows` setting. PostgREST truncates larger responses, so callers that
 * need complete result sets must request deterministic pages.
 *
 * How to use:
 *   const all = await fetchAllPages<MyRow>(() =>
 *     supabase.from('my_table').select('*').eq('foo', 'bar').order('id')
 *   );
 *
 * Important:
 *   - The factory MUST return a FRESH builder each call; supabase-js
 *     builders are mutable and applying `.range()` to the same instance
 *     twice produces broken queries.
 *   - The query MUST have a deterministic `.order(...)` to make pagination
 *     stable across pages. Pass it inside the factory.
 *   - Hard cap of MAX_PAGES iterations to prevent runaway loops on
 *     unexpected data growth or query bugs.
 */

const PAGE_SIZE = 1000;
const MAX_PAGES = 200; // Bounded safety ceiling for unexpectedly large queries.

type SupabasePromiseLike<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

interface RangeableBuilder<T> {
  range(from: number, to: number): SupabasePromiseLike<T>;
}

export async function fetchAllPages<T>(builderFactory: () => RangeableBuilder<T>): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await builderFactory().range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`fetchAllPages: ${error.message} (page=${page}, from=${from})`);
    }
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
    from += PAGE_SIZE;
  }
  throw new Error(
    `fetchAllPages: exceeded MAX_PAGES=${MAX_PAGES} (rows so far=${all.length}). ` +
      `If this is legitimate, raise the limit; otherwise check for a missing filter.`
  );
}
