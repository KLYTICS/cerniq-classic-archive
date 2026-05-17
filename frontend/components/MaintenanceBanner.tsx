'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

const PROBE_PATH = '/health';
const PROBE_TIMEOUT_MS = 3000;
const RE_PROBE_INTERVAL_MS = 30_000;

type ProbeStatus = 'unknown' | 'healthy' | 'down';

/**
 * Probe the backend health endpoint with mode: 'no-cors' so the request
 * succeeds without backend CORS headers — we only care WHETHER the
 * connection completes (any HTTP status counts as "up"). A thrown
 * error (network unreachable, SSL cert mismatch, DNS failure, timeout)
 * counts as "down."
 *
 * Env lookup is lazy (per-call, not module-level) so vi.stubEnv works
 * in tests AND so a runtime env change is honoured. In production
 * Next.js inlines NEXT_PUBLIC_* at build time either way.
 */
async function probe(): Promise<ProbeStatus> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_NODE_API_URL ||
    '';
  if (!apiBase) return 'unknown';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    await fetch(`${apiBase}${PROBE_PATH}`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return 'healthy';
  } catch {
    return 'down';
  }
}

/**
 * Renders a thin bilingual banner at the top of the viewport when the
 * backend API is unreachable. Self-clearing: re-probes every 30s and
 * removes the banner the moment the backend recovers. No manual flag.
 *
 * Permanent infrastructure — keep this component after the 2026-05-09
 * Railway cold-storage revival; it's the same defensive pattern mature
 * fintechs use for status banners.
 */
export function MaintenanceBanner() {
  const { locale } = useTranslation();
  const [status, setStatus] = useState<ProbeStatus>('unknown');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next = await probe();
      if (!cancelled) setStatus(next);
    };
    run();
    const id = setInterval(run, RE_PROBE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Render null while probe hasn't completed AND when API is healthy —
  // "innocent until proven down." No flicker on healthy load.
  if (status !== 'down') return null;

  const messageEn =
    'Treasury workspace is briefly offline for an infrastructure upgrade. Live data and reports will return shortly.';
  const messageEs =
    'El espacio de tesoreria esta brevemente fuera de linea por una actualizacion de infraestructura. Los datos en vivo y los informes regresaran pronto.';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="maintenance-banner"
      className="fixed left-0 right-0 top-0 z-[9999] border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-900 backdrop-blur-sm dark:text-amber-100"
    >
      <span className="font-medium">
        {locale === 'es' ? messageEs : messageEn}
      </span>
      <span className="mx-3 text-amber-700/60 dark:text-amber-300/60">·</span>
      <span className="text-amber-800/80 dark:text-amber-200/80">
        {locale === 'es' ? messageEn : messageEs}
      </span>
    </div>
  );
}

// Test seam: pure probe function exposed for unit tests.
export const __test__ = { probe };
