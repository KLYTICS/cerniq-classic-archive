'use client';

import { ReactNode } from 'react';
import AuthInitializer from '@/components/auth/AuthInitializer';
import AnalyticsPageTracker from '@/components/analytics/AnalyticsPageTracker';
import { TranslationProvider } from '@/lib/i18n';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <TranslationProvider>
      <AuthInitializer />
      <AnalyticsPageTracker />
      {children}
    </TranslationProvider>
  );
}
