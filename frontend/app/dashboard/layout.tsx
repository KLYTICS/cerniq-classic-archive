import type { ReactNode } from 'react';
import { MaintenanceBanner } from '@/components/MaintenanceBanner';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cerniq-dashboard-theme cerniq-dashboard-page">
      <MaintenanceBanner />
      {children}
    </div>
  );
}
