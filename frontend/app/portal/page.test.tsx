import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from 'react';
import PortalHome from './page';

const searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ locale: 'en' }),
}));

vi.mock('@/lib/features', () => ({
  useFeature: () => ({ enabled: true }),
}));

vi.mock('./layout', () => ({
  usePortal: () => ({
    user: { id: 'user-1', name: 'Maria' },
    subscription: { tier: 'monthly', status: 'active' },
    access: { platformAccessAllowed: true, isDemo: false },
  }),
}));

vi.mock('@/lib/subscription', () => ({
  rememberPortalUser: vi.fn(),
}));

vi.mock('@/lib/access', () => ({
  isActiveDemo: () => false,
}));

vi.mock('@/components/portal/WorkspaceCommandCenter', () => ({
  default: () => <div>Workspace command center</div>,
}));

vi.mock('@/components/portal/ProgressTracker', () => ({
  default: () => <div>Progress tracker</div>,
}));

vi.mock('@/components/portal/ReportProgressWS', () => ({
  default: () => <div>Report progress</div>,
}));

vi.mock('@/components/exports/DocumentExportButtons', () => ({
  default: () => <div>Export buttons</div>,
}));

vi.mock('@/components/portal/DemoSeatBanner', () => ({
  default: () => <div>Demo banner</div>,
}));

const baseOverview: any = {
  access: {
    platformAccessAllowed: true,
    isMasterCeo: false,
    isPaid: true,
    isDemo: false,
    effectiveTier: 'monthly',
    effectiveStatus: 'active',
    effectivePeriodEnd: null,
    daysRemaining: null,
    reason: 'paid',
  },
  activation: null,
  jobs: [
    {
      id: 'job-awaiting',
      institutionId: 'inst-1',
      institutionName: 'Coop San Juan',
      status: 'AWAITING_DATA',
      analysisPeriod: null,
      previousJobId: null,
      submittedAt: null,
      processingStartedAt: null,
      completedAt: null,
      createdAt: '2026-04-08T10:00:00.000Z',
      reportUrl: null,
      reportUrlEn: null,
      reportLang: 'es',
      errorMessage: null,
      userId: 'user-1',
      triggeredBy: 'portal_submit_seed',
    },
  ],
  latestActionableJob: {
    id: 'job-awaiting',
    institutionId: 'inst-1',
    institutionName: 'Coop San Juan',
    status: 'AWAITING_DATA',
    analysisPeriod: null,
    previousJobId: null,
    submittedAt: null,
    processingStartedAt: null,
    completedAt: null,
    createdAt: '2026-04-08T10:00:00.000Z',
    reportUrl: null,
    reportUrlEn: null,
    reportLang: 'es',
    errorMessage: null,
    userId: 'user-1',
    triggeredBy: 'portal_submit_seed',
  },
  workflowState: 'needs_upload',
  counts: {
    total: 1,
    awaitingData: 1,
    validationFailed: 0,
    processing: 0,
    complete: 0,
  },
  demoSeat: { isDemo: false, seat: null },
  nextAction: {
    labelEn: 'Upload balance-sheet data',
    labelEs: 'Cargar datos del balance',
    href: '/portal/submit?jobId=job-awaiting',
    jobId: 'job-awaiting',
    explanationEn:
      'Your report cycle is waiting for the CSV needed to start validation and analysis.',
    explanationEs:
      'El ciclo de informe esta esperando el CSV para comenzar la validacion y el analisis.',
  },
  validationSummary: null,
};

const overviewState: any = {
  overview: {
    ...baseOverview,
  },
  loading: false,
  error: null as string | null,
  loadOverview: vi.fn(),
  setOverview: vi.fn(),
};

vi.mock('@/hooks/usePortalOverview', () => ({
  usePortalOverview: () => overviewState,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    FileText: Icon,
    Upload: Icon,
    Download: Icon,
    Eye: Icon,
    ArrowRight: Icon,
    Lock: Icon,
    CheckCircle: Icon,
    Calendar: Icon,
    ExternalLink: Icon,
    BarChart3: Icon,
    CreditCard: Icon,
    Settings2: Icon,
    ShieldCheck: Icon,
    Sparkles: Icon,
  };
});

describe('PortalHome', () => {
  beforeEach(() => {
    searchParams.delete('welcome');
    overviewState.overview = { ...baseOverview };
  });

  it('surfaces the actionable upload state from the shared overview', () => {
    render(<PortalHome />);

    expect(
      screen.getByText('Your next report cycle is ready for upload.'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /Upload balance-sheet data/i })[0],
    ).toHaveAttribute('href', '/portal/submit?jobId=job-awaiting');
  });

  it('shows a first-run activation CTA when no report cycle exists yet', () => {
    overviewState.overview = {
      ...overviewState.overview,
      jobs: [],
      latestActionableJob: null,
      workflowState: 'needs_report',
      counts: {
        total: 0,
        awaitingData: 0,
        validationFailed: 0,
        processing: 0,
        complete: 0,
      },
      nextAction: {
        labelEn: 'Create first report cycle',
        labelEs: 'Crear primer ciclo de informe',
        href: '/portal/submit?createCycle=1',
        jobId: null,
        explanationEn:
          'Create the first report cycle so the workspace can move directly into upload.',
        explanationEs:
          'Cree el primer ciclo de informe para que el portal avance directo a la carga.',
      },
    };

    render(<PortalHome />);

    expect(
      screen.getAllByRole('link', { name: /Create first report cycle/i })[0],
    ).toHaveAttribute('href', '/portal/submit?createCycle=1');
  });
});
