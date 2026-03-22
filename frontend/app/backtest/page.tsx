'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function BacktestRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/alm/monte-carlo'); }, [router]);
  return null;
}
