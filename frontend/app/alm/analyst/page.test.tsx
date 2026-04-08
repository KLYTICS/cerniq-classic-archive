import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalystPage from './page';

const fetchWithAppAuthMock = vi.fn();

vi.mock('@/components/alm/ALMProvider', () => ({
  useALM: () => ({ selectedId: 'inst-1' }),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ locale: 'en' }),
}));

vi.mock('@/lib/auth-fetch', () => ({
  fetchWithAppAuth: (...args: unknown[]) => fetchWithAppAuthMock(...args),
}));

describe('AnalystPage', () => {
  beforeEach(() => {
    fetchWithAppAuthMock.mockReset();
  });

  it('sends analyst chat requests through the shared authenticated fetch flow', async () => {
    fetchWithAppAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          message: { role: 'assistant', content: 'Here is the analysis.' },
        },
      }),
    });

    render(<AnalystPage />);

    fireEvent.change(
      screen.getByPlaceholderText(/ask about your balance sheet/i),
      { target: { value: 'Show me our concentration risks' } },
    );
    const sendButton = screen.getAllByRole('button').at(-1);
    expect(sendButton).toBeTruthy();
    fireEvent.click(sendButton!);

    await waitFor(() => {
      expect(fetchWithAppAuthMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchWithAppAuthMock.mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(url).toBe('/api/alm/inst-1/analyst/chat');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toContain('Show me our concentration risks');
    expect(
      screen.getByText(/here is the analysis/i),
    ).toBeInTheDocument();
  });
});
