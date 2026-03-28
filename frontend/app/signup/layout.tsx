import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account — CERNIQ',
  description: 'Get started with CERNIQ — bilingual ALM reporting for cooperativas and credit unions.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
