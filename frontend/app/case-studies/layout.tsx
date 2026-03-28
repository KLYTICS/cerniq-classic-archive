import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Case Studies — CERNIQ ALM Intelligence',
  description: 'How cooperativas and CPA firms use CERNIQ to cut ALM costs by 90%, deliver reports in 24 hours, and pass COSSEC examinations with zero findings.',
  alternates: { canonical: '/case-studies' },
  openGraph: {
    title: 'CERNIQ Case Studies — Real Results for Cooperativas',
    description: '$380M credit union: 45% time reduction, 90% cost savings. CPA firm: 8 clients served through one platform.',
    url: 'https://cerniq.io/case-studies',
  },
};

export default function CaseStudiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
