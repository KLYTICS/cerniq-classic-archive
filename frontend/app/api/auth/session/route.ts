import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getConfiguredApiOrigin } from '@/lib/api-base';
import { unwrapApiData } from '@/lib/api-response';

type SessionUser = {
  id: string;
  email: string;
  name?: string;
  access?: unknown;
};

export async function GET() {
  const apiOrigin = getConfiguredApiOrigin();
  if (!apiOrigin) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const headerBag = await headers();
    const cookie = headerBag.get('cookie') || '';
    const response = await fetch(`${apiOrigin}/api/auth/profile`, {
      headers: cookie ? { cookie } : {},
      cache: 'no-store',
    });

    if (response.status === 401) {
      return NextResponse.json({ authenticated: false });
    }

    if (!response.ok) {
      return NextResponse.json({ authenticated: false });
    }

    const user = unwrapApiData<SessionUser | null>(
      await response.json().catch(() => null),
    );

    if (!user?.id || !user.email) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
