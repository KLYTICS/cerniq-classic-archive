import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Volatility Analysis — CERNIQ',
  description: 'Historical and implied volatility analysis with GARCH forecasting.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
