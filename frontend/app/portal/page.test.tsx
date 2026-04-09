import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from "react";
import type { PortalOverview } from "@/lib/portal-overview";
import PortalHome from "./page";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ locale: "en" }),
}));

vi.mock("@/lib/features", () => ({
  useFeature: () => ({ enabled: true }),
}));

vi.mock("./layout", () => ({
  usePortal: () => ({
    user: { id: "user-1", name: "Maria" },
    subscription: { tier: "monthly", status: "active" },
    access: { platformAccessAllowed: true, isDemo: false },
  }),
}));

vi.mock("@/lib/subscription", () => ({
  rememberPortalUser: vi.fn(),
}));

vi.mock("@/lib/access", () => ({
  isActiveDemo: () => false,
}));

vi.mock("@/components/portal/WorkspaceCommandCenter", () => ({
  default: () => <div>Workspace command center</div>,
}));

vi.mock("@/components/portal/ProgressTracker", () => ({
  default: () => <div>Progress tracker</div>,
}));

vi.mock("@/components/portal/ReportProgressWS", () => ({
  default: () => <div>Report progress</div>,
}));

vi.mock("@/components/exports/DocumentExportButtons", () => ({
  default: () => <div>Export buttons</div>,
}));

vi.mock("@/components/portal/DemoSeatBanner", () => ({
  default: () => <div>Demo banner</div>,
}));

const overviewState = {
  overview: {
    jobs: [
      {
        id: "job-awaiting",
        institutionName: "Coop San Juan",
        status: "AWAITING_DATA",
        analysisPeriod: null,
        previousJobId: null,
        submittedAt: null,
        processingStartedAt: null,
        completedAt: null,
        createdAt: "2026-04-08T10:00:00.000Z",
        reportUrl: null,
        reportUrlEn: null,
        reportLang: "es",
        errorMessage: null,
        userId: "user-1",
        triggeredBy: "portal_submit_seed",
      },
    ],
    latestActionableJob: {
      id: "job-awaiting",
      institutionName: "Coop San Juan",
      status: "AWAITING_DATA",
      analysisPeriod: null,
      previousJobId: null,
      submittedAt: null,
      processingStartedAt: null,
      completedAt: null,
      createdAt: "2026-04-08T10:00:00.000Z",
      reportUrl: null,
      reportUrlEn: null,
      reportLang: "es",
      errorMessage: null,
      userId: "user-1",
      triggeredBy: "portal_submit_seed",
    },
    workflowState: "needs_upload",
    counts: {
      total: 1,
      awaitingData: 1,
      validationFailed: 0,
      processing: 0,
      complete: 0,
    },
    demoSeat: { isDemo: false, seat: null },
    nextAction: {
      labelEn: "Upload balance-sheet data",
      labelEs: "Cargar datos del balance",
      href: "/portal/submit?jobId=job-awaiting",
      jobId: "job-awaiting",
      explanationEn:
        "Your report cycle is waiting for the CSV needed to start validation and analysis.",
      explanationEs:
        "El ciclo de informe esta esperando el CSV para comenzar la validacion y el analisis.",
    },
    validationSummary: null,
  } satisfies PortalOverview,
  loading: false,
  error: null as string | null,
  loadOverview: vi.fn(),
  setOverview: vi.fn(),
};

vi.mock("@/hooks/usePortalOverview", () => ({
  usePortalOverview: () => overviewState,
}));

vi.mock("lucide-react", () => {
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
    AlertTriangle: Icon,
    BarChart3: Icon,
    CreditCard: Icon,
    Settings2: Icon,
    ShieldCheck: Icon,
    Sparkles: Icon,
  };
});

describe("PortalHome", () => {
  beforeEach(() => {
    searchParams.delete("welcome");
  });

  it("surfaces the actionable upload state from the shared overview", () => {
    render(<PortalHome />);

    expect(
      screen.getByText("Your next report cycle is ready for upload."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Upload balance-sheet data/i })[0],
    ).toHaveAttribute("href", "/portal/submit?jobId=job-awaiting");
  });

  it("surfaces degraded export delivery when a completed job is missing part of the package", () => {
    overviewState.overview = {
      ...overviewState.overview,
      jobs: [
        {
          id: "job-complete",
          institutionId: "inst-1",
          institutionName: "Coop Export",
          status: "COMPLETE",
          analysisPeriod: "Q1-2026",
          previousJobId: null,
          submittedAt: "2026-04-08T10:00:00.000Z",
          processingStartedAt: "2026-04-08T10:05:00.000Z",
          completedAt: "2026-04-08T10:10:00.000Z",
          createdAt: "2026-04-08T09:00:00.000Z",
          reportUrl: null,
          reportUrlEn: null,
          reportLang: "es",
          errorMessage: null,
          userId: "user-1",
          triggeredBy: "portal_submit",
          exportSummary: {
            manifestPath: "/api/portal/jobs/job-complete/exports",
            status: "partial",
            readyCount: 2,
            totalCount: 4,
            readyReportLanguages: ["es", "en"],
            missingReportLanguages: [],
            readyBoardPackLanguages: [],
            missingBoardPackLanguages: ["es", "en"],
          },
        },
      ],
      latestActionableJob: {
        id: "job-complete",
        institutionId: "inst-1",
        institutionName: "Coop Export",
        status: "COMPLETE",
        analysisPeriod: "Q1-2026",
        previousJobId: null,
        submittedAt: "2026-04-08T10:00:00.000Z",
        processingStartedAt: "2026-04-08T10:05:00.000Z",
        completedAt: "2026-04-08T10:10:00.000Z",
        createdAt: "2026-04-08T09:00:00.000Z",
        reportUrl: null,
        reportUrlEn: null,
        reportLang: "es",
        errorMessage: null,
        userId: "user-1",
        triggeredBy: "portal_submit",
        exportSummary: {
          manifestPath: "/api/portal/jobs/job-complete/exports",
          status: "partial",
          readyCount: 2,
          totalCount: 4,
          readyReportLanguages: ["es", "en"],
          missingReportLanguages: [],
          readyBoardPackLanguages: [],
          missingBoardPackLanguages: ["es", "en"],
        },
      },
      workflowState: "export_degraded",
      counts: {
        total: 1,
        awaitingData: 0,
        validationFailed: 0,
        processing: 0,
        complete: 1,
      },
      nextAction: {
        labelEn: "Review export availability",
        labelEs: "Revisar disponibilidad de exportacion",
        href: "/portal/reports/job-complete",
        jobId: "job-complete",
        explanationEn:
          "The report job finished, but one or more export files still need recovery before delivery is fully complete.",
        explanationEs:
          "El trabajo del informe termino, pero uno o mas archivos de exportacion todavia necesitan recuperarse antes de completar la entrega.",
      },
      validationSummary: null,
    } satisfies PortalOverview;

    render(<PortalHome />);

    expect(
      screen.getByRole("heading", { name: /export package needs attention/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 of 4 export artifacts are ready/i),
    ).toBeInTheDocument();
  });
});
