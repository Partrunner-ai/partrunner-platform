import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

// esbuild strips the leading "use client" directive from the React entry when
// bundling; re-prepend it so Next app-router consumers get it as line 1.
const CLIENT = '"use client";\n';
const REACT_ENTRIES = ['dist/react.js', 'dist/react.cjs'];

export default defineConfig({
  entry: ['src/index.ts', 'src/react.tsx', 'src/server.ts', 'src/next.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['react', 'react-dom', 'next', 'next/headers', 'next/server', 'jose', '@partrunner-ai/app-registry'],
  async onSuccess() {
    await Promise.all(
      REACT_ENTRIES.map(async (f) => {
        const body = await readFile(f, 'utf8');
        if (!body.startsWith('"use client"') && !body.startsWith("'use client'")) {
          await writeFile(f, CLIENT + body);
        }
      }),
    );
  },
});
