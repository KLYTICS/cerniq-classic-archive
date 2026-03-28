import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Charts — CERNIQ',
  description: 'Real-time and historical market data charts with technical indicators.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
