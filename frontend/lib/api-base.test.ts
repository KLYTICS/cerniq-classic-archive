import { afterEach, describe, expect, it, vi } from 'vitest';

const originalNodeApiUrl = process.env.NEXT_PUBLIC_NODE_API_URL;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

async function loadApiBase(env?: { node?: string; api?: string }) {
  vi.resetModules();

  if (env?.node === undefined) {
    delete process.env.NEXT_PUBLIC_NODE_API_URL;
  } else {
    process.env.NEXT_PUBLIC_NODE_API_URL = env.node;
  }

  if (env?.api === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = env.api;
  }

  return import('./api-base');
}

describe('api-base', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_NODE_API_URL = originalNodeApiUrl;
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  it('prefers the node api origin and trims trailing slashes', async () => {
    const { getConfiguredApiOrigin } = await loadApiBase({
      node: ' https://node-api.cerniq.io/// ',
      api: 'https://public-api.cerniq.io/',
    });

    expect(getConfiguredApiOrigin()).toBe('https://node-api.cerniq.io');
  });

  it('falls back to the public api origin when a node origin is not set', async () => {
    const { getConfiguredApiOrigin } = await loadApiBase({
      api: 'https://public-api.cerniq.io///',
    });

    expect(getConfiguredApiOrigin()).toBe('https://public-api.cerniq.io');
  });

  it('returns an empty public base and normalizes api paths', async () => {
    const { getConfiguredApiOrigin, getPublicApiBase, getPublicApiUrl } = await loadApiBase();

    expect(getConfiguredApiOrigin()).toBe('');
    expect(getPublicApiBase()).toBe('');
    expect(getPublicApiUrl('/api/auth/login')).toBe('/api/auth/login');
    expect(getPublicApiUrl('api/auth/login')).toBe('/api/auth/login');
    expect(getPublicApiUrl('')).toBe('/');
  });
});
