'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function VolatilityAnalyticsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/alm'); }, [router]);
  return null;
}
