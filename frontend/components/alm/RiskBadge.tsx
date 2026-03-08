'use client';

import { useTranslation } from '@/lib/i18n';

interface RiskBadgeProps {
  status: 'compliant' | 'warning' | 'breach' | 'low' | 'moderate' | 'high' | 'critical';
  size?: 'sm' | 'md';
}

const badgeStyles: Record<string, string> = {
  compliant: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  moderate: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  breach: 'bg-red-500/20 text-red-300 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const labelKeys: Record<string, string> = {
  compliant: 'risk.compliant',
  low: 'risk.lowRisk',
  warning: 'risk.warning',
  moderate: 'risk.moderate',
  breach: 'risk.breach',
  high: 'risk.highRisk',
  critical: 'risk.critical',
};

export default function RiskBadge({ status, size = 'md' }: RiskBadgeProps) {
  const { t } = useTranslation();
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${badgeStyles[status] || badgeStyles.moderate}`}>
      {labelKeys[status] ? t(labelKeys[status]) : status}
    </span>
  );
}
