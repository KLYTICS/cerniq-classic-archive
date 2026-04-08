import { redirect } from 'next/navigation';

/**
 * Legacy /close/flux route.
 *
 * Superseded by the unified /close/[cycleId]?tab=flux workspace.
 */
export default function LegacyFluxRoute() {
  redirect('/close');
}
