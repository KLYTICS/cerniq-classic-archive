import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Case Studies — CERNIQ Treasury and Risk Platform',
  description:
    'How institutions, advisors, and finance teams use CERNIQ to compress reporting cycles, improve visibility, and centralize treasury-and-risk workflows.',
  alternates: { canonical: '/case-studies' },
  openGraph: {
    title: 'CERNIQ Case Studies — Institutional Workflow Results',
    description:
      'Operational and reporting results for finance teams using CERNIQ across treasury, risk, and client delivery workflows.',
    url: 'https://cerniq.io/case-studies',
  },
};

export default function CaseStudiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
