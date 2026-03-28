import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Banco Comunidad Demo — CERNIQ',
  description: 'Quick-access demo redirect for the Banco Comunidad preset ALM analysis.',
};

export default function PabloLayout({ children }: { children: React.ReactNode }) {
  return children;
}
