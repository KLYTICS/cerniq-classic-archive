import { defineConfig, devices } from '@playwright/test';

const frontendBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3101';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ||
  process.env.NEXT_PUBLIC_NODE_API_URL ||
  'http://127.0.0.1:3100';
const backendCommand =
  process.env.PLAYWRIGHT_BACKEND_COMMAND ||
  "sh -c 'cd ../backend-node && test -f dist/src/main.js || npm run build >/dev/null; PORT=3100 BACKEND_PORT=3100 npm run start:prod'";
const frontendCommand =
  process.env.PLAYWRIGHT_FRONTEND_COMMAND ||
  "sh -c 'test -f .next/BUILD_ID && test -f .next/prerender-manifest.json || npm run build >/dev/null; NEXT_PUBLIC_NODE_API_URL=http://127.0.0.1:3100 NEXT_PUBLIC_API_URL=http://127.0.0.1:3100 npx next start --port 3101'";

process.env.PLAYWRIGHT_BASE_URL ??= frontendBaseUrl;
process.env.PLAYWRIGHT_BACKEND_URL ??= backendBaseUrl;

const webServer = skipWebServer
  ? undefined
  : [
      {
        command: backendCommand,
        url: `${backendBaseUrl}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
      {
        command: frontendCommand,
        url: frontendBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
    ];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: frontendBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer,
});
