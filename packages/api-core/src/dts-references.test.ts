/**
 * Guards the built `.d.ts` against referencing types that its dependencies do
 * not actually export.
 *
 * A bundled declaration can accidentally reference an internal dependency type
 * that the dependency does not export. With `skipLibCheck`, the dangling name
 * may silently become `any` and erase result typing.
 *
 * A dangling reference in a declaration file is invisible by construction, so
 * it needs an explicit check rather than a type test.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = join(import.meta.dirname, '..', 'dist');

/** Names a `.d.ts` reaches for via `import * as ns from '<dep>'` + `ns.Name`. */
function namespacedRefs(dts: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of dts.matchAll(/import \* as (\w+) from ['"]([^'"]+)['"]/g)) {
    const [, alias, dep] = m;
    const used = new Set(
      [...dts.matchAll(new RegExp(`\\b${alias}\\.(\\w+)`, 'g'))].map(u => u[1]!)
    );
    if (used.size) out.set(dep!, used);
  }
  return out;
}

/** Public type names a dependency's own declaration file exports. */
function exportedBy(dep: string): Set<string> {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), 'node_modules', dep, 'package.json'), 'utf8')
  );
  const rel =
    pkg.exports?.['.']?.import?.types ?? pkg.exports?.['.']?.require?.types ?? pkg.types;
  const dts = readFileSync(join(process.cwd(), 'node_modules', dep, rel), 'utf8');

  const names = new Set<string>();
  for (const m of dts.matchAll(/^export \{([^}]*)\}/gm)) {
    for (const part of m[1]!.split(',')) {
      const n = part.trim().replace(/^type /, '').split(/\s+as\s+/).pop();
      if (n) names.add(n);
    }
  }
  for (const m of dts.matchAll(/^export declare (?:const|function|class|type|interface) (\w+)/gm)) {
    names.add(m[1]!);
  }
  // `export * from 'x'` re-exports transitively; treat as opaque and skip the
  // check for those names rather than reporting a false positive.
  return names;
}

describe('built declarations', () => {
  const entries = ['index.d.ts', 'vercel.d.ts', 'feature-flags.d.ts'];

  it.each(entries)('%s only references types its dependencies export', entry => {
    const path = join(DIST, entry);
    if (!existsSync(path)) {
      throw new Error(`${entry} not built — run \`pnpm build\` before \`pnpm test\`.`);
    }

    const dangling: string[] = [];
    for (const [dep, used] of namespacedRefs(readFileSync(path, 'utf8'))) {
      // Only dependencies we can resolve locally are checkable.
      let exported: Set<string>;
      try {
        exported = exportedBy(dep);
      } catch {
        continue;
      }
      // A dependency with `export *` may legitimately expose more than we can
      // see; only flag when we found a concrete export list and the name is absent.
      if (!exported.size) continue;
      for (const name of used) {
        if (!exported.has(name)) dangling.push(`${dep}#${name}`);
      }
    }

    expect(dangling, `dangling type references in dist/${entry}`).toEqual([]);
  });
});
