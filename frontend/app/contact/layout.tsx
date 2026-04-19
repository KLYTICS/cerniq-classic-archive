import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Sales — CERNIQ ALM Intelligence',
  description: 'Talk to CERNIQ about partner pricing, assisted rollout, or security review for bilingual ALM reporting.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Sales — CERNIQ',
    description: 'Partner, enterprise, and assisted rollout conversations for CERNIQ bilingual ALM reporting.',
    url: 'https://cerniq.io/contact',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
