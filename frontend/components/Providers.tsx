'use client';

import { ReactNode } from 'react';
import AuthInitializer from '@/components/auth/AuthInitializer';
import AnalyticsPageTracker from '@/components/analytics/AnalyticsPageTracker';
import { TranslationProvider } from '@/lib/i18n';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary context="app-root">
      <TranslationProvider>
        <AuthInitializer />
        <AnalyticsPageTracker />
        {children}
      </TranslationProvider>
    </ErrorBoundary>
  );
}
