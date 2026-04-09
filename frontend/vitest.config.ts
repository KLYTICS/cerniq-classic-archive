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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
