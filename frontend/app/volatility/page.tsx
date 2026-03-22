'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function VolatilityRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/alm'); }, [router]);
  return null;
}
