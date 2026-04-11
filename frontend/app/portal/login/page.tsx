import { redirect } from 'next/navigation';

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

  const nextUrl = new URLSearchParams({
    mode: 'magic-link',
    returnUrl: '/dashboard',
  });

  if (billing === 'success') {
    nextUrl.set('billing', 'success');
  }

  redirect(`/login?${nextUrl.toString()}`);
}
