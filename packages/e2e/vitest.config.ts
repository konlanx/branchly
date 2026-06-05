import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.e2e.ts'],
    globalSetup: ['src/harness/global-setup.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
