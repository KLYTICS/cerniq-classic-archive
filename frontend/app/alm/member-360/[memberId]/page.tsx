'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Sparkles } from 'lucide-react';

import { AlmPage, type AlmPageContext } from '@/components/alm/AlmPage';
import { useReportDataGaps, type DataGap } from '@/hooks/useReportDataGaps';
import { DataGapBanner } from '@/components/ui/cerniq';
import { MetricStrip, type MetricStripItem } from '@/components/density/MetricStrip';
import { DataTable, type DataTableColumn } from '@/components/density/DataTable';
import type { Locale } from '@/lib/i18n';
import { StageBadge } from '../lifecycle-stage';

/**
 * Member 360 profile — single-socio financial + regulatory view.
 *
 * Stacked-sections layout (not tabs — this codebase has no shared tab
 * primitive; see admin/intelligence/[accountId]/page.tsx for the same
 * precedent). institutionId comes from ALMProvider via <AlmPage>; memberId
 * comes from the dynamic route segment.
 */

type LifecycleStage =
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'AT_RISK'
  | 'DELINQUENT'
  | 'WORKOUT'
  | 'CHARGED_OFF'
  | 'CHURNED';

type AccountCategory = 'SHARE' | 'DEPOSIT' | 'LOAN';
type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
type ActionPriority = 'high' | 'medium' | 'low';

interface MemberAccountRow {
  id: string;
  productType: string;
  category: AccountCategory;
  balance: number;
  interestRate: number | null;
  delinquencyDays: number | null;
  maturityDate: string | null;
  cossecClassification: string | null;
}

interface LifecycleEvent {
  id: string;
  eventType: string;
  severity: EventSeverity;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface NextBestAction {
  id: string;
  priority: ActionPriority;
  titleEn: string;
  titleEs: string;
  accountId?: string;
}

interface MemberProfile {
  member: {
    id: string;
    memberNumber: string;
    fullName: string;
    memberSince: string;
  };
  financialOverview: {
    totalDeposits: number;
    totalShares: number;
    activeLoanBalance: number;
    loanToDepositRatio: number | null;
  };
  regulatoryHealth: {
    worstCossecClassification: string | null;
    ceclStage: number | null;
    riskScore: number | null;
    lifecycleStage: LifecycleStage;
    lifecycleReasons: string[];
  };
  accounts: MemberAccountRow[];
  lifecycleTimeline: LifecycleEvent[];
  nextBestActions: NextBestAction[];
  gaps: DataGap[];
}

function validateMemberProfile(raw: unknown): MemberProfile {
  const r = raw as Partial<MemberProfile> | null;
  if (
    !r ||
    typeof r !== 'object' ||
    !r.member ||
    !r.financialOverview ||
    !r.regulatoryHealth ||
    !Array.isArray(r.accounts)
  ) {
    throw new Error('Malformed member profile response');
  }
  return r as MemberProfile;
}

const PRIORITY_TONE: Record<ActionPriority, string> = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-slate-200 bg-slate-50 text-slate-600',
};

const SEVERITY_TONE: Record<EventSeverity, string> = {
  INFO: 'bg-sky-400',
  WARNING: 'bg-amber-500',
  CRITICAL: 'bg-rose-500',
};

const CATEGORY_LABEL: Record<AccountCategory, { en: string; es: string }> = {
  SHARE: { en: 'Share', es: 'Aportación' },
  DEPOSIT: { en: 'Deposit', es: 'Depósito' },
  LOAN: { en: 'Loan', es: 'Préstamo' },
};

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === 'es' ? 'es-PR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MemberProfilePage() {
  const params = useParams<{ memberId: string }>();
  const memberId = String(params.memberId);

  return (
    <AlmPage<MemberProfile>
      slug="member-360"
      iconTint="cyan"
      pathSuffix={`/${memberId}`}
      validate={validateMemberProfile}
      deps={[memberId]}
    >
      {(data, ctx) => <MemberProfileContent data={data} ctx={ctx} />}
    </AlmPage>
  );
}

