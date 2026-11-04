import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

// esbuild strips leading "use client" directives during bundling, so we
// re-prepend it after the build. Next app-router consumers need it as the very
// first line; it's a harmless no-op for Vite/CRA.
//
// `server.ts` is deliberately excluded: it only re-exports components with no
// client-only hooks, published without the directive so a Server Component
// can render them without crossing Next's RSC/Flight client boundary (see
// src/server.ts for why — PMO 143c1bdd).
const CLIENT_DIRECTIVE = '"use client";\n';
const ENTRIES = ['dist/index.js', 'dist/index.cjs'];

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['react', 'react-dom', 'lucide-react'],
  async onSuccess() {
    await Promise.all(
      ENTRIES.map(async (file) => {
        const body = await readFile(file, 'utf8');
        if (!body.startsWith('"use client"') && !body.startsWith("'use client'")) {
          await writeFile(file, CLIENT_DIRECTIVE + body);
        }
      }),
    );
  },
});
