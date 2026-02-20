'use client';

import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface RiskScoreGaugeProps {
  score: number; // 0-100
  size?: number;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#eab308'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Low Risk';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Elevated';
  return 'High Risk';
}

export default function RiskScoreGauge({ score, size = 200 }: RiskScoreGaugeProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const data = [{ value: score, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={12}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: 'rgba(255,255,255,0.05)' }}
              dataKey="value"
              cornerRadius={6}
              angleAxisId={0}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: size * 0.08 }}>
          <span className="text-3xl font-bold text-white">{score}</span>
          <span className="text-xs text-slate-400 mt-1">/ 100</span>
        </div>
      </div>
      <span className="text-sm font-medium mt-1" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
