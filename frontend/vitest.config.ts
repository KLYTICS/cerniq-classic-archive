import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '../.omx/**',
      '../Cerniq-export-local-green/**',
      '../Cerniq-latest-main/**',
      '../Cerniq-main/**',
      '../Cerniq-main-green/**',
      '../Cerniq-main-hotfix/**',
      '../Cerniq-release/**',
    ],
    coverage: {
      // Floor lock — measured 2026-05-15 at statements 60.92 / branches 52.54
      // / functions 55.45 / lines 62.34. Set ~0.5pp below current to absorb
      // refactor flux while still catching real regressions. Ratchet upward
      // when coverage rises (don't loosen). Applies whenever
      // `npm run test:coverage` runs (already in `verify:frontend` chain).
      thresholds: {
        statements: 60,
        branches: 52,
        functions: 55,
        lines: 62,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
