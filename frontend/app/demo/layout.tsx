'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary context="demo">
      {children}
    </ErrorBoundary>
  );
}