function MemberProfileContent({ data, ctx }: { data: MemberProfile; ctx: AlmPageContext }) {
  const { locale } = ctx;
  const searchParams = useSearchParams();
  const institutionIdParam = searchParams.get('id') ?? '';
  const { gaps, criticalCount, warningCount } = useReportDataGaps(data.gaps);

  const financialMetrics: MetricStripItem[] = [
    { key: 'totalDeposits', value: data.financialOverview.totalDeposits, unit: 'USD' },
    { key: 'totalShares', value: data.financialOverview.totalShares, unit: 'USD' },
    { key: 'activeLoanBalance', value: data.financialOverview.activeLoanBalance, unit: 'USD' },
    {
      key: 'loanToDepositRatio',
      value: data.financialOverview.loanToDepositRatio,
      unit: 'ratio',
    },
    { key: 'riskScore', value: data.regulatoryHealth.riskScore, unit: 'count' },
    { key: 'ceclStage', value: data.regulatoryHealth.ceclStage, unit: 'count' },
  ];

  const accountColumns: DataTableColumn<MemberAccountRow>[] = [
    {
      id: 'productType',
      headerKey: 'productType',
      kind: 'custom',
      accessor: () => null,
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800">{r.productType}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            {locale === 'es' ? CATEGORY_LABEL[r.category].es : CATEGORY_LABEL[r.category].en}
          </span>
        </div>
      ),
    },
    { id: 'balance', headerKey: 'balance', kind: 'number', accessor: (r) => r.balance, unit: 'USD' },
    { id: 'interestRate', headerKey: 'interestRate', kind: 'number', accessor: (r) => r.interestRate, unit: '%' },
    {
      id: 'delinquencyDays',
      headerKey: 'delinquencyDays',
      kind: 'number',
      accessor: (r) => r.delinquencyDays,
      unit: 'days',
    },
    {
      id: 'cossecClassification',
      headerKey: 'worstCossecClassification',
      kind: 'text',
      accessor: (r) => r.cossecClassification,
    },
    {
      id: 'openedMaturity',
      header: locale === 'es' ? 'Apertura / Vencimiento' : 'Opened / Maturity',
      kind: 'custom',
      accessor: () => null,
      align: 'text-right',
      render: (r) => (
        <span className="text-xs text-slate-500">
          {r.maturityDate ? formatDate(r.maturityDate, locale) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Link
        href={`/alm/member-360${institutionIdParam ? `?id=${institutionIdParam}` : ''}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {locale === 'es' ? 'Volver al directorio' : 'Back to directory'}
      </Link>

      {/* Header card — identity + lifecycle stage */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] text-slate-400">{data.member.memberNumber}</p>
            <h2 className="text-lg font-semibold text-slate-900">{data.member.fullName}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              {locale === 'es' ? 'Socio desde' : 'Member since'}{' '}
              {formatDate(data.member.memberSince, locale)}
            </p>
          </div>
          <div className="text-right">
            <StageBadge stage={data.regulatoryHealth.lifecycleStage} locale={locale} />
            {data.regulatoryHealth.worstCossecClassification ? (
              <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                COSSEC: {data.regulatoryHealth.worstCossecClassification}
              </p>
            ) : null}
          </div>
        </div>
        {data.regulatoryHealth.lifecycleReasons.length > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
            {data.regulatoryHealth.lifecycleReasons.map((reason, i) => (
              <li key={i} className="text-xs text-slate-500">
                • {reason}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {gaps.length > 0 ? (
        <DataGapBanner gaps={gaps} criticalCount={criticalCount} warningCount={warningCount} />
      ) : null}

      {/* Financial + regulatory KPI strip */}
      <MetricStrip items={financialMetrics} locale={locale} />

      {/* Next best actions */}
      {data.nextBestActions.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {locale === 'es' ? 'Acciones Recomendadas' : 'Recommended Actions'}
          </h3>
          <div className="mt-3 space-y-2">
            {data.nextBestActions.map((action) => (
              <div
                key={action.id}
                className={`rounded-lg border px-3 py-2 text-xs ${PRIORITY_TONE[action.priority]}`}
              >
                {locale === 'es' ? action.titleEs : action.titleEn}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Accounts */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {locale === 'es' ? 'Cuentas' : 'Accounts'}
        </h3>
        <DataTable
          rows={data.accounts}
          columns={accountColumns}
          locale={locale}
          rowKey={(r) => r.id}
          emptyText={locale === 'es' ? 'Sin cuentas' : 'No accounts'}
        />
      </section>

      {/* Lifecycle timeline */}
      {data.lifecycleTimeline.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {locale === 'es' ? 'Historial del Ciclo de Vida' : 'Lifecycle Timeline'}
          </h3>
          <ol className="mt-3 space-y-3">
            {data.lifecycleTimeline.map((event) => (
              <li key={event.id} className="flex items-start gap-2.5">
                <span
                  className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${SEVERITY_TONE[event.severity]}`}
                  aria-hidden
                />
                <div>
                  <p className="text-xs font-medium text-slate-700">{event.eventType}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(event.createdAt, locale)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
