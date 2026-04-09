import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from "react";
import ReportViewer from "./page";

const { useDocumentExportsMock, analyticsTrackMock, fetchMock } = vi.hoisted(
  () => ({
    useDocumentExportsMock: vi.fn(),
    analyticsTrackMock: vi.fn(),
    fetchMock: vi.fn(),
  }),
);

const reportProgressState = vi.hoisted(() => ({
  lastProps: null as null | {
    jobId: string;
    institutionName: string;
    initialStatus?: string;
    onComplete?: () => void | Promise<void>;
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "job-1" }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/hooks/useDocumentExports", () => ({
  useDocumentExports: useDocumentExportsMock,
}));

vi.mock("@/components/portal/ReportProgressWS", () => ({
  default: (props: {
    jobId: string;
    institutionName: string;
    initialStatus?: string;
    onComplete?: () => void | Promise<void>;
  }) => {
    reportProgressState.lastProps = props;
    return (
      <button onClick={() => void props.onComplete?.()}>
        Progress stream {props.jobId} ({props.initialStatus})
      </button>
    );
  },
}));

vi.mock("@/lib/analytics", () => ({
  analytics: {
    track: analyticsTrackMock,
  },
  EVENTS: {
    PORTAL_REPORT_VIEWED: "Portal Report Viewed",
  },
}));

vi.mock("lucide-react", () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    FileText: Icon,
    Download: Icon,
    ArrowLeft: Icon,
    Clock: Icon,
    AlertTriangle: Icon,
    Globe: Icon,
  };
});

