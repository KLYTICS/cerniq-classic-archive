import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Market Data — CERNIQ',
  description: 'Real-time market data including Fed Futures rates and yield curve analytics.',
};

export default function LiveDataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
