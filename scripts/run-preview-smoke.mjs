import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is required`);
    process.exit(1);
  }

  return value;
}

function getBypassCookie(baseUrl) {
  if (process.env.PLAYWRIGHT_VERCEL_BYPASS_COOKIE?.trim()) {
    return process.env.PLAYWRIGHT_VERCEL_BYPASS_COOKIE.trim();
  }

  const hostname = new URL(baseUrl).hostname;
  if (!hostname.endsWith('.vercel.app')) {
    return '';
  }

  const result = execFileSync(
    'npx',
    [
      'vercel',
      'curl',
      '/',
      '--deployment',
      baseUrl,
      '--',
      '--include',
      '--silent',
      '--show-error',
      '--header',
      'x-vercel-set-bypass-cookie: true',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const match = result.match(/set-cookie:\s*_vercel_jwt=([^;]+);/i);
  if (!match) {
    console.error(
      `Could not obtain a Vercel preview bypass cookie for ${baseUrl}.`,
    );
    process.exit(1);
  }

  return match[1];
}

function run(command, args, env, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const baseUrl = requireEnv('PLAYWRIGHT_BASE_URL');
const bypassCookie = getBypassCookie(baseUrl);
const frontendDir = fileURLToPath(new URL('../frontend', import.meta.url));
const env = {
  ...process.env,
  PLAYWRIGHT_SKIP_WEBSERVER: '1',
  PLAYWRIGHT_ENABLE_CHECKOUT_SMOKE: '1',
  PLAYWRIGHT_MOCK_CHECKOUT: process.env.PLAYWRIGHT_MOCK_CHECKOUT || '1',
  PLAYWRIGHT_BASE_URL: baseUrl,
  PLAYWRIGHT_BACKEND_URL:
    process.env.PLAYWRIGHT_BACKEND_URL || 'https://api.cerniq.io',
  ...(bypassCookie ? { PLAYWRIGHT_VERCEL_BYPASS_COOKIE: bypassCookie } : {}),
};

run('npm', ['run', 'deploy:prepare'], process.env);
run('npm', ['run', 'test:e2e:preview'], env, frontendDir);
