import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from "react";
import AdminPage from "./page";

const { getSummaryMock, runActionMock } = vi.hoisted(() => ({
  getSummaryMock: vi.fn(),
  runActionMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/api", () => ({
  apiClient: {
    getAdminControlTowerSummary: getSummaryMock,
    runAdminControlTowerAction: runActionMock,
  },
}));

vi.mock("lucide-react", () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Activity: Icon,
    AlertTriangle: Icon,
    ArrowRight: Icon,
    Bot: Icon,
    BrainCircuit: Icon,
    CheckCircle2: Icon,
    ClipboardCheck: Icon,
    ExternalLink: Icon,
    FileText: Icon,
    GitBranch: Icon,
    Landmark: Icon,
    RefreshCw: Icon,
    Server: Icon,
    Sparkles: Icon,
    Users: Icon,
    Workflow: Icon,
    Wrench: Icon,
  };
});

const summaryMock = {
  generatedAt: "2026-04-08T18:00:00.000Z",
  stats: {
    demoRequests: 12,
    institutions: 5,
    users: 9,
    prospects: 21,
    recentUsers: 3,
  },
  revenue: {
    activeSubscriptions: 4,
    totalSubscriptions: 6,
    mrr: 1196,
    arr: 14352,
  },
  pipeline: {
    counts: { awaitingData: 2, processing: 1, complete: 7, failed: 1 },
    recentJobs: [
      {
        id: "job-1",
        institutionName: "Coop One",
        status: "FAILED",
        createdAt: "2026-04-08T10:00:00.000Z",
        errorMessage: "Validation failed",
        user: { email: "ops@coop.one" },
      },
    ],
  },
  portal: {
    counts: {
      awaitingData: 2,
      validationFailed: 1,
      processing: 1,
      failed: 0,
    },
    stalledJobs: [
      {
        id: "job-portal",
        userId: "user-1",
        institutionName: "Coop Portal",
        status: "VALIDATION_FAILED",
        createdAt: "2026-04-08T09:00:00.000Z",
        errorMessage: "Missing column",
      },
    ],
  },
  exports: {
    completedJobs: 7,
    onDemandFallbackJobs: 1,
    readyManifestCount: 14,
    degradedCount: 1,
  },
  demoSeats: {
    active: 4,
    expired: 2,
    expiringSoon: 1,
    recent: [],
  },
  intelligence: {
    workspace: { id: "ws-1", name: "Cerniq Intelligence" },
    stats: {
      totalAccounts: 24,
      buyers: 15,
      competitors: 9,
      staleAccounts: 3,
      overdueActions: 2,
    },
    hotChanges: [],
    staleAccounts: [],
    actions: [],
    recentRuns: [],
    handoff: {
      summary: "Refresh buyers and review competitor updates.",
    },
  },
  sessionContinuity: {
    workspaceRoot: "/Users/money/Desktop/Cerniq",
    activeBranch: "codex/control-tower",
    latestStatusSummary: ["Public production verification is green."],
    latestStatusBlockers: ["GitHub Actions billing is still blocked."],
    lastAgentOutputTitle: "Build admin control tower",
    handoffUpdatedAt: "2026-04-08T18:00:00.000Z",
    latestStatusUpdatedAt: "2026-04-08T18:00:00.000Z",
    activeModes: ["ralph"],
    stateFiles: ["hud-state.json"],
    metrics: {
      turnCount: 8,
      lastTurnAt: "2026-04-08T18:00:00.000Z",
    },
    recommendedCommands: ["cd backend-node", "npm test"],
  },
  featureBridge: [
    {
      id: "portal",
      label: "Portal & report cycles",
      status: "warning",
      detail: "2 awaiting, 1 validation failed, 1 processing",
      href: "/admin/pipeline",
    },
  ],
  nextActions: [
    {
      id: "refresh-intelligence",
      title: "Refresh stale intelligence accounts",
      domain: "intelligence",
      severity: "medium",
      action: "refresh_intelligence",
    },
  ],
  safeActions: [
    {
      action: "refresh_intelligence",
      label: "Refresh stale intelligence",
      description: "Run a stale-only intelligence refresh pass.",
    },
  ],
};

describe("AdminPage", () => {
  beforeEach(() => {
    sessionStorage.setItem("cerniq_admin_key", "test-key");
    getSummaryMock.mockReset();
    runActionMock.mockReset();
    getSummaryMock.mockResolvedValue(summaryMock);
    runActionMock.mockResolvedValue({
      action: "refresh_intelligence",
      status: "success",
      summary: "Refreshed stale intelligence accounts",
      data: {},
    });
  });

  it("renders the control tower summary and blocker/action panels", async () => {
    render(<AdminPage />);

    expect(
      await screen.findByText(
        "Run CERNIQ like one connected operating system.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Refresh stale intelligence accounts"),
    ).toBeInTheDocument();
    expect(screen.getByText("Portal & report cycles")).toBeInTheDocument();
    expect(screen.getByText("codex/control-tower")).toBeInTheDocument();
  });

  it("runs a safe action and refreshes the control tower", async () => {
    render(<AdminPage />);

    const actionButton = await screen.findByRole("button", {
      name: /Refresh stale intelligence/i,
    });
    fireEvent.click(actionButton);

    await waitFor(() => {
      expect(runActionMock).toHaveBeenCalledWith({
        action: "refresh_intelligence",
        userId: undefined,
        jobId: undefined,
      });
    });
    expect(
      await screen.findByText("Refreshed stale intelligence accounts"),
    ).toBeInTheDocument();
  });
});
