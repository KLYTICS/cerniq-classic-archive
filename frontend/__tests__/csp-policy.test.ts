import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * CSP regression guard.
 *
 * On 2026-08-01 production sign-in was dead for days with no error in any log:
 * Supabase auth was switched on (`NEXT_PUBLIC_SUPABASE_URL` set in Vercel), so
 * `apiClient.login()` began calling `https://<ref>.supabase.co/auth/v1/token`
 * from the browser — but `connect-src` never listed supabase.co, so the browser
 * refused the request before it left the page. Nothing server-side ever saw it.
 *
 * The failure mode is silent and total, so it is pinned here rather than left
 * to review: any origin the app must reach at runtime has to be in connect-src.
 */

const CONFIG_PATH = join(__dirname, '..', 'vercel.json');

type VercelConfig = {
  headers?: Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }>;
};

function readCsp(): string {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as VercelConfig;
  const csp = config.headers
    ?.flatMap((entry) => entry.headers)
    .find((header) => header.key.toLowerCase() === 'content-security-policy');

  if (!csp) {
    throw new Error('No Content-Security-Policy header defined in vercel.json');
  }
  return csp.value;
}

function directive(csp: string, name: string): string[] {
  const found = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));

  if (!found) {
    throw new Error(`CSP is missing the "${name}" directive`);
  }
  return found.split(/\s+/).slice(1);
}

describe('Content-Security-Policy', () => {
  it('is defined in vercel.json', () => {
    expect(readCsp()).toContain('default-src');
  });

  // Each entry is an origin the browser must reach for a core flow to work.
  // Removing one takes that flow down silently — hence the named reasons.
  const REQUIRED_CONNECT_SRC: Array<[string, string]> = [
    ["'self'", 'same-origin Next route handlers (/api/auth/session)'],
    ['https://api.cerniq.io', 'the Nest API — profile, portal, direct CSV upload'],
    ['wss://api.cerniq.io', 'report-progress websocket'],
    ['https://*.supabase.co', 'Supabase auth: password grant, magic link, OAuth code exchange'],
  ];

  it.each(REQUIRED_CONNECT_SRC)('allows %s in connect-src (%s)', (origin) => {
    expect(directive(readCsp(), 'connect-src')).toContain(origin);
  });

  it('does not fall back to a wildcard connect-src', () => {
    // `*` would make this guard vacuous and undo the policy's purpose.
    expect(directive(readCsp(), 'connect-src')).not.toContain('*');
  });

  it('keeps framing and object embedding locked down', () => {
    const csp = readCsp();
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
  });
});
