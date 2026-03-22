'use client';

import { Download } from 'lucide-react';
import { exportToCSV, exportKPIs } from '@/lib/csv-export';

interface ExportCSVButtonProps {
  data: Record<string, unknown>[] | Record<string, unknown>;
  filename: string;
  label?: string;
}

export default function ExportCSVButton({ data, filename, label }: ExportCSVButtonProps) {
  return (
    <button
      onClick={() => {
        if (Array.isArray(data)) {
          exportToCSV(data, filename);
        } else {
          exportKPIs(filename, data as Record<string, string | number>);
        }
      }}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 transition"
      title="Export to CSV"
    >
      <Download className="h-3 w-3" />
      {label || 'CSV'}
    </button>
  );
}
