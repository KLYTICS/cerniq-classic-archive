'use client';

interface ALMKPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'purple' | 'emerald' | 'amber' | 'red' | 'cyan';
}

const colorMap = {
  blue: 'bg-sky-50 border-sky-100',
  purple: 'bg-cyan-50 border-cyan-100',
  emerald: 'bg-emerald-50 border-emerald-100',
  amber: 'bg-amber-50 border-amber-100',
  red: 'bg-rose-50 border-rose-100',
  cyan: 'bg-cyan-50 border-cyan-100',
};

export default function ALMKPICard({ title, value, subtitle, trend, color = 'blue' }: ALMKPICardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      {subtitle && (
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
          {trend === 'up' && <span className="text-emerald-600">&#9650;</span>}
          {trend === 'down' && <span className="text-rose-600">&#9660;</span>}
          {subtitle}
        </p>
      )}
    </div>
  );
}
