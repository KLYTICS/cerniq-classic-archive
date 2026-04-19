import { redirect } from 'next/navigation';
import { buildLoginUrlForReturnUrl } from '@/lib/auth-redirect';

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const billing =
    typeof resolvedSearchParams.billing === 'string'
      ? resolvedSearchParams.billing
      : undefined;

  redirect(
    buildLoginUrlForReturnUrl('/dashboard', {
      billingSuccess: billing === 'success',
      forceMagicLink: true,
    }),
  );
}
