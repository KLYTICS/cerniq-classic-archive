import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode, SVGProps } from 'react';
import OASPage from './page';

const { getOASPortfolioMock, useALMMock } = vi.hoisted(() => ({
  getOASPortfolioMock: vi.fn(),
  useALMMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    getOASPortfolio: getOASPortfolioMock,
  },
}));

vi.mock('@/components/alm/ALMProvider', () => ({
  useALM: useALMMock,
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ locale: 'en' }),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    AlertTriangle: Icon,
    Layers: Icon,
    Building2: Icon,
  };
});

vi.mock('recharts', () => {
  const Wrap = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    BarChart: Wrap,
    Bar: Wrap,
    XAxis: Wrap,
    YAxis: Wrap,
    CartesianGrid: Wrap,
    Tooltip: Wrap,
    Legend: Wrap,
    ResponsiveContainer: Wrap,
  };
});

describe('OASPage', () => {
  beforeEach(() => {
    getOASPortfolioMock.mockReset();
    useALMMock.mockReset();
  });

  it('shows a coherent institution-required state when no institution is selected', () => {
    useALMMock.mockReturnValue({ selectedId: '' });

    render(<OASPage />);

    expect(screen.getByText(/institution required/i)).toBeInTheDocument();
    expect(screen.getByText(/open oas analysis/i)).toBeInTheDocument();
  });

  it('falls back to demo data when the API call fails', async () => {
    useALMMock.mockReturnValue({ selectedId: 'inst-1' });
    getOASPortfolioMock.mockRejectedValue(new Error('network down'));

    render(<OASPage />);

    expect(
      await screen.findByText(/oAS analysis — option-adjusted spreads/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/fnma 30y mbs pool/i),
    ).toBeInTheDocument();
  });
});
