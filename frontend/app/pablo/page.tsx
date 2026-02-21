'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PabloPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/demo?preset=banco-comunidad');
  }, [router]);
  return null;
}
