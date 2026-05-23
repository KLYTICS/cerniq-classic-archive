import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Page from "../page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/portal/cpa-dashboard",
}));

// Mock i18n — return English locale
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "en",
    t: (k: string) => k,
    ta: (k: string) => k,
    setLocale: vi.fn(),
  }),
}));

// Mock RiskScoreBadge — render score visibly
vi.mock("@/components/wave03/risk-score-badge", () => ({
  RiskScoreBadge: ({ score }: { score: number }) => (
    <span data-testid="risk-badge">{score}</span>
  ),
}));

// Mock Modal — render children when open
vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    children: React.ReactNode;
    title: string;
  }) =>
    open ? (
      <div data-testid="modal" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

// Mock fetch for API calls
const mockFetch = vi.fn().mockResolvedValue({
  ok: false,
  json: async () => ({}),
});
global.fetch = mockFetch;

describe("CPA Dashboard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
  });

  it("renders the firm name in the header", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(
        screen.getByText("Rodriguez & Associates CPA"),
      ).toBeInTheDocument();
    });
  });

  it("shows the client institution table with institution names", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Clients")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Cooperativa de Ahorro Caguas"),
    ).toBeInTheDocument();
    expect(screen.getByText("ACACIA Federal Credit Union")).toBeInTheDocument();
    expect(
      screen.getByText("Oriental Federal Credit Union"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cooperativa de Bayamon")).toBeInTheDocument();
    expect(screen.getByText("Cooperativa Jesus Obrero")).toBeInTheDocument();
    expect(screen.getByText("Cooperativa de Arecibo")).toBeInTheDocument();
  });

  it("shows risk distribution metric cards (High/Medium/Low)", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("High Risk")).toBeInTheDocument();
    });
    expect(screen.getByText("Medium Risk")).toBeInTheDocument();
    expect(screen.getByText("Low Risk")).toBeInTheDocument();
    // Verify the counts: 1 high (<60), 2 medium (60-79), 3 low (80+)
    expect(screen.getByText("Score < 60")).toBeInTheDocument();
    expect(screen.getByText("Score 60-79")).toBeInTheDocument();
    expect(screen.getByText("Score 80+")).toBeInTheDocument();
  });

  it('shows the "Add Client" button', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText(/Add Client/)).toBeInTheDocument();
    });
  });

  it('shows the "Bulk Upload" button', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Bulk Upload")).toBeInTheDocument();
    });
  });

  it("renders compliance badges for clients", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Clients")).toBeInTheDocument();
    });
    // 3 compliant, 2 warning, 1 breach in demo data
    const compliantBadges = screen.getAllByText("Compliant");
    expect(compliantBadges.length).toBe(3);
    const warningBadges = screen.getAllByText("Warning");
    expect(warningBadges.length).toBe(2);
    expect(screen.getByText("Breach")).toBeInTheDocument();
  });

  it("shows the Assets Under Advisory (AUA) metric", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Assets Under Advisory")).toBeInTheDocument();
    });
    // $8,750,000,000 -> $8.8B
    expect(screen.getByText("$8.8B")).toBeInTheDocument();
  });

  it("shows the Upcoming Exams metric", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Upcoming Exams")).toBeInTheDocument();
    });
    expect(screen.getByText("Next 90 days")).toBeInTheDocument();
    // The value "3" appears in multiple places; verify it exists near the exams section
    const examsSection = screen.getByText("Upcoming Exams").closest("div");
    expect(examsSection).not.toBeNull();
    expect(examsSection!.textContent).toContain("3");
  });

  it("shows the Recent Alerts metric", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Recent Alerts")).toBeInTheDocument();
    });
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
  });

  // ─── Demo-mode transparency (Rule 1 — no silent zeros) ────────────────
  // Pair: backend commit 8577c89a converts CpaDashboardData.recentAlerts /
  // upcomingExams from silent `[]` to typed UNWIRED_INTEGRATION gaps; these
  // tests lock the visible counterpart so the auditor (a) sees a banner when
  // looking at demo data and (b) sees `—` instead of a fabricated number
  // when the backend tells us the upstream feed isn't wired.

  it("shows a demo-mode banner when the backend fetch fails (so demo data is never mistaken for real data)", async () => {
    // beforeEach already mocks fetch with ok:false; no override needed.
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByTestId("demo-mode-banner")).toBeInTheDocument();
    });
    expect(screen.getByText("Demo data")).toBeInTheDocument();
    // Existing demo content also still renders (banner augments — does not
    // remove — the demo affordance).
    expect(screen.getByText("Rodriguez & Associates CPA")).toBeInTheDocument();
  });

  it('renders "—" gap indicators when backend returns UNWIRED_INTEGRATION gaps for recentAlerts / upcomingExams', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        firm: {
          name: "Live CPA Firm Inc.",
          totalClients: 0,
          totalAUM: 0,
        },
        metrics: {
          totalAssetsUnderAdvisory: 0,
          upcomingExams: null,
          recentAlerts: null,
        },
        gaps: [
          {
            field: "dashboard.upcomingExams",
            reason: "UNWIRED_INTEGRATION",
            severity: "WARNING",
            action: "Upcoming-exams feed depends on the exam-prep agent.",
          },
          {
            field: "dashboard.recentAlerts",
            reason: "UNWIRED_INTEGRATION",
            severity: "WARNING",
            action: "Recent-alerts feed depends on the agent alert pipeline.",
          },
        ],
      }),
    });

    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Live CPA Firm Inc.")).toBeInTheDocument();
    });

    // No demo banner — both fetches were ok:true.
    expect(screen.queryByTestId("demo-mode-banner")).not.toBeInTheDocument();

    // Both metric cards rendered as em-dash gap indicators with tooltips.
    const examGap = screen.getByTestId("upcoming-exams-gap");
    expect(examGap).toHaveTextContent("—");
    expect(examGap).toHaveAttribute(
      "title",
      "Upcoming-exams feed depends on the exam-prep agent.",
    );
    const alertGap = screen.getByTestId("recent-alerts-gap");
    expect(alertGap).toHaveTextContent("—");
    expect(alertGap).toHaveAttribute(
      "title",
      "Recent-alerts feed depends on the agent alert pipeline.",
    );

    // The old hardcoded "3" / "7" demo values must NOT be visible — they
    // are the exact silent-zero values this commit eliminates.
    expect(
      screen.queryByText("3", { selector: "p.text-2xl" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("7", { selector: "p.text-2xl" }),
    ).not.toBeInTheDocument();
  });
});
