import {
  CurrencyRiskService,
  CurrencyRiskParams,
} from './currency-risk.service';

// ─── Helpers ────────────────────────────────────────────────────

function baseParams(): CurrencyRiskParams {
  return {
    positions: [
      { currency: 'EUR', balance: 920_000, hedgedPct: 0.5 },
      { currency: 'GBP', balance: 790_000, hedgedPct: 0.8 },
      { currency: 'JPY', balance: 150_000_000, hedgedPct: 0.3 },
    ],
    baseCurrency: 'USD',
    exchangeRates: { EUR: 0.92, GBP: 0.79, JPY: 150 },
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('CurrencyRiskService', () => {
  let service: CurrencyRiskService;

  beforeEach(() => {
    service = new CurrencyRiskService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Total exposure reflects all non-base currencies
  it('calculates total exposure from all non-base positions', () => {
    const result = service.assessCurrencyRisk(baseParams());
    // EUR: 920k / 0.92 = 1M, GBP: 790k / 0.79 = 1M, JPY: 150M / 150 = 1M
    expect(result.totalExposure).toBeCloseTo(3_000_000, 0);
  });

  // 2. Net unhedged considers hedge ratios
  it('net unhedged exposure accounts for hedge percentages', () => {
    const result = service.assessCurrencyRisk(baseParams());
    // EUR unhedged: 1M * 0.5 = 500k, GBP: 1M * 0.2 = 200k, JPY: 1M * 0.7 = 700k
    expect(result.netUnhedgedExposure).toBeCloseTo(1_400_000, 0);
  });

  // 3. Potential loss is 1% of net unhedged
  it('potential loss at 1% equals 1% of net unhedged exposure', () => {
    const result = service.assessCurrencyRisk(baseParams());
    expect(result.potentialLoss1Pct).toBeCloseTo(
      result.netUnhedgedExposure * 0.01,
      2,
    );
  });

  // 4. Base-currency positions are excluded from risk
  it('ignores positions denominated in the base currency', () => {
    const params = baseParams();
    params.positions.push({ currency: 'USD', balance: 5_000_000, hedgedPct: 0 });
    const result = service.assessCurrencyRisk(params);
    // USD position should NOT appear in byCurrency
    expect(result.byCurrency.find((c) => c.currency === 'USD')).toBeUndefined();
  });

  // 5. Fully hedged portfolio has zero unhedged exposure
  it('fully hedged positions produce zero unhedged exposure', () => {
    const params = baseParams();
    params.positions = params.positions.map((p) => ({
      ...p,
      hedgedPct: 1.0,
    }));
    const result = service.assessCurrencyRisk(params);
    expect(result.netUnhedgedExposure).toBe(0);
    expect(result.potentialLoss1Pct).toBe(0);
  });

  // 6. Risk contribution sums to 1
  it('risk contributions across currencies sum to 1', () => {
    const result = service.assessCurrencyRisk(baseParams());
    const total = result.byCurrency.reduce(
      (sum, c) => sum + c.riskContribution,
      0,
    );
    expect(total).toBeCloseTo(1, 2);
  });

  // 7. Missing exchange rate skips the position
  it('skips positions with missing exchange rates', () => {
    const params = baseParams();
    params.positions.push({ currency: 'CHF', balance: 500_000, hedgedPct: 0 });
    // No CHF rate in exchangeRates
    const result = service.assessCurrencyRisk(params);
    expect(result.byCurrency.find((c) => c.currency === 'CHF')).toBeUndefined();
  });

  // 8. Recommendation warns when mostly unhedged
  it('recommendation warns when hedge ratio is low', () => {
    const params = baseParams();
    params.positions = params.positions.map((p) => ({
      ...p,
      hedgedPct: 0.05,
    }));
    const result = service.assessCurrencyRisk(params);
    expect(result.recommendation).toMatch(/Elevated|unhedged|hedging/i);
  });
});
