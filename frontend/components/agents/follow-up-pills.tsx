'use client';

import { useEffect, useState } from 'react';
import {
  Search,
  TrendingUp,
  Activity,
  Calendar,
  Users,
  BarChart3,
  FileText,
  HelpCircle,
  Shield,
  Download,
  CheckCircle,
  ClipboardList,
  Gauge,
  Layers,
  type LucideIcon,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────────── */

export interface FollowUpSuggestion {
  id: string;
  textEn: string;
  textEs: string;
  icon?: string;
  action?: string;
  context?: Record<string, unknown>;
}

export interface FollowUpPillsProps {
  suggestions: FollowUpSuggestion[];
  onSelect: (suggestion: FollowUpSuggestion) => void;
  locale?: 'en' | 'es';
  animate?: boolean;
}

/* ── Icon map ───────────────────────────────────────────────────────────────── */

const ICON_MAP: Record<string, LucideIcon> = {
  search: Search,
  trending_up: TrendingUp,
  activity: Activity,
  calendar: Calendar,
  users: Users,
  bar_chart: BarChart3,
  file_text: FileText,
  help: HelpCircle,
  shield: Shield,
  download: Download,
  check: CheckCircle,
  clipboard: ClipboardList,
  gauge: Gauge,
  layers: Layers,
};

function resolveIcon(iconName?: string): LucideIcon {
  if (!iconName) return HelpCircle;
  return ICON_MAP[iconName] ?? HelpCircle;
}

/* ── Default suggestion sets ────────────────────────────────────────────────── */

type SuggestionContext = 'risk_alert' | 'alm_summary' | 'compliance' | 'default';

const DEFAULT_SUGGESTIONS: Record<SuggestionContext, FollowUpSuggestion[]> = {
  risk_alert: [
    {
      id: 'ra_drill',
      textEn: 'Drill into details',
      textEs: 'Ver detalles',
      icon: 'search',
      action: 'drill_details',
    },
    {
      id: 'ra_trend',
      textEn: 'Show trend',
      textEs: 'Mostrar tendencia',
      icon: 'trending_up',
      action: 'show_trend',
    },
    {
      id: 'ra_stress',
      textEn: 'Run stress test',
      textEs: 'Ejecutar prueba de estres',
      icon: 'activity',
      action: 'run_stress_test',
    },
    {
      id: 'ra_review',
      textEn: 'Schedule review',
      textEs: 'Programar revision',
      icon: 'calendar',
      action: 'schedule_review',
    },
  ],
  alm_summary: [
    {
      id: 'as_peers',
      textEn: 'Compare to peers',
      textEs: 'Comparar con pares',
      icon: 'users',
      action: 'compare_peers',
    },
    {
      id: 'as_sensitivity',
      textEn: 'Show sensitivity',
      textEs: 'Mostrar sensibilidad',
      icon: 'bar_chart',
      action: 'show_sensitivity',
    },
    {
      id: 'as_report',
      textEn: 'Generate board report',
      textEs: 'Generar informe de junta',
      icon: 'file_text',
      action: 'generate_board_report',
    },
    {
      id: 'as_outliers',
      textEn: 'Ask about outliers',
      textEs: 'Preguntar sobre valores atipicos',
      icon: 'help',
      action: 'ask_outliers',
    },
  ],
  compliance: [
    {
      id: 'co_findings',
      textEn: 'View findings',
      textEs: 'Ver hallazgos',
      icon: 'search',
      action: 'view_findings',
    },
    {
      id: 'co_evidence',
      textEn: 'Download evidence',
      textEs: 'Descargar evidencia',
      icon: 'download',
      action: 'download_evidence',
    },
    {
      id: 'co_readiness',
      textEn: 'Check exam readiness',
      textEs: 'Verificar preparacion para examen',
      icon: 'check',
      action: 'check_exam_readiness',
    },
    {
      id: 'co_remediation',
      textEn: 'Show remediation plan',
      textEs: 'Mostrar plan de remediacion',
      icon: 'clipboard',
      action: 'show_remediation',
    },
  ],
  default: [
    {
      id: 'df_risks',
      textEn: 'What are the top risks?',
      textEs: 'Cuales son los principales riesgos?',
      icon: 'shield',
      action: 'top_risks',
    },
    {
      id: 'df_health',
      textEn: 'Show health score',
      textEs: 'Mostrar puntaje de salud',
      icon: 'gauge',
      action: 'health_score',
    },
    {
      id: 'df_analysis',
      textEn: 'Run full analysis',
      textEs: 'Ejecutar analisis completo',
      icon: 'layers',
      action: 'full_analysis',
    },
    {
      id: 'df_compare',
      textEn: 'Compare to last quarter',
      textEs: 'Comparar con trimestre anterior',
      icon: 'bar_chart',
      action: 'compare_quarter',
    },
  ],
};

/* ── Helper export ──────────────────────────────────────────────────────────── */

export function getDefaultSuggestions(
  context: SuggestionContext,
  _locale: 'en' | 'es',
): FollowUpSuggestion[] {
  return DEFAULT_SUGGESTIONS[context] ?? DEFAULT_SUGGESTIONS.default;
}

/* ── Component ──────────────────────────────────────────────────────────────── */

export default function FollowUpPills({
  suggestions,
  onSelect,
  locale = 'en',
  animate = true,
}: FollowUpPillsProps) {
  const [visiblePills, setVisiblePills] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!animate) {
      setVisiblePills(new Set(suggestions.map((_, i) => i)));
      return;
    }

    // Reset on new suggestions
    setVisiblePills(new Set());

    const timers: ReturnType<typeof setTimeout>[] = [];
    suggestions.forEach((_, i) => {
      const timer = setTimeout(() => {
        setVisiblePills((prev) => new Set([...prev, i]));
      }, i * 100);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [suggestions, animate]);

  if (!suggestions.length) return null;

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={locale === 'es' ? 'Sugerencias de seguimiento' : 'Follow-up suggestions'}
    >
      {suggestions.map((suggestion, index) => {
        const Icon = resolveIcon(suggestion.icon);
        const text = locale === 'es' ? suggestion.textEs : suggestion.textEn;
        const isVisible = visiblePills.has(index);

        return (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion)}
            data-testid={`pill-${suggestion.id}`}
            className={`flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all duration-200 hover:scale-[1.03] hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800 hover:shadow-md active:scale-[0.98] ${
              animate
                ? isVisible
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-2 opacity-0'
                : ''
            }`}
            style={animate ? { transitionDelay: `${index * 50}ms` } : undefined}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[35ch] truncate">{text}</span>
          </button>
        );
      })}
    </div>
  );
}
