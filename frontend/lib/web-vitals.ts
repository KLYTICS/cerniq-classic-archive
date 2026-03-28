import type { Metric } from 'web-vitals';

const ANALYTICS_ENDPOINT = '/api/analytics/web-vitals';

/**
 * Reports Core Web Vitals (LCP, FID, CLS, FCP, TTFB) to backend.
 * Called from root layout via useReportWebVitals or manual onLoad.
 */
export function reportWebVital(metric: Metric) {
  // Only report in production
  if (process.env.NODE_ENV !== 'production') return;

  const body = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: new Date().toISOString(),
  };

  // Use sendBeacon for reliability (survives page unload)
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(ANALYTICS_ENDPOINT, JSON.stringify(body));
  } else {
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  }
}
