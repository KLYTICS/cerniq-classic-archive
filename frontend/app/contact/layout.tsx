import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a Demo — CERNIQ ALM Intelligence',
  description: 'Schedule a 20-minute walkthrough of CERNIQ with live demo data. See how bilingual ALM reporting works for your institution.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Book a Demo — CERNIQ',
    description: '20-minute ALM platform walkthrough with live demo data. See rate risk, CECL, stress testing, and regulatory compliance in action.',
    url: 'https://cerniq.io/contact',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
