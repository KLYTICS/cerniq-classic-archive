import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security — CERNIQ ALM Intelligence',
  description: 'Enterprise security controls at CERNIQ: AES-256 encryption, TLS 1.3, role-based access, audit logging, SOC 2-compliant infrastructure, and vulnerability management.',
  alternates: { canonical: '/security' },
  openGraph: {
    title: 'Security at CERNIQ',
    description: 'AES-256 at rest, TLS 1.3 in transit, RBAC with 12 roles, 7-year audit logs, SOC 2-compliant hosting.',
    url: 'https://cerniq.io/security',
  },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
