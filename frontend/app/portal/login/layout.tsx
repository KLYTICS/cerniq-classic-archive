import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard Login — CERNIQ',
  description: 'Sign in to your CERNIQ dashboard with a secure magic link.',
};

export default function PortalLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
