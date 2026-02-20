import { AlmService } from './alm.service';
import { BalanceSheetDto, LCRRequestDto } from './alm.dto';

describe('AlmService', () => {
    let service: AlmService;

    beforeEach(() => {
        service = new AlmService();
    });

    // ─── Demo Balance Sheet ─────────────────────────────────────

    describe('getDemoBalanceSheet', () => {
        it('should return a valid $500M balance sheet', () => {
            const bs = service.getDemoBalanceSheet();

            const totalAssets = bs.assets.reduce((s, a) => s + a.amount, 0);
            const totalLiabilities = bs.liabilities.reduce((s, l) => s + l.amount, 0);

            expect(totalAssets).toBe(500_000_000);
            expect(totalLiabilities).toBe(450_000_000);
            expect(bs.equity).toBe(50_000_000);
            expect(totalAssets - totalLiabilities).toBe(bs.equity);
            expect(bs.assets).toHaveLength(5);
            expect(bs.liabilities).toHaveLength(5);
        });
    });

    // ─── Duration Gap ───────────────────────────────────────────

    describe('durationGapAnalysis', () => {
        it('should compute duration gap for the demo balance sheet', () => {
            const bs = service.getDemoBalanceSheet();
            const result = service.durationGapAnalysis(bs);

            expect(result.totalAssets).toBe(500_000_000);
            expect(result.totalLiabilities).toBe(450_000_000);

            // Asset duration should be positive and reasonable (1–8 years)
            expect(result.assetDuration).toBeGreaterThan(1);
            expect(result.assetDuration).toBeLessThan(8);

            // Liability duration shorter (lots of short-term deposits)
            expect(result.liabilityDuration).toBeGreaterThan(0);
            expect(result.liabilityDuration).toBeLessThan(result.assetDuration);

            // Duration gap should be positive (asset-sensitive)
            expect(result.durationGap).toBeGreaterThan(0);

            // We expect a gap roughly in the 1–4 year range for this balance sheet
            expect(result.durationGap).toBeGreaterThan(0.5);
            expect(result.durationGap).toBeLessThan(5);

            // All instrument details should be populated
            expect(result.assetDetails).toHaveLength(5);
            expect(result.liabilityDetails).toHaveLength(5);

            // Interpretation should mention asset-sensitive
            expect(result.interpretation).toContain('asset-sensitive');
        });

        it('should return zero duration gap for a perfectly matched book', () => {
            const bs: BalanceSheetDto = {
                assets: [
                    { name: 'Loan', amount: 100, rate: 0.05, maturityYears: 5, isFloating: false },
                ],
                liabilities: [
                    { name: 'Deposit', amount: 100, rate: 0.05, maturityYears: 5, isFloating: false },
                ],
                equity: 0,
            };
            const result = service.durationGapAnalysis(bs);
            // Same duration, leverage ratio = 1, gap = DA - 1*DL = 0
            expect(result.durationGap).toBeCloseTo(0, 4);
        });

        it('should handle floating-rate instruments with short duration', () => {
            const bs: BalanceSheetDto = {
                assets: [
                    { name: 'Floater', amount: 100, rate: 0.05, maturityYears: 5, isFloating: true, repricingFrequencyMonths: 3 },
                ],
                liabilities: [
                    { name: 'Fixed', amount: 80, rate: 0.04, maturityYears: 10, isFloating: false },
                ],
                equity: 20,
            };
            const result = service.durationGapAnalysis(bs);

            // Floating asset duration ≈ 0.25 years (3 months)
            expect(result.assetDuration).toBeCloseTo(0.25, 2);

            // Fixed liability with 10yr maturity, 4% coupon → ~8.4 years
            expect(result.liabilityDuration).toBeGreaterThan(7);

            // Duration gap should be negative (liability-sensitive)
            expect(result.durationGap).toBeLessThan(0);
        });

        it('should compute correct Macaulay duration for a zero-coupon bond', () => {
            const bs: BalanceSheetDto = {
                assets: [
                    { name: 'Zero-coupon', amount: 100, rate: 0.0, maturityYears: 10, isFloating: false },
                ],
                liabilities: [
                    { name: 'Stub', amount: 1, rate: 0.01, maturityYears: 1, isFloating: false },
                ],
                equity: 99,
            };
            const result = service.durationGapAnalysis(bs);

            // Zero-coupon bond Macaulay duration = maturity
            expect(result.assetDetails[0].macaulayDuration).toBe(10);
        });
    });

    // ─── NII Simulation ─────────────────────────────────────────

    describe('niiSimulation', () => {
        it('should compute base NII correctly for the demo balance sheet', () => {
            const bs = service.getDemoBalanceSheet();
            const result = service.niiSimulation(bs);

            // Manual calculation:
            // Asset income:
            //   CRE: 150M × 5.5% = $8.25M
            //   C&I: 120M × 7.5% = $9.0M
            //   Treasury: 80M × 4.2% = $3.36M
            //   Auto: 90M × 6.8% = $6.12M
            //   Fed Funds: 60M × 5.3% = $3.18M
            //   Total = $29.91M
            expect(result.assetIncome).toBeCloseTo(29_910_000, -3);

            // Liability cost:
            //   Deposits: 200M × 1.5% = $3.0M
            //   CDs: 80M × 4.0% = $3.2M
            //   FHLB: 70M × 4.8% = $3.36M
            //   MMA: 60M × 3.5% = $2.1M
            //   Sub debt: 40M × 5.5% = $2.2M
            //   Total = $13.86M
            expect(result.liabilityCost).toBeCloseTo(13_860_000, -3);

            // NII = 29.91M - 13.86M = $16.05M
            expect(result.baseNII).toBeCloseTo(16_050_000, -3);
        });

        it('should show floating instruments repricing under rate shocks', () => {
            const bs = service.getDemoBalanceSheet();
            const result = service.niiSimulation(bs, [-200, 0, 200]);

            // At 0 bps shock, NII should equal base
            const baseScenario = result.scenarios.find((s) => s.shockBps === 0)!;
            expect(baseScenario.change).toBeCloseTo(0, 0);

            // +200 bps: floating assets reprice up, floating liabilities reprice up
            // Floating assets: C&I (120M) + Fed Funds (60M) = 180M gain 2% = +$3.6M
            // Floating liabilities: FHLB (70M) + MMA (60M) = 130M cost 2% = -$2.6M
            // Net change ≈ +$1M (asset-sensitive from floating mismatch)
            const upScenario = result.scenarios.find((s) => s.shockBps === 200)!;
            expect(upScenario.change).toBeGreaterThan(0);
            expect(upScenario.nii).toBeGreaterThan(result.baseNII);

            // -200 bps: opposite direction
            const downScenario = result.scenarios.find((s) => s.shockBps === -200)!;
            expect(downScenario.change).toBeLessThan(0);
        });

        it('should not change NII for an all-fixed balance sheet', () => {
            const bs: BalanceSheetDto = {
                assets: [
                    { name: 'Fixed loan', amount: 100_000, rate: 0.06, maturityYears: 5, isFloating: false },
                ],
                liabilities: [
                    { name: 'Fixed deposit', amount: 80_000, rate: 0.03, maturityYears: 3, isFloating: false },
                ],
                equity: 20_000,
            };
            const result = service.niiSimulation(bs, [-300, 0, 300]);

            // All fixed → no repricing → all scenarios identical to base
            for (const scenario of result.scenarios) {
                expect(scenario.change).toBeCloseTo(0, 2);
            }
        });

        it('should classify risk levels correctly', () => {
            const bs = service.getDemoBalanceSheet();
            const result = service.niiSimulation(bs);

            // 0 bps shock → low risk
            const zeroShock = result.scenarios.find((s) => s.shockBps === 0)!;
            expect(zeroShock.riskLevel).toBe('low');

            // Extreme shocks should have higher risk
            const extremeShocks = result.scenarios.filter(
                (s) => Math.abs(s.shockBps) >= 200,
            );
            for (const scenario of extremeShocks) {
                expect(['medium', 'high', 'critical']).toContain(scenario.riskLevel);
            }
        });
    });

    // ─── EVE Analysis ───────────────────────────────────────────

    describe('eveAnalysis', () => {
        it('should compute base EVE for the demo balance sheet', () => {
            const bs = service.getDemoBalanceSheet();
            const result = service.eveAnalysis(bs);

            // Base EVE should be positive (assets > liabilities in PV terms)
            expect(result.baseEVE).toBeGreaterThan(0);

            // Should have scenarios for each default shock
            expect(result.scenarios).toHaveLength(9); // default shocks
        });

        it('should show EVE declining when rates rise (asset-sensitive bank)', () => {
            const bs = service.getDemoBalanceSheet();
            const result = service.eveAnalysis(bs);

            const baseScenario = result.scenarios.find((s) => s.shockBps === 0)!;
            const upScenario = result.scenarios.find((s) => s.shockBps === 300)!;

            // Asset-sensitive bank: rising rates hurt more on assets than liabilities
            // EVE should decrease when rates rise
            expect(upScenario.eve).toBeLessThan(baseScenario.eve);
        });

        it('should show higher EVE when rates fall', () => {
            const bs = service.getDemoBalanceSheet();
            const result = service.eveAnalysis(bs);

            const baseScenario = result.scenarios.find((s) => s.shockBps === 0)!;
            const downScenario = result.scenarios.find((s) => s.shockBps === -300)!;

            expect(downScenario.eve).toBeGreaterThan(baseScenario.eve);
        });
    });

    // ─── LCR ────────────────────────────────────────────────────

    describe('liquidityCoverageRatio', () => {
        it('should compute a compliant LCR', () => {
            const input: LCRRequestDto = {
                hqla: { level1: 100, level2a: 50, level2b: 20 },
                totalNetOutflows: 80,
            };
            const result = service.liquidityCoverageRatio(input);

            // Level 1: 100 (no haircut)
            // Level 2A: 50 × 0.85 = 42.5
            // Level 2B: 20 × 0.75 = 15
            // Level 2 total: 57.5
            // Level 2 cap: (2/3) × 100 = 66.67
            // 57.5 < 66.67, so no cap binding
            // HQLA = 100 + 57.5 = 157.5
            // LCR = 157.5 / 80 × 100 = 196.875%
            expect(result.hqlaTotal).toBeCloseTo(157.5, 1);
            expect(result.lcr).toBeCloseTo(196.88, 1);
            expect(result.status).toBe('compliant');
        });

        it('should apply Level 2 cap correctly', () => {
            const input: LCRRequestDto = {
                hqla: { level1: 50, level2a: 100, level2b: 100 },
                totalNetOutflows: 100,
            };
            const result = service.liquidityCoverageRatio(input);

            // Level 2A adjusted: 100 × 0.85 = 85
            // Level 2B adjusted: 100 × 0.75 = 75
            // Level 2 total: 160
            // Level 2 cap: (2/3) × 50 = 33.33
            // Cap binds! Level 2 applied = 33.33
            // HQLA = 50 + 33.33 = 83.33
            expect(result.hqlaBreakdown.level2Cap).toBeCloseTo(33.33, 1);
            expect(result.hqlaBreakdown.level2Applied).toBeCloseTo(33.33, 1);
            expect(result.hqlaTotal).toBeCloseTo(83.33, 1);
            expect(result.status).toBe('breach'); // 83.33% < 90
        });

        it('should flag breach below 90%', () => {
            const input: LCRRequestDto = {
                hqla: { level1: 30, level2a: 10, level2b: 5 },
                totalNetOutflows: 100,
            };
            const result = service.liquidityCoverageRatio(input);
            expect(result.lcr).toBeLessThan(90);
            expect(result.status).toBe('breach');
        });
    });

    // ─── BPV ────────────────────────────────────────────────────

    describe('basisPointValue', () => {
        it('should compute BPV for the demo balance sheet', () => {
            const bs = service.getDemoBalanceSheet();
            const result = service.basisPointValue(bs);

            // Asset BPV should be positive
            expect(result.totalAssetBPV).toBeGreaterThan(0);
            expect(result.totalLiabilityBPV).toBeGreaterThan(0);

            // Net BPV positive → asset-sensitive
            expect(result.netBPV).toBeGreaterThan(0);

            // All instruments represented
            expect(result.assetBPVs).toHaveLength(5);
            expect(result.liabilityBPVs).toHaveLength(5);

            // Interpretation mentions rising rates
            expect(result.interpretation).toContain('rise in rates');
        });

        it('should show floating-rate instruments with small BPV', () => {
            const bs = service.getDemoBalanceSheet();
            const result = service.basisPointValue(bs);

            // "Overnight Fed Funds" is floating with 0 repricing → near-zero duration
            const fedFunds = result.assetBPVs.find((b) => b.name === 'Overnight Fed Funds')!;
            expect(fedFunds.bpv).toBeLessThan(100); // should be tiny relative to $60M

            // "Commercial RE Loans" is fixed 7yr → meaningful BPV
            const creLoan = result.assetBPVs.find((b) => b.name === 'Commercial RE Loans')!;
            expect(creLoan.bpv).toBeGreaterThan(5000);
        });
    });

    // ─── Full Analysis ──────────────────────────────────────────

    describe('fullAnalysis', () => {
        it('should return all analysis components for the demo balance sheet', () => {
            const bs = service.getDemoBalanceSheet();
            const result = service.fullAnalysis(bs);

            expect(result.summary.totalAssets).toBe(500_000_000);
            expect(result.summary.totalLiabilities).toBe(450_000_000);
            expect(result.summary.equity).toBe(50_000_000);
            expect(result.summary.timestamp).toBeDefined();

            expect(result.durationGap).toBeDefined();
            expect(result.durationGap.durationGap).toBeGreaterThan(0);

            expect(result.niiSimulation).toBeDefined();
            expect(result.niiSimulation.baseNII).toBeGreaterThan(0);

            expect(result.eve).toBeDefined();
            expect(result.eve.baseEVE).toBeGreaterThan(0);

            expect(result.bpv).toBeDefined();
            expect(result.bpv.netBPV).toBeGreaterThan(0);

            // LCR should be derived from balance sheet
            expect(result.lcr).not.toBeNull();
            expect(result.lcr!.lcr).toBeGreaterThan(0);
        });

        it('should use explicit LCR when provided', () => {
            const bs = service.getDemoBalanceSheet();
            const lcrInput: LCRRequestDto = {
                hqla: { level1: 60_000_000, level2a: 80_000_000, level2b: 10_000_000 },
                totalNetOutflows: 45_000_000,
            };

            const result = service.fullAnalysis(bs, undefined, lcrInput);
            expect(result.lcr).not.toBeNull();
            expect(result.lcr!.hqlaBreakdown.level1).toBe(60_000_000);
        });

        it('should accept custom rate shocks', () => {
            const bs = service.getDemoBalanceSheet();
            const shocks = [-100, 0, 100];
            const result = service.fullAnalysis(bs, shocks);

            expect(result.niiSimulation.scenarios).toHaveLength(3);
            expect(result.eve.scenarios).toHaveLength(3);
        });
    });
});
