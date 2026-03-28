import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portfolio Management — CERNIQ',
  description: 'Track and analyze your investment portfolios with quantitative risk metrics.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
