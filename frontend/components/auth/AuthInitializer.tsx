'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';

export default function AuthInitializer() {
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  return null;
}
