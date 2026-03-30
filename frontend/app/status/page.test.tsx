import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import StatusPage, {
  getStatusHeading,
  isEnvelope,
  isOperationalStatus,
} from './page';

const fetchMock = vi.fn();

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

describe('StatusPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows an operational banner when the backend reports ok', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          status: 'ok',
          timestamp: '2026-03-30T12:00:00.000Z',
          version: '2.0.0',
          services: {
            api: 'up',
            database: 'up',
            cache: 'degraded',
          },
        },
      }),
    });

    render(<StatusPage />);

    await waitFor(() => {
      expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Operational').length).toBeGreaterThan(0);
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('shows a degraded banner when the backend reports degraded', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          status: 'degraded',
          timestamp: '2026-03-30T12:00:00.000Z',
          version: '2.0.0',
          services: {
            api: 'up',
            database: 'down',
          },
        },
      }),
    });

    render(<StatusPage />);

    expect(await screen.findByText('Partial Degradation')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
  });

  it('handles raw health payloads, updates the elapsed time, and maps operational helpers', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-30T12:00:00.000Z'));
    fetchMock.mockResolvedValue({
      json: async () => ({
        status: 'healthy',
        timestamp: '2026-03-30T12:00:00.000Z',
        version: '2.1.0',
        services: { api: 'healthy' },
      }),
    });

    render(<StatusPage />);
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('All Systems Operational')).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-03-30T12:00:03.000Z'));
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(screen.getByText(/last checked .*s ago/i)).toBeInTheDocument();

    expect(isOperationalStatus('healthy')).toBe(true);
    expect(isEnvelope({ data: { status: 'ok' } })).toBe(true);
  });

  it('shows a major disruption banner when the backend reports down', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          status: 'down',
          timestamp: '2026-03-30T12:00:00.000Z',
          version: '2.0.0',
          services: {
            api: 'down',
          },
        },
      }),
    });

    render(<StatusPage />);

    expect(await screen.findByText('Major Service Disruption')).toBeInTheDocument();
    expect(screen.getAllByText('Down').length).toBeGreaterThan(0);
    expect(getStatusHeading('down')).toBe('Major Service Disruption');
  });

  it('treats envelopes without data as unreachable errors', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        success: true,
        data: null,
      }),
    });

    render(<StatusPage />);

    expect(await screen.findByText('Service Unreachable')).toBeInTheDocument();
  });

  it('shows an unreachable state when the health check fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    render(<StatusPage />);

    expect(await screen.findByText('Service Unreachable')).toBeInTheDocument();
    expect(screen.getByText('Unable to connect to the API')).toBeInTheDocument();
  });
});
