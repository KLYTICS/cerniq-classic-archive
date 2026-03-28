import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compliance Matrix — CERNIQ | COSSEC, NCUA, Basel III Coverage',
  description: 'See how CERNIQ covers 20 regulatory requirements across COSSEC, NCUA, and Basel III frameworks. IRR policy, stress testing, CECL, duration gap, LCR, and more.',
  alternates: { canonical: '/compliance' },
  openGraph: {
    title: 'CERNIQ Compliance Matrix — 20 Requirements, 3 Frameworks',
    description: 'Full regulatory coverage: COSSEC (PR), NCUA (US), Basel III/IRRBB. Automated compliance documentation.',
    url: 'https://cerniq.io/compliance',
  },
};

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
