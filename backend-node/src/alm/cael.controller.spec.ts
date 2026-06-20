import { CaelController } from './cael.controller';
import { CaelComplianceService } from './cael-compliance.service';
import type { AlmEnterpriseService } from './alm-enterprise.service';
import type { CECLService } from './cecl.service';

describe('CaelController — CAEL compliance dispatch (W1.1 Slice 2)', () => {
  const SUMMARY = {
    equity: 25,
    totalAssets: 250,
    capitalRatioRWA: 18.6,
    liquidityRatio: 12,
    interestIncome: 10,
    interestExpense: 4,
  };
  const INCURRED = {
    totalAllowance: 2.6,
    totalBalance: 200,
    methodology: 'Incurred Loss (Reg 8665)',
    overallStatus: 'computed' as const,
  };
  const WARM = {
    totalAllowance: 8.7,
    totalBalance: 200,
    methodology: 'WARM',
    overallStatus: 'computed' as const,
  };

  function makeController(): {
    controller: CaelController;
    cossecSpy: jest.Mock;
    ceclSpy: jest.Mock;
  } {
    const cossecSpy = jest.fn().mockResolvedValue({ summary: SUMMARY });
    const ceclSpy = jest
      .fn()
      .mockImplementation((_id: string, method: string) =>
        Promise.resolve(method === 'incurredloss' ? INCURRED : WARM),
      );
    const almEnterprise = {
      getCOSSECCompliance: cossecSpy,
    } as unknown as AlmEnterpriseService;
    const cecl = {
      getCECLAnalysis: ceclSpy,
    } as unknown as CECLService;
    const controller = new CaelController(
      almEnterprise,
      cecl,
      new CaelComplianceService(),
    );
    return { controller, cossecSpy, ceclSpy };
  }

  it('returns the three CAEL variants in canonical order', async () => {
    const { controller } = makeController();
    const r = await controller.getCaelCompliance('inst-1');
    expect(r.map((x) => x.variant)).toEqual(['reg7790', 'cecl', 'piloto']);
  });

  it('feeds each variant its own allowance basis (the dual-filing point)', async () => {
    const { controller } = makeController();
    const r = await controller.getCaelCompliance('inst-1');
    expect(r[0].allowance.basis).toBe('incurred-loss');
    expect(r[0].allowance.coveragePct).toBe(1.3); // 2.6/200
    expect(r[1].allowance.basis).toBe('cecl');
    expect(r[1].allowance.coveragePct).toBe(4.35); // 8.7/200
    expect(r[2].allowance.basis).toBe('n/a'); // Piloto carries no allowance
  });

  it('runs the engines exactly once each (COSSEC) / per basis (CECL)', async () => {
    const { controller, cossecSpy, ceclSpy } = makeController();
    await controller.getCaelCompliance('inst-1');
    expect(cossecSpy).toHaveBeenCalledTimes(1);
    expect(ceclSpy).toHaveBeenCalledWith('inst-1', 'incurredloss');
    expect(ceclSpy).toHaveBeenCalledWith('inst-1', 'warm');
  });

  it('propagates the computed verdict from real engine output', async () => {
    const { controller } = makeController();
    const r = await controller.getCaelCompliance('inst-1');
    // capital 18.6% ≥ 8% statutory → pass; asset-quality data_unavailable →
    // overall conditional (never a phantom pass).
    expect(r[0].ratios.find((x) => x.category === 'capital')!.status).toBe(
      'pass',
    );
    expect(r[0].overallStatus).toBe('conditional');
  });
});
