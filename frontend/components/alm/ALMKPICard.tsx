'use client';

interface ALMKPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'purple' | 'emerald' | 'amber' | 'red' | 'cyan';
}

const colorMap = {
  blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  red: 'from-red-500/20 to-red-600/10 border-red-500/30',
  cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
};

export default function ALMKPICard({ title, value, subtitle, trend, color = 'blue' }: ALMKPICardProps) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 ${colorMap[color]}`}>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-white mt-2">{value}</p>
      {subtitle && (
        <p className="text-sm text-slate-300 mt-1 flex items-center gap-1">
          {trend === 'up' && <span className="text-emerald-400">&#9650;</span>}
          {trend === 'down' && <span className="text-red-400">&#9660;</span>}
          {subtitle}
        </p>
      )}
    </div>
  );
}
