'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function RiskParityRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/alm/hrp'); }, [router]);
  return null;
}
