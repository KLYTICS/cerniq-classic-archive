'use client';

import { ToastProvider } from '@/components/ui/Toast';

/**
 * The Close Cockpit pages rely on the ui/Toast variant (distinct from the
 * root components/Toast provider mounted in app/layout.tsx). Wrap the close
 * subtree in its own provider so that useToast() resolves correctly during
 * both client navigation and static prerender.
 */
export default function CloseLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="cerniq-dashboard-theme cerniq-dashboard-page">{children}</div>
    </ToastProvider>
  );
}