describe("ReportViewer", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    analyticsTrackMock.mockReset();
    useDocumentExportsMock.mockReset();
    reportProgressState.lastProps = null;
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders a completed report with both report and board-package downloads", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "job-1",
        institutionId: "inst-1",
        institutionName: "Cooperativa Test",
        status: "COMPLETE",
        analysisPeriod: "Q1-2026",
        submittedAt: "2026-04-08T10:15:00.000Z",
        processingStartedAt: "2026-04-08T10:20:00.000Z",
        completedAt: "2026-04-08T12:00:00.000Z",
        createdAt: "2026-04-08T10:00:00.000Z",
        reportLang: "es",
        triggeredBy: "portal_cycle_bootstrap",
        reportUrl: null,
        reportUrlEn: null,
        errorMessage: null,
      }),
    });

    const downloadMock = vi.fn();
    const refreshMock = vi.fn();
    useDocumentExportsMock.mockReturnValue({
      manifests: [
        {
          id: "alm_report:job-1:es",
          kind: "alm_report",
          language: "es",
          status: "ready",
          filename: "alm-report-cooperativa-test-es.pdf",
          generatedAt: "2026-04-08T12:00:00.000Z",
          expiresAt: null,
          downloadUrl: "/api/portal/jobs/job-1/alm-report?lang=es",
        },
        {
          id: "alco_pack:job-1:es",
          kind: "alco_pack",
          language: "es",
          status: "ready",
          filename: "board-package-cooperativa-test-es.pdf",
          generatedAt: "2026-04-08T12:01:00.000Z",
          expiresAt: null,
          downloadUrl: "/api/portal/jobs/job-1/alco-pack?lang=es",
        },
      ],
      readyManifests: [
        {
          id: "alm_report:job-1:es",
          kind: "alm_report",
          language: "es",
          status: "ready",
          filename: "alm-report-cooperativa-test-es.pdf",
          generatedAt: "2026-04-08T12:00:00.000Z",
          expiresAt: null,
          downloadUrl: "/api/portal/jobs/job-1/alm-report?lang=es",
        },
        {
          id: "alco_pack:job-1:es",
          kind: "alco_pack",
          language: "es",
          status: "ready",
          filename: "board-package-cooperativa-test-es.pdf",
          generatedAt: "2026-04-08T12:01:00.000Z",
          expiresAt: null,
          downloadUrl: "/api/portal/jobs/job-1/alco-pack?lang=es",
        },
      ],
      error: null,
      loading: false,
      downloadingId: null,
      download: downloadMock,
      refresh: refreshMock,
    });

    render(<ReportViewer />);

    expect(
      await screen.findByRole("button", { name: /download report/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Q1-2026")).toBeInTheDocument();
    expect(screen.getByText(/2 ready artifacts/i)).toBeInTheDocument();
    expect(
      screen.getByText(/triggered by portal_cycle_bootstrap/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /board package/i }),
    ).toBeInTheDocument();
    expect(screen.getByTitle("ALM Report — Cooperativa Test")).toHaveAttribute(
      "src",
      "/api/portal/jobs/job-1/alm-report?lang=es",
    );

    fireEvent.click(screen.getByRole("button", { name: /download report/i }));
    fireEvent.click(screen.getByRole("button", { name: /board package/i }));

    expect(downloadMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ kind: "alm_report" }),
    );
    expect(downloadMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: "alco_pack" }),
    );
    expect(analyticsTrackMock).toHaveBeenCalledWith("Portal Report Viewed", {
      jobId: "job-1",
      status: "COMPLETE",
    });
  });

  it("shows processing UI while a report is still running", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "job-1",
        institutionName: "Cooperativa Test",
        status: "PROCESSING",
        analysisPeriod: "Q1-2026",
        submittedAt: "2026-04-08T10:00:00.000Z",
        completedAt: null,
        createdAt: "2026-04-08T10:00:00.000Z",
        errorMessage: null,
      }),
    });

    useDocumentExportsMock.mockReturnValue({
      manifests: [],
      readyManifests: [],
      error: null,
      loading: false,
      downloadingId: null,
      download: vi.fn(),
      refresh: vi.fn(),
    });

    render(<ReportViewer />);

    expect(
      await screen.findByRole("button", {
        name: /progress stream job-1 \(processing\)/i,
      }),
    ).toBeInTheDocument();
    expect(reportProgressState.lastProps).toMatchObject({
      jobId: "job-1",
      institutionName: "Cooperativa Test",
      initialStatus: "PROCESSING",
    });
    expect(screen.getByText(/submitted:/i)).toBeInTheDocument();
  });

  it("reloads the report and refreshes exports when processing completes", async () => {
    const refreshSpy = vi.fn();
    let exportsReady = false;

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "job-1",
          institutionId: "inst-1",
          institutionName: "Cooperativa Test",
          status: "PROCESSING",
          analysisPeriod: "Q1-2026",
          submittedAt: "2026-04-08T10:00:00.000Z",
          completedAt: null,
          createdAt: "2026-04-08T10:00:00.000Z",
          errorMessage: null,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "job-1",
          institutionId: "inst-1",
          institutionName: "Cooperativa Test",
          status: "COMPLETE",
          analysisPeriod: "Q1-2026",
          submittedAt: "2026-04-08T10:15:00.000Z",
          processingStartedAt: "2026-04-08T10:20:00.000Z",
          completedAt: "2026-04-08T12:00:00.000Z",
          createdAt: "2026-04-08T10:00:00.000Z",
          reportLang: "es",
          triggeredBy: "portal_cycle_bootstrap",
          reportUrl: null,
          reportUrlEn: null,
          errorMessage: null,
          exportSummary: {
            manifestPath: "/api/portal/jobs/job-1/exports",
            status: "ready",
            readyCount: 2,
            totalCount: 4,
            readyReportLanguages: ["es", "en"],
            missingReportLanguages: [],
            readyBoardPackLanguages: [],
            missingBoardPackLanguages: ["es", "en"],
          },
        }),
      } as Response);

    useDocumentExportsMock.mockImplementation(() => {
      const readyManifests = exportsReady
        ? [
            {
              id: "alm_report:job-1:es",
              kind: "alm_report",
              language: "es",
              status: "ready",
              filename: "alm-report-cooperativa-test-es.pdf",
              generatedAt: "2026-04-08T12:00:00.000Z",
              expiresAt: null,
              downloadUrl: "/api/portal/jobs/job-1/alm-report?lang=es",
            },
          ]
        : [];

      return {
        manifests: readyManifests,
        readyManifests,
        error: null,
        loading: false,
        downloadingId: null,
        download: vi.fn(),
        refresh: vi.fn(async () => {
          exportsReady = true;
          refreshSpy();
        }),
      };
    });

    render(<ReportViewer />);

    await screen.findByRole("button", {
      name: /progress stream job-1 \(processing\)/i,
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /progress stream job-1 \(processing\)/i,
      }),
    );

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(
        screen.getByRole("button", { name: /download report/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows an explicit export error banner and failed-state copy", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "job-1",
        institutionName: "Cooperativa Test",
        status: "FAILED",
        retryCount: 2,
        completedAt: null,
        createdAt: "2026-04-08T10:00:00.000Z",
        errorMessage: "PDF generation failed",
      }),
    });

    useDocumentExportsMock.mockReturnValue({
      manifests: [],
      readyManifests: [],
      error: "Unable to load exports (500)",
      loading: false,
      downloadingId: null,
      download: vi.fn(),
      refresh: vi.fn(),
    });

    render(<ReportViewer />);

    expect(
      await screen.findByText(/unable to load exports \(500\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /generation failed/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/pdf generation failed/i)).toBeInTheDocument();
  });

  it("shows awaiting-data metadata and deep-links back to the selected job upload flow", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "job-1",
        institutionName: "Cooperativa Test",
        status: "AWAITING_DATA",
        analysisPeriod: "Q2-2026",
        previousJobId: "job-previous",
        completedAt: null,
        createdAt: "2026-04-08T10:00:00.000Z",
        errorMessage: null,
      }),
    });

    useDocumentExportsMock.mockReturnValue({
      manifests: [],
      readyManifests: [],
      error: null,
      loading: false,
      downloadingId: null,
      download: vi.fn(),
      refresh: vi.fn(),
    });

    render(<ReportViewer />);

    expect(
      await screen.findByRole("heading", { name: /awaiting data/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /submit data/i })).toHaveAttribute(
      "href",
      "/portal/submit?jobId=job-1",
    );
    expect(
      screen.getByText(/previous cycle: job-previous/i),
    ).toBeInTheDocument();
  });

  it("shows a degraded export state when the job is complete but the manifest package is partial", async () => {
    const refreshMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "job-1",
        institutionId: "inst-1",
        institutionName: "Cooperativa Test",
        status: "COMPLETE",
        analysisPeriod: "Q1-2026",
        submittedAt: "2026-04-08T10:15:00.000Z",
        processingStartedAt: "2026-04-08T10:20:00.000Z",
        completedAt: "2026-04-08T12:00:00.000Z",
        createdAt: "2026-04-08T10:00:00.000Z",
        reportLang: "es",
        triggeredBy: "portal_cycle_bootstrap",
        reportUrl: null,
        reportUrlEn: null,
        errorMessage: null,
        exportSummary: {
          manifestPath: "/api/portal/jobs/job-1/exports",
          status: "partial",
          readyCount: 1,
          totalCount: 4,
          readyReportLanguages: ["es"],
          missingReportLanguages: ["en"],
          readyBoardPackLanguages: [],
          missingBoardPackLanguages: ["es", "en"],
        },
      }),
    });

    useDocumentExportsMock.mockReturnValue({
      manifests: [
        {
          id: "alco_pack:job-1:es",
          kind: "alco_pack",
          language: "es",
          status: "ready",
          filename: "board-package-cooperativa-test-es.pdf",
          generatedAt: "2026-04-08T12:01:00.000Z",
          expiresAt: null,
          downloadUrl: "/api/portal/jobs/job-1/alco-pack?lang=es",
        },
      ],
      readyManifests: [
        {
          id: "alco_pack:job-1:es",
          kind: "alco_pack",
          language: "es",
          status: "ready",
          filename: "board-package-cooperativa-test-es.pdf",
          generatedAt: "2026-04-08T12:01:00.000Z",
          expiresAt: null,
          downloadUrl: "/api/portal/jobs/job-1/alco-pack?lang=es",
        },
      ],
      error: null,
      loading: false,
      downloadingId: null,
      download: vi.fn(),
      refresh: refreshMock,
    });

    render(<ReportViewer />);

    expect(
      await screen.findByRole("heading", {
        name: /export package still needs recovery/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 of 4 export artifacts are currently ready/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /retry export check/i }),
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("shows not-found state when the portal job cannot be loaded", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => null,
    });

    useDocumentExportsMock.mockReturnValue({
      manifests: [],
      readyManifests: [],
      error: null,
      loading: false,
      downloadingId: null,
      download: vi.fn(),
      refresh: vi.fn(),
    });

    render(<ReportViewer />);

    await waitFor(() => {
      expect(screen.getByText(/report not found/i)).toBeInTheDocument();
    });
  });
});
