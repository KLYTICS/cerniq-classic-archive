import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from 'react';
import ReportViewer from './page';

const { useDocumentExportsMock, analyticsTrackMock, fetchMock } = vi.hoisted(
  () => ({
    useDocumentExportsMock: vi.fn(),
    analyticsTrackMock: vi.fn(),
    fetchMock: vi.fn(),
  }),
);

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'job-1' }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/hooks/useDocumentExports', () => ({
  useDocumentExports: useDocumentExportsMock,
}));

vi.mock('@/lib/analytics', () => ({
  analytics: {
    track: analyticsTrackMock,
  },
  EVENTS: {
    PORTAL_REPORT_VIEWED: 'Portal Report Viewed',
  },
}));

vi.mock('lucide-react', () => {
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

describe('ReportViewer', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    analyticsTrackMock.mockReset();
    useDocumentExportsMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('renders a completed report with both report and board-package downloads', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'job-1',
        institutionName: 'Cooperativa Test',
        status: 'COMPLETE',
        completedAt: '2026-04-08T12:00:00.000Z',
        createdAt: '2026-04-08T10:00:00.000Z',
        errorMessage: null,
      }),
    });

    const downloadMock = vi.fn();
    useDocumentExportsMock.mockReturnValue({
      readyManifests: [
        {
          id: 'alm_report:job-1:es',
          kind: 'alm_report',
          language: 'es',
          downloadUrl: '/api/portal/jobs/job-1/alm-report?lang=es',
        },
        {
          id: 'alco_pack:job-1:es',
          kind: 'alco_pack',
          language: 'es',
          downloadUrl: '/api/portal/jobs/job-1/alco-pack?lang=es',
        },
      ],
      error: null,
      downloadingId: null,
      download: downloadMock,
    });

    render(<ReportViewer />);

    expect(
      await screen.findByRole('button', { name: /download report/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /board package/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByTitle('ALM Report — Cooperativa Test'),
    ).toHaveAttribute('src', '/api/portal/jobs/job-1/alm-report?lang=es');

    fireEvent.click(screen.getByRole('button', { name: /download report/i }));
    fireEvent.click(screen.getByRole('button', { name: /board package/i }));

    expect(downloadMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ kind: 'alm_report' }),
    );
    expect(downloadMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: 'alco_pack' }),
    );
    expect(analyticsTrackMock).toHaveBeenCalledWith('Portal Report Viewed', {
      jobId: 'job-1',
      status: 'COMPLETE',
    });
  });

  it('shows processing UI while a report is still running', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'job-1',
        institutionName: 'Cooperativa Test',
        status: 'PROCESSING',
        completedAt: null,
        createdAt: '2026-04-08T10:00:00.000Z',
        errorMessage: null,
      }),
    });

    useDocumentExportsMock.mockReturnValue({
      readyManifests: [],
      error: null,
      downloadingId: null,
      download: vi.fn(),
    });

    render(<ReportViewer />);

    expect(await screen.findByText(/report in progress/i)).toBeInTheDocument();
    expect(screen.getAllByText(/status: processing/i)).toHaveLength(2);
  });

  it('shows an explicit export error banner and failed-state copy', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'job-1',
        institutionName: 'Cooperativa Test',
        status: 'FAILED',
        completedAt: null,
        createdAt: '2026-04-08T10:00:00.000Z',
        errorMessage: 'PDF generation failed',
      }),
    });

    useDocumentExportsMock.mockReturnValue({
      readyManifests: [],
      error: 'Unable to load exports (500)',
      downloadingId: null,
      download: vi.fn(),
    });

    render(<ReportViewer />);

    expect(
      await screen.findByText(/unable to load exports \(500\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /generation failed/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/pdf generation failed/i)).toBeInTheDocument();
  });

  it('shows not-found state when the portal job cannot be loaded', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => null,
    });

    useDocumentExportsMock.mockReturnValue({
      readyManifests: [],
      error: null,
      downloadingId: null,
      download: vi.fn(),
    });

    render(<ReportViewer />);

    await waitFor(() => {
      expect(screen.getByText(/report not found/i)).toBeInTheDocument();
    });
  });
});
