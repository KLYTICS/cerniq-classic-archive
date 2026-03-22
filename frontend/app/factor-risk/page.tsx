'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function FactorRiskRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/alm/macro-factors'); }, [router]);
  return null;
}
