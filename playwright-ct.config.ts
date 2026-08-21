import { defineConfig } from '@playwright/experimental-ct-react';

export default defineConfig({
  testDir: './packages/ui/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ctPort: 3100,
    viewport: { width: 1280, height: 800 },
  },
});
