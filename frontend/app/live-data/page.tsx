'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function LiveDataRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/alm/fed-futures'); }, [router]);
  return null;
}
