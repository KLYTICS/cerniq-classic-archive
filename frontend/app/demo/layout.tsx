import type { Metadata } from 'next';
import { DemoErrorBoundary } from './DemoErrorBoundary';

export const metadata: Metadata = {
  title: 'Interactive Demo — CERNIQ ALM Intelligence',
  description: 'Try CERNIQ with live FirstBank Puerto Rico data. Walk through COSSEC scoring, ALM reports, SpendCheck findings, AI advisor, and the quant engine — no signup required.',
  alternates: { canonical: '/demo' },
  openGraph: {
    title: 'Try CERNIQ — Interactive ALM Demo',
    description: '6-step walkthrough with live data: COSSEC scoring, ALM reports, stress testing, AI advisor, and 170+ quant models.',
    url: 'https://cerniq.io/demo',
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoErrorBoundary>
      {children}
    </DemoErrorBoundary>
  );
}
