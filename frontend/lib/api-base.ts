function trimTrailingSlashes(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

const CONFIGURED_API_ORIGIN = trimTrailingSlashes(
  process.env.NEXT_PUBLIC_NODE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    '',
);

function normalizePath(path: string): string {
  if (!path) {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
}

export function getConfiguredApiOrigin(): string {
  return CONFIGURED_API_ORIGIN;
}

export function getPublicApiBase(): string {
  return '';
}

export function getPublicApiUrl(path: string): string {
  return normalizePath(path);
}
