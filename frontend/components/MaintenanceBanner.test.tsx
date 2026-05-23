import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MaintenanceBanner } from './MaintenanceBanner';
import { TranslationProvider } from '@/lib/i18n';

function renderWithI18n(ui: React.ReactNode) {
  return render(<TranslationProvider>{ui}</TranslationProvider>);
}

describe('MaintenanceBanner', () => {
  beforeEach(() => {
    // Real timers — fake timers + AbortController interact poorly with
    // the probe's setTimeout. The 30s re-probe interval is standard
    // React behaviour (setInterval) — not worth unit-testing the timer
    // wheel itself.
    //
    // Env var is required: probe short-circuits to 'unknown' if neither
    // NEXT_PUBLIC_API_URL nor NEXT_PUBLIC_NODE_API_URL is set (sensible
    // production behaviour — don't claim outage when there's nothing
    // configured to probe). Tests need to stub it to exercise the
    // healthy / down paths.
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.cerniq.io');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders nothing initially (probe pending — innocent until proven down)', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const { container } = renderWithI18n(<MaintenanceBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when probe succeeds (API healthy)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ type: 'opaque', status: 0 }),
    );
    renderWithI18n(<MaintenanceBanner />);
    // Wait a moment for the probe to resolve; expect no banner ever appears.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('maintenance-banner')).toBeNull();
  });

  it('renders the bilingual banner when probe rejects (API down — SSL fail / network unreachable / timeout)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    renderWithI18n(<MaintenanceBanner />);
    await waitFor(
      () => {
        const banner = screen.getByTestId('maintenance-banner');
        expect(banner).toBeInTheDocument();
        // both EN and ES strings present (bilingual side-by-side, no language switcher)
        expect(banner.textContent).toMatch(/Treasury workspace/);
        expect(banner.textContent).toMatch(/espacio de tesoreria/);
      },
      { timeout: 1000 },
    );
  });
});
