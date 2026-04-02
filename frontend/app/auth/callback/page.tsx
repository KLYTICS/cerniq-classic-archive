'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

function sanitizeReturnUrl(value: string | null) {
  if (!value || !value.startsWith('/')) {
    return '/dashboard';
  }

  return value;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const returnUrl = sanitizeReturnUrl(searchParams.get('returnUrl'));

    if (!isAuthenticated || !user?.id) {
      router.replace(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    if (returnUrl !== '/dashboard') {
      router.replace(returnUrl);
      return;
    }

    router.replace(onboardingComplete ? '/dashboard' : '/onboarding');
  }, [
    initialized,
    isAuthenticated,
    onboardingComplete,
    router,
    searchParams,
    user?.id,
  ]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071122] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:140px_140px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(96,165,250,0.18),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.08),transparent_26%)]" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-200" />
        <p className="text-sm text-slate-300">Completing sign in...</p>
      </div>
    </div>
  );
}
