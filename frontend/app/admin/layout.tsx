'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary context="admin">
      {children}
    </ErrorBoundary>
  );
}
