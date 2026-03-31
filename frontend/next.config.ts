import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const hasSentryReleaseAuth = Boolean(process.env.SENTRY_AUTH_TOKEN);

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
    if (!backendUrl) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${backendUrl}/auth/:path*`,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  ...(hasSentryReleaseAuth
    ? {
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      }
    : {}),
  silent: !process.env.CI,
  sourcemaps: {
    disable: !hasSentryReleaseAuth,
  },
  release: {
    name: hasSentryReleaseAuth ? process.env.SENTRY_RELEASE : '',
    create: hasSentryReleaseAuth,
    finalize: hasSentryReleaseAuth,
  },
});
