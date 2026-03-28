'use client';

import { useState } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { Download, FileSpreadsheet, FileJson, RefreshCw } from 'lucide-react';

type ExportFormat = 'json' | 'csv' | 'excel';

interface FormatConfig {
  format: ExportFormat;
  labelEn: string;
  labelEs: string;
  icon: React.ElementType;
  mime: string;
  ext: string;
}

const FORMATS: FormatConfig[] = [
  { format: 'json', labelEn: 'Export JSON', labelEs: 'Exportar JSON', icon: FileJson, mime: 'application/json', ext: 'json' },
  { format: 'csv', labelEn: 'Export CSV', labelEs: 'Exportar CSV', icon: Download, mime: 'text/csv', ext: 'csv' },
  { format: 'excel', labelEn: 'Export Excel', labelEs: 'Exportar Excel', icon: FileSpreadsheet, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
];

export function ExportButtons() {
  const { selectedId, institution } = useALM();
  const { locale } = useTranslation();
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);

  const isEs = locale === 'es';

  const handleExport = async (cfg: FormatConfig) => {
    if (!selectedId || downloading) return;
    setDownloading(cfg.format);
    try {
      const res = await fetch(`/api/alm/${selectedId}/export/${cfg.format}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('content-disposition');
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      a.download =
        filenameMatch?.[1] ||
        `alm-report-${institution?.name?.replace(/\s+/g, '_') || selectedId}.${cfg.ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail — the user will notice the file did not download
    } finally {
      setDownloading(null);
    }
  };

  if (!selectedId) return null;

  return (
    <div className="flex items-center gap-1.5">
      {FORMATS.map((cfg) => {
        const Icon = cfg.icon;
        const isActive = downloading === cfg.format;
        return (
          <button
            key={cfg.format}
            onClick={() => handleExport(cfg)}
            disabled={!!downloading}
            className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-medium text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:opacity-50"
            title={isEs ? cfg.labelEs : cfg.labelEn}
          >
            {isActive ? (
              <RefreshCw className="h-3 w-3 animate-spin text-amber-600" />
            ) : (
              <Icon className="h-3 w-3 text-amber-600" />
            )}
            <span className="hidden sm:inline">
              {isEs ? cfg.labelEs : cfg.labelEn}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ExportButtons;
