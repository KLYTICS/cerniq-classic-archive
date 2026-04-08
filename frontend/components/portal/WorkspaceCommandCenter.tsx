'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  FileText,
  KeyRound,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { getFeature, type SubscriptionTier } from '@/lib/features';
import type { PortalWorkflowState } from '@/lib/portal-overview';

interface ReportJobSummary {
  id: string;
  status: string;
}

interface WorkspaceCommandCenterProps {
  userName?: string;
  tier: SubscriptionTier;
  jobs: ReportJobSummary[];
  counts?: {
    awaitingData: number;
    validationFailed: number;
    processing: number;
    complete: number;
  };
  workflowState?: PortalWorkflowState;
  activation?: {
    activationScore: number;
    isStalled: boolean;
    stalledMilestoneLabel: string | null;
  } | null;
}

function formatTierLabel(tier: SubscriptionTier) {
  switch (tier) {
    case 'one_time':
      return 'Pilot';
    case 'monthly':
      return 'Monitoring';
    case 'annual':
      return 'Annual';
    case 'partner':
      return 'Partner';
    default:
      return 'Free';
  }
}

export default function WorkspaceCommandCenter({
  userName,
  tier,
  jobs,
  counts,
  workflowState,
  activation,
}: WorkspaceCommandCenterProps) {
  const completedReports =
    counts?.complete ??
    jobs.filter((job) => job.status === 'COMPLETE').length;
  const inFlightReports =
    counts?.processing ??
    jobs.filter((job) =>
      ['QUEUED', 'PROCESSING', 'GENERATING_PDF', 'UPLOADING', 'VALIDATING'].includes(job.status),
    ).length;
  const awaitingDataReports =
    ((counts?.awaitingData ?? 0) + (counts?.validationFailed ?? 0)) ||
    jobs.filter((job) =>
      ['AWAITING_DATA', 'VALIDATION_FAILED'].includes(job.status),
    ).length;
  const trendCharts = getFeature(tier, 'trendCharts');
  const apiAccess = getFeature(tier, 'apiAccess');
  const boardPresentation = getFeature(tier, 'boardPresentation');

  const checklist = [
    {
      label: 'Plan activated',
      detail: `Workspace is running on the ${formatTierLabel(tier)} tier.`,
      done: tier !== 'free',
    },
    {
      label: 'First reporting cycle opened',
      detail: 'Create an ALM job and assign an institution.',
      done: jobs.length > 0,
    },
    {
      label: 'Balance-sheet data submitted',
      detail: 'Upload the first CSV to move from setup into production.',
      done: jobs.some((job) => !['AWAITING_DATA', 'VALIDATION_FAILED'].includes(job.status)),
    },
    {
      label: 'Processing started',
      detail: 'CERNIQ validation, analytics, and report generation are underway.',
      done:
        inFlightReports > 0 ||
        completedReports > 0 ||
        workflowState === 'processing' ||
        workflowState === 'report_ready',
    },
    {
      label: 'Board-ready output delivered',
      detail: 'Generate a completed bilingual report for executive review.',
      done: completedReports > 0,
    },
  ];

  const completedChecklist = checklist.filter((item) => item.done).length;
  const readiness = Math.round((completedChecklist / checklist.length) * 100);

  const launchpad = [
    {
      title: 'Run report cycle',
      description: 'Open the secure upload flow and push the next institution through the pipeline.',
      href: '/portal/submit',
      icon: Upload,
      accent: 'Operations',
    },
    {
      title: 'Workspace admin',
      description: 'Manage seats, API keys, workspace settings, and operational preferences.',
      href: '/portal/settings',
      icon: Settings2,
      accent: 'Admin',
    },
    {
      title: 'Billing control',
      description: 'Review renewal timing, payment status, and plan changes from one place.',
      href: '/portal/billing',
      icon: CreditCard,
      accent: 'Revenue',
    },
    {
      title: 'Report archive',
      description: 'Review delivered outputs, export PDFs, and prep board or regulator follow-up.',
      href: '/portal',
      icon: FileText,
      accent: 'Delivery',
    },
  ];

  const productModules = [
    {
      title: 'Quarterly trend monitoring',
      description: 'Cross-period views and recurring reporting intelligence.',
      enabled: trendCharts.enabled,
      prompt: trendCharts.upgradePrompt || 'Available on monitoring tiers.',
      icon: BarChart3,
    },
    {
      title: 'API access',
      description: 'Programmatic integrations for downstream systems and client workflows.',
      enabled: apiAccess.enabled,
      prompt: apiAccess.upgradePrompt || 'Available on partner tier.',
      icon: KeyRound,
    },
    {
      title: 'Board delivery kit',
      description: 'Board presentation support for higher-touch executive reporting.',
      enabled: boardPresentation.enabled,
      prompt: boardPresentation.upgradePrompt || 'Available on annual tier.',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="cerniq-shell overflow-hidden p-3 sm:p-4 lg:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
          <div className="relative overflow-hidden rounded-[2rem] border border-[rgba(171,190,214,0.42)] bg-[linear-gradient(135deg,rgba(15,28,47,0.95),rgba(23,47,77,0.93)_56%,rgba(204,154,65,0.24)_100%)] p-6 text-white shadow-[0_30px_90px_rgba(19,33,53,0.26)] sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_25%),radial-gradient(circle_at_76%_18%,rgba(237,189,91,0.34),transparent_20%),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:auto,auto,4.8rem_4.8rem,4.8rem_4.8rem]" />
            <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,212,132,0.46),rgba(255,212,132,0))]" />

            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/74">
                <Sparkles className="h-3.5 w-3.5 text-[#ffd58c]" />
                Workspace operating system
              </span>

              <div className="mt-8 max-w-3xl space-y-4">
                <h1 className="font-display text-[clamp(2rem,4vw,4.1rem)] leading-[0.95] text-white">
                  Manage CERNIQ like a real SaaS account, not a one-off report handoff.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                  Welcome{userName ? `, ${userName}` : ''}. This workspace now centralizes upload operations,
                  billing, admin controls, and delivery status across your ALM reporting flow.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/portal/submit" className="inline-flex items-center gap-2 rounded-full bg-[#d39a2b] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(211,154,43,0.28)] transition hover:-translate-y-0.5 hover:bg-[#bb891f]">
                  Launch report cycle
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/portal/settings" className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-5 py-3 text-sm font-semibold text-white/88 transition hover:bg-white/12">
                  Open admin console
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="cerniq-panel p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Workspace readiness</p>
              <div className="mt-4 flex items-end gap-3">
                <span className="font-display text-5xl text-slate-950">{readiness}%</span>
                <span className="pb-2 text-sm text-slate-500">operational</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {completedChecklist} of {checklist.length} launch milestones completed across this account.
              </p>
              {activation?.isStalled && activation.stalledMilestoneLabel ? (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  Activation is stalled at: {activation.stalledMilestoneLabel}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="cerniq-panel p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Plan</p>
                <p className="mt-3 font-display text-3xl text-slate-950">{formatTierLabel(tier)}</p>
                <p className="mt-1 text-sm text-slate-500">Current commercial tier</p>
              </div>
              <div className="cerniq-panel p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">In flight</p>
                <p className="mt-3 font-display text-3xl text-slate-950">{inFlightReports}</p>
                <p className="mt-1 text-sm text-slate-500">Active reporting cycles</p>
              </div>
              <div className="cerniq-panel p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Delivered</p>
                <p className="mt-3 font-display text-3xl text-slate-950">{completedReports}</p>
                <p className="mt-1 text-sm text-slate-500">Reports shipped successfully</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.8fr)]">
        <div className="cerniq-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Launchpad</p>
              <h2 className="mt-2 font-display text-2xl text-slate-950">Core SaaS surfaces</h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
              {jobs.length} total cycles
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {launchpad.map(({ title, description, href, icon: Icon, accent }) => (
              <Link
                key={title}
                href={href}
                className="group rounded-[1.6rem] border border-slate-200/90 bg-white/92 p-5 transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_18px_36px_rgba(63,93,132,0.1)]"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{accent}</span>
                  <Icon className="h-5 w-5 text-cyan-700" />
                </div>
                <h3 className="mt-4 font-display text-xl text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0f5681]">
                  Open
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="cerniq-panel p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Activation checklist</p>
          <div className="mt-4 space-y-3">
            {checklist.map((item) => (
              <div key={item.label} className="rounded-[1.3rem] border border-slate-200/80 bg-white/86 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {awaitingDataReports > 0 && (
            <div className="mt-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">
              {awaitingDataReports} cycle{awaitingDataReports === 1 ? '' : 's'} waiting for CSV submission.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {productModules.map(({ title, description, enabled, prompt, icon: Icon }) => (
          <div key={title} className="cerniq-panel p-5">
            <div className="flex items-center justify-between gap-4">
              <Icon className={`h-5 w-5 ${enabled ? 'text-cyan-700' : 'text-slate-300'}`} />
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                {enabled ? 'Enabled' : 'Locked'}
              </span>
            </div>
            <h3 className="mt-4 font-display text-xl text-slate-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            <p className="mt-3 text-xs leading-5 text-slate-400">{enabled ? 'Included in your current commercial plan.' : prompt}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
