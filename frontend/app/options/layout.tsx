import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Options Analytics — CERNIQ',
  description: 'Black-Scholes pricing, Greeks calculation, implied volatility, and strategy builder.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
