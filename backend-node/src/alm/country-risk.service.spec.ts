import { CountryRiskService, CountryRiskParams } from './country-risk.service';

// ─── Helpers ────────────────────────────────────────────────────

function diversifiedParams(): CountryRiskParams {
  return {
    exposures: [
      { country: 'US', balance: 50_000_000, riskRating: 1 },
      { country: 'DE', balance: 30_000_000, riskRating: 1 },
      { country: 'BR', balance: 10_000_000, riskRating: 5 },
      { country: 'NG', balance: 5_000_000, riskRating: 8 },
      { country: 'AR', balance: 5_000_000, riskRating: 9 },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('CountryRiskService', () => {
  let service: CountryRiskService;

  beforeEach(() => {
    service = new CountryRiskService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Weighted risk score is balance-weighted average of ratings
  it('calculates balance-weighted risk score', () => {
    const result = service.assessCountryRisk(diversifiedParams());
    // Manual: (50*1 + 30*1 + 10*5 + 5*8 + 5*9) / 100 = (50+30+50+40+45)/100 = 2.15
    expect(result.weightedRiskScore).toBeCloseTo(2.15, 1);
  });

  // 2. Concentration shares sum to 1
  it('concentration shares sum to 1', () => {
    const result = service.assessCountryRisk(diversifiedParams());
    const total = result.concentrationByCountry.reduce(
      (sum, c) => sum + c.share,
      0,
    );
    expect(total).toBeCloseTo(1, 2);
  });

  // 3. High risk exposure counts only ratings >= 7
  it('high risk exposure only includes ratings >= 7', () => {
    const result = service.assessCountryRisk(diversifiedParams());
    // NG (5M, rating 8) + AR (5M, rating 9) = 10M
    expect(result.highRiskExposure).toBeCloseTo(10_000_000, 0);
  });

  // 4. Single-country portfolio has diversification index = 0
  it('single-country portfolio has zero diversification', () => {
    const result = service.assessCountryRisk({
      exposures: [{ country: 'US', balance: 100_000_000, riskRating: 1 }],
    });
    expect(result.diversificationIndex).toBe(0);
  });

  // 5. Equal-split portfolio has high diversification index
  it('equal-split portfolio has high diversification index', () => {
    const result = service.assessCountryRisk({
      exposures: [
        { country: 'US', balance: 25_000_000, riskRating: 1 },
        { country: 'DE', balance: 25_000_000, riskRating: 1 },
        { country: 'JP', balance: 25_000_000, riskRating: 2 },
        { country: 'GB', balance: 25_000_000, riskRating: 1 },
      ],
    });
    // HHI = 4 * 0.25^2 = 0.25, diversification = 0.75
    expect(result.diversificationIndex).toBeCloseTo(0.75, 2);
  });

  // 6. Empty exposures returns zeroed result
  it('handles empty exposures gracefully', () => {
    const result = service.assessCountryRisk({ exposures: [] });
    expect(result.weightedRiskScore).toBe(0);
    expect(result.highRiskExposure).toBe(0);
    expect(result.diversificationIndex).toBe(0);
  });

  // 7. Countries sorted by share descending
  it('concentration is sorted by share descending', () => {
    const result = service.assessCountryRisk(diversifiedParams());
    for (let i = 1; i < result.concentrationByCountry.length; i++) {
      expect(result.concentrationByCountry[i].share).toBeLessThanOrEqual(
        result.concentrationByCountry[i - 1].share,
      );
    }
  });
});
