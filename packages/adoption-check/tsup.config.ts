import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
  },
  {
    // ESM only: the bin runs the ESM file directly, and a CommonJS variant
    // would reintroduce the bare `process` binding the artifact gate forbids.
    entry: ['src/cli.ts'],
    format: ['esm'],
    clean: false,
    sourcemap: true,
    treeshake: true,
    // The artifact gate requires the published bin to start with the Node
    // shebang; splitting would move cli.js's body into a shared chunk.
    splitting: false,
  },
]);
