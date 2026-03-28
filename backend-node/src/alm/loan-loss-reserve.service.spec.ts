import { LoanLossReserveService } from './loan-loss-reserve.service';

describe('LoanLossReserveService', () => {
  let service: LoanLossReserveService;

  beforeEach(() => {
    service = new LoanLossReserveService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('computes coverage ratio as ALLL / total loans', () => {
    const result = service.analyze({
      totalLoans: 10_000_000,
      currentALLL: 150_000,
      netChargeOffs: 50_000,
      delinquent30: 200_000,
      delinquent60: 100_000,
      delinquent90: 50_000,
      nonPerforming: 80_000,
    });

    // 150k / 10M = 1.5%
    expect(result.coverageRatio).toBeCloseTo(1.5, 2);
  });

  it('classifies adequacy based on peer coverage ratio', () => {
    const adequate = service.analyze({
      totalLoans: 10_000_000,
      currentALLL: 200_000,
      netChargeOffs: 30_000,
      delinquent30: 100_000,
      delinquent60: 50_000,
      delinquent90: 20_000,
      nonPerforming: 30_000,
      peerCoverageRatio: 1.5,
    });
    expect(adequate.adequacy).toBe('adequate'); // 2.0% > 1.5%

    const deficient = service.analyze({
      totalLoans: 10_000_000,
      currentALLL: 50_000,
      netChargeOffs: 30_000,
      delinquent30: 100_000,
      delinquent60: 50_000,
      delinquent90: 20_000,
      nonPerforming: 30_000,
      peerCoverageRatio: 1.5,
    });
    expect(deficient.adequacy).toBe('deficient'); // 0.5% < 1.5%*0.75
  });

  it('computes historical loss rate from net charge-offs', () => {
    const result = service.analyze({
      totalLoans: 5_000_000,
      currentALLL: 100_000,
      netChargeOffs: 25_000,
      delinquent30: 50_000,
      delinquent60: 25_000,
      delinquent90: 10_000,
      nonPerforming: 15_000,
    });

    // 25k / 5M = 0.5%
    expect(result.historicalLossRate).toBeCloseTo(0.5, 2);
  });

  it('applies Q-factors to adjust reserve requirement', () => {
    const result = service.analyze({
      totalLoans: 10_000_000,
      currentALLL: 150_000,
      netChargeOffs: 50_000,
      delinquent30: 400_000, // high delinquency triggers Q-factor
      delinquent60: 200_000,
      delinquent90: 100_000,
      nonPerforming: 300_000, // high NPL triggers Q-factor
    });

    expect(result.qFactors.length).toBe(5);
    const totalAdj = result.qFactors.reduce((s, q) => s + q.adjustment, 0);
    expect(totalAdj).toBeGreaterThan(0);
    expect(result.adjustedReserve).toBeGreaterThan(0);
  });

  it('computes gap between adjusted reserve and current ALLL', () => {
    const result = service.analyze({
      totalLoans: 10_000_000,
      currentALLL: 50_000,
      netChargeOffs: 100_000,
      delinquent30: 200_000,
      delinquent60: 100_000,
      delinquent90: 50_000,
      nonPerforming: 80_000,
    });

    // With high charge-offs and low ALLL, gap should be positive (shortfall)
    expect(result.gap).toBeGreaterThan(0);
  });

  it('generates bilingual interpretation', () => {
    const result = service.analyze({
      totalLoans: 10_000_000,
      currentALLL: 150_000,
      netChargeOffs: 50_000,
      delinquent30: 100_000,
      delinquent60: 50_000,
      delinquent90: 25_000,
      nonPerforming: 40_000,
    });

    expect(result.interpretation).toContain('Coverage ratio');
    expect(result.interpretationEs).toContain('Ratio cobertura');
  });
});
