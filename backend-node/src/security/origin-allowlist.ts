const CERNIQ_ORIGIN_PATTERN = /^https?:\/\/([a-z0-9-]+\.)*cerniq\.io(?::\d+)?$/i;
const DEFAULT_VERCEL_PREVIEW_PATTERN =
  /^https:\/\/[a-z0-9-]+-ekiess-projects\.vercel\.app$/i;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function parseCsv(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(origin: string): string | null {
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function allowPreviewOrigins(): boolean {
  const raw = (process.env.ALLOW_PREVIEW_ORIGINS || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function getPreviewRegex(): RegExp {
  const configured = (process.env.VERCEL_PREVIEW_ORIGIN_REGEX || '').trim();
  if (!configured) {
    return DEFAULT_VERCEL_PREVIEW_PATTERN;
  }
  try {
    return new RegExp(configured, 'i');
  } catch {
    return DEFAULT_VERCEL_PREVIEW_PATTERN;
  }
}

function buildAllowedOriginsSet(): Set<string> {
  const origins = new Set<string>();
  const frontendUrl = normalizeOrigin((process.env.FRONTEND_URL || '').trim());
  if (frontendUrl) {
    origins.add(frontendUrl);
  }

  for (const origin of [
    ...parseCsv(process.env.ALLOWED_ORIGINS),
    ...parseCsv(process.env.CORS_ORIGIN),
  ]) {
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      origins.add(normalized);
    }
  }

  if (!isProduction()) {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:3001');
  }

  return origins;
}

export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) {
    return true;
  }

  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  const staticAllowedOrigins = buildAllowedOriginsSet();
  if (staticAllowedOrigins.has(normalized)) {
    return true;
  }

  if (CERNIQ_ORIGIN_PATTERN.test(normalized)) {
    return true;
  }

  if (allowPreviewOrigins() && getPreviewRegex().test(normalized)) {
    return true;
  }

  return false;
}

export function corsOriginCallback(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`CORS origin not allowed: ${origin || 'unknown'}`), false);
}
