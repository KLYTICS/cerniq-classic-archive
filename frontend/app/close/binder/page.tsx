import { redirect } from 'next/navigation';

/**
 * Legacy /close/binder route.
 *
 * Superseded by the unified /close/[cycleId]?tab=binder workspace.
 */
export default function LegacyBinderRoute() {
  redirect('/close');
}
