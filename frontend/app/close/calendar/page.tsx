import { redirect } from 'next/navigation';

/**
 * Legacy /close/calendar route.
 *
 * Superseded by the unified /close/[cycleId]?tab=calendar workspace.
 * Users landing here from old links get bounced to the cockpit so they
 * can pick an active cycle and land on the calendar tab of that cycle.
 */
export default function LegacyCalendarRoute() {
  redirect('/close');
}
