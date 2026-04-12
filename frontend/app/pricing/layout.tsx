import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — CERNIQ ALM Intelligence | From $750',
  description: 'ALM reports from $750 one-time or $2,500/month pilot. Compare costs: traditional consultants charge $8,000-$12,000 per quarter. CERNIQ delivers in 24 hours, not 3-6 weeks.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'CERNIQ Pricing — 83-93% Savings vs. Traditional Consultants',
    description: 'One-time ALM report $750, pilot $2,500/mo, standard $3,500/mo. Goldman-grade analytics at credit union pricing.',
    url: 'https://cerniq.io/pricing',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
