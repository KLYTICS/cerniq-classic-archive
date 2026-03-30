import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const coverageDirectory = process.env.CERNIQ_VITEST_COVERAGE_DIR || './coverage';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    fileParallelism: false,
    maxWorkers: 1,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      clean: true,
      processingConcurrency: 1,
      reportsDirectory: coverageDirectory,
      reporter: ['text', 'json-summary', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
