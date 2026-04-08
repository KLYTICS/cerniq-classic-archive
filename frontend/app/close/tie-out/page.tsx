import { redirect } from 'next/navigation';

/**
 * Legacy /close/tie-out route.
 *
 * Superseded by the unified /close/[cycleId]?tab=tieout workspace.
 */
export default function LegacyTieOutRoute() {
  redirect('/close');
}
