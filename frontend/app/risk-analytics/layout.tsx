import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Risk Analytics — CERNIQ',
  description: 'Portfolio risk analysis including VaR, CVaR, correlation, and stress testing.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
