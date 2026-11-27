import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

// esbuild strips leading "use client" directives during bundling, so we
// re-prepend it after the build. Next app-router consumers need it as the very
// first line; it's a harmless no-op for Vite/CRA.
//
// `src/server.ts` is the exception: it holds only parts with no hooks and is
// published without the directive, so a Server Component renders them on the
// server instead of across the RSC boundary. Builds on #34.
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
