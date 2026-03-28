import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stress Testing — CERNIQ',
  description: 'Simulate historical crises and hypothetical scenarios to understand portfolio vulnerabilities.',
};

export default function StressTestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
