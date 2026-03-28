import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Risk Parity — CERNIQ',
  description: 'Hierarchical Risk Parity portfolio allocation and analysis.',
};

export default function RiskParityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
