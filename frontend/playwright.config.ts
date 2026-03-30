import path from 'path';
import { defineConfig, devices } from '@playwright/test';

const backendUrl = 'http://127.0.0.1:3000';
const frontendUrl = 'http://127.0.0.1:3001';
const frontendCwd = __dirname;
const backendCwd = path.resolve(__dirname, '../backend-node');
const playwrightArtifactsDir = path.join(frontendCwd, 'test-results', 'playwright');
const playwrightHtmlReportDir = path.join(frontendCwd, 'test-results', 'playwright-report');
const backendEnv = [
  'JWT_SECRET=e2e-secret-must-be-at-least-32-characters-long',
  'DATABASE_URL=postgresql://cerniq:dev_password_change_in_prod@127.0.0.1:5433/cerniq?schema=public',
  'REDIS_URL=redis://127.0.0.1:6380',
  'NODE_ENV=test',
  'ADMIN_KEY=e2e-admin-key',
].join(' ');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  outputDir: playwrightArtifactsDir,
  reporter: [['html', { open: 'never', outputFolder: playwrightHtmlReportDir }]],
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `docker start cerniq-db cerniq-redis >/dev/null 2>&1 || true; ${backendEnv} npm run start:dev`,
      cwd: backendCwd,
      url: `${backendUrl}/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      cwd: frontendCwd,
      command: `NEXT_PUBLIC_NODE_API_URL=${backendUrl} npm run dev`,
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
