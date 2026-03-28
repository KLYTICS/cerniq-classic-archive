import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Why CERNIQ — ALM Intelligence for PR Cooperativas',
  description: '6 reasons cooperativas choose CERNIQ: 83% cost savings, 24-hour delivery, COSSEC compliance, bilingual EN/ES, 62 ALM modules, 34 quant models.',
  alternates: { canonical: '/why-cerniq' },
  openGraph: {
    title: 'Why CERNIQ — Built for Puerto Rico Cooperativas',
    description: 'Goldman-grade ALM analytics at credit union pricing. COSSEC-compliant, bilingual, delivered in hours not weeks.',
    url: 'https://cerniq.io/why-cerniq',
  },
};

export default function WhyCerniqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
