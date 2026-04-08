import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlUploadModal } from './GlUploadModal';
import * as closeApi from '@/lib/close-api';

describe('GlUploadModal', () => {
  const orgId = 'org-1';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    render(
      <GlUploadModal
        open={false}
        orgId={orgId}
        lang="en"
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByText(/Upload GL CSV/i)).toBeNull();
  });

  it('shows the format explainer when open', () => {
    render(
      <GlUploadModal
        open={true}
        orgId={orgId}
        lang="en"
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText(/CSV format/i)).toBeInTheDocument();
    expect(screen.getByText(/account, period_year/i)).toBeInTheDocument();
  });

  it('upload button is disabled until a file is selected', () => {
    render(
      <GlUploadModal
        open={true}
        orgId={orgId}
        lang="en"
        onClose={() => undefined}
      />,
    );
    const uploadBtn = screen.getByRole('button', { name: /^Upload$/i }) as HTMLButtonElement;
    expect(uploadBtn.disabled).toBe(true);
  });

  it('rejects non-CSV files', () => {
    const { container } = render(
      <GlUploadModal
        open={true}
        orgId={orgId}
        lang="en"
        onClose={() => undefined}
      />,
    );
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['not csv'], 'data.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText(/Only \.csv files are accepted/i)).toBeInTheDocument();
  });

  it('shows the success summary after upload', async () => {
    const onUploaded = vi.fn();
    const uploadSpy = vi.spyOn(closeApi.closeApi, 'uploadGlCsv').mockResolvedValueOnce({
      inserted: 12,
      updated: 3,
      errored: 0,
      errors: [],
      rows: 15,
      source: 'upload:march.csv',
    });

    const { container } = render(
      <GlUploadModal
        open={true}
        orgId={orgId}
        lang="en"
        onClose={() => undefined}
        onUploaded={onUploaded}
      />,
    );
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['account,period_year,period_month,balance\n1010,2026,4,100'], 'march.csv', {
      type: 'text/csv',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }));
    // Wait for the async result panel
    await screen.findByText('15 of 15 rows processed');
    expect(uploadSpy).toHaveBeenCalledWith(orgId, file);
    expect(onUploaded).toHaveBeenCalled();
  });

  it('shows row errors in a collapsible list when present', async () => {
    vi.spyOn(closeApi.closeApi, 'uploadGlCsv').mockResolvedValueOnce({
      inserted: 1,
      updated: 0,
      errored: 2,
      errors: [
        { rowNumber: 3, message: 'Invalid balance: "oops"' },
        { rowNumber: 7, message: 'Missing account' },
      ],
      rows: 1,
      source: 'upload:bad.csv',
    });

    const { container } = render(
      <GlUploadModal
        open={true}
        orgId={orgId}
        lang="en"
        onClose={() => undefined}
      />,
    );
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'bad.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }));

    await screen.findByText(/Row errors/i);
    fireEvent.click(screen.getByText(/Row errors/i));
    expect(screen.getByText(/Invalid balance/)).toBeInTheDocument();
    expect(screen.getByText(/Missing account/)).toBeInTheDocument();
  });

  it('renders Spanish copy when lang="es"', () => {
    render(
      <GlUploadModal
        open={true}
        orgId={orgId}
        lang="es"
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText(/Cargar CSV del GL/i)).toBeInTheDocument();
    expect(screen.getByText(/Formato CSV/i)).toBeInTheDocument();
  });
});
