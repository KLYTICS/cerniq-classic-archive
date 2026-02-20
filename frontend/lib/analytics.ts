/**
 * Analytics wrapper — Segment as the data layer, routing to GA4 + PostHog.
 * Gracefully degrades when Segment is not loaded (env var not set).
 */

declare global {
  interface Window {
    analytics?: {
      identify: (userId: string, traits?: Record<string, any>) => void;
      track: (event: string, properties?: Record<string, any>) => void;
      page: (name?: string, properties?: Record<string, any>) => void;
      reset: () => void;
    };
  }
}

export const EVENTS = {
  // Auth
  SIGNUP: 'Signed Up',
  LOGIN: 'Logged In',
  LOGOUT: 'Logged Out',

  // Onboarding
  ONBOARDING_COMPLETED: 'Onboarding Completed',
  ONBOARDING_SKIPPED: 'Onboarding Skipped',

  // Features
  ALM_ANALYSIS_RUN: 'ALM Analysis Run',
  ALM_STRESS_TEST_RUN: 'ALM Stress Test Run',
  ALM_REPORT_DOWNLOADED: 'ALM Report Downloaded',
  INSTITUTION_TYPE_SELECTED: 'Institution Type Selected',
  DEMO_DATA_SEEDED: 'Demo Data Seeded',
  TICKER_SEARCHED: 'Ticker Searched',
  PORTFOLIO_CREATED: 'Portfolio Created',
  VALUATION_VIEWED: 'Valuation Viewed',
  RISK_ANALYSIS_RUN: 'Risk Analysis Run',
} as const;

function getSegment() {
  if (typeof window !== 'undefined') {
    return window.analytics;
  }
  return undefined;
}

export const analytics = {
  identify(userId: string, traits?: Record<string, any>) {
    getSegment()?.identify(userId, traits);
  },

  track(event: string, properties?: Record<string, any>) {
    getSegment()?.track(event, properties);
  },

  page(name?: string, properties?: Record<string, any>) {
    getSegment()?.page(name, properties);
  },

  reset() {
    getSegment()?.reset();
  },
};
