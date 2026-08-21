import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://nexus.partrunner.ai' } },
    setupFiles: ['./src/test/setup.ts'],
  },
});
