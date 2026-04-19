'use client';

import { useQuery } from '@tanstack/react-query';
import { listAlerts } from '@/lib/agents-api';
import type { AgentAlertRecord } from '@/types/agents';

/**
 * Header-mountable badge showing unacknowledged alert count.
 *
 * CRITICAL → red. HIGH → amber. Others → hidden unless opened.
 * Suitable for slotting into the existing top-level layout nav bar.
 */

interface AlertBadgeProps {
  institutionId: string | null;
}

export function AlertBadge({ institutionId }: AlertBadgeProps) {
  const { data: alerts } = useQuery({
    queryKey: ['agents', 'alerts', 'open'],
    queryFn: () =>
      listAlerts(institutionId!, { ack: false }),
    enabled: !!institutionId,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  if (!alerts || alerts.length === 0) return null;

  const criticals = alerts.filter(
    (a: AgentAlertRecord) => a.severity === 'CRITICAL' && a.status === 'OPEN',
  ).length;
  const highs = alerts.filter(
    (a: AgentAlertRecord) => a.severity === 'HIGH' && a.status === 'OPEN',
  ).length;
  const total = criticals + highs;

  if (total === 0) return null;

  const tone =
    criticals > 0
      ? 'bg-rose-500 text-white'
      : 'bg-amber-400 text-amber-900';

  return (
    <a
      href="/agents/alerts"
      className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${tone}`}
      aria-label={`${total} unacknowledged alert${total !== 1 ? 's' : ''}`}
    >
      {total}
    </a>
  );
}
