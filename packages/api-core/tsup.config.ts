import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/vercel.ts', 'src/auth.ts', 'src/week.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Peer deps must never be bundled: two copies of supabase-js would mean two
  // connection pools, and @vercel/node is optional for non-Vercel consumers.
  external: ['@supabase/supabase-js', '@vercel/node', 'bcryptjs'],
});
