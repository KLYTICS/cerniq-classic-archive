import { NextResponse, type NextRequest } from 'next/server';

function isAdminEnabled(): boolean {
  const raw = (
    process.env.ENABLE_ADMIN ||
    process.env.NEXT_PUBLIC_ENABLE_ADMIN ||
    ''
  )
    .trim()
    .toLowerCase();

  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') {
    return true;
  }

  return process.env.NODE_ENV !== 'production';
}

export function proxy(request: NextRequest) {
  if (!isAdminEnabled()) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
