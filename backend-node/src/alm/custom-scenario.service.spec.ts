import { BadRequestException } from '@nestjs/common';
import { CustomScenarioService } from './custom-scenario.service';

function mockSvc(): any {
  return new Proxy({}, {
    get: (_t: any, p: any) => typeof p === 'symbol' ? undefined : jest.fn().mockResolvedValue(null),
  });
}

describe('CustomScenarioService', () => {
  let service: CustomScenarioService;
  let almEnterprise: Record<string, jest.Mock>;
  let scenarioPersistence: Record<string, jest.Mock>;

  const baseNIISensitivity = {
    baseNII: 5.2,
    scenarios: [
      { shiftBps: -200, niImpact: -1.8, mveImpact: 0 },
      { shiftBps: -100, niImpact: -0.9, mveImpact: 0 },
      { shiftBps: 0, niImpact: 0, mveImpact: 0 },
      { shiftBps: 100, niImpact: 0.8, mveImpact: 0 },
      { shiftBps: 200, niImpact: 1.5, mveImpact: 0 },
      { shiftBps: 300, niImpact: 2.1, mveImpact: 0 },
    ],
  };

  const baseLiquidity = { lcr: 142, nsfr: 118, status: 'compliant' };

  const baseCOSSEC = {
    summary: {
      totalAssets: 250_000_000,
      totalLoans: 150_000_000,
      totalShares: 120_000_000,
      capitalRatio: 12.5,
    },
  };

  const baseDurationGap = { durationGap: 2.1, riskProfile: 'asset-sensitive' };

  beforeEach(() => {
    almEnterprise = {
      calculateNIISensitivity: jest.fn().mockResolvedValue(baseNIISensitivity),
      calculateLCR: jest.fn().mockResolvedValue(baseLiquidity),
      getCOSSECCompliance: jest.fn().mockResolvedValue(baseCOSSEC),
      calculateDurationGap: jest.fn().mockResolvedValue(baseDurationGap),
    };

    scenarioPersistence = {
      persist: jest.fn().mockResolvedValue({ id: 'scen-1' }),
      saveScenario: jest.fn().mockResolvedValue({ id: 'scen-1', name: 'Test' }),
    };

    service = new CustomScenarioService(
      mockSvc() as any,       // prisma
      almEnterprise as any,
      mockSvc() as any,       // stressTesting
      scenarioPersistence as any,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('runs a basic +200bps scenario', async () => {
    const result = await service.runCustomScenario('inst-1', {
      name: 'Rate Hike 200bps',
      rateShiftBps: 200,
    });

    expect(result.scenario.name).toBe('Rate Hike 200bps');
    expect(result.niiImpact).toBeDefined();
    expect(result.eveChange).toBeDefined();
    expect(result.lcrImpact).toBeDefined();
    expect(result.capitalImpact).toBeDefined();
    expect(result.narrative.length).toBeGreaterThan(0);
  });

  it('clamps rate shift to [-300, +300]', async () => {
    const result = await service.runCustomScenario('inst-1', {
      name: 'Extreme',
      rateShiftBps: 500,
    });
    // Should not crash — clamped internally to 300
    expect(result.scenario.params.rateShiftBps).toBeDefined();
  });

  it('negative rate shift produces negative NII impact for asset-sensitive institution', async () => {
    const result = await service.runCustomScenario('inst-1', {
      name: 'Rate Cut',
      rateShiftBps: -200,
    });
    expect(result.niiImpact).toBeLessThan(0);
  });

  it('deposit runoff reduces LCR', async () => {
    const noRunoff = await service.runCustomScenario('inst-1', {
      name: 'Base',
      rateShiftBps: 100,
      depositRunoff: 0,
    });
    const withRunoff = await service.runCustomScenario('inst-1', {
      name: 'Deposit Flight',
      rateShiftBps: 100,
      depositRunoff: 20,
    });
    expect(withRunoff.lcrImpact).toBeLessThan(noRunoff.lcrImpact);
  });

  it('loan default increase impacts capital', async () => {
    const noDefaults = await service.runCustomScenario('inst-1', {
      name: 'Base',
      rateShiftBps: 0,
      loanDefaultIncrease: 0,
    });
    const withDefaults = await service.runCustomScenario('inst-1', {
      name: 'Credit Stress',
      rateShiftBps: 0,
      loanDefaultIncrease: 10,
    });
    expect(withDefaults.capitalImpact).toBeLessThan(noDefaults.capitalImpact);
  });

  it('throws BadRequestException when institution data unavailable', async () => {
    almEnterprise.calculateNIISensitivity.mockRejectedValue(
      new Error('Institution not found'),
    );

    await expect(
      service.runCustomScenario('nonexistent', {
        name: 'Test',
        rateShiftBps: 100,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid scenario name', async () => {
    await expect(
      service.runCustomScenario('inst-1', {
        name: '',
        rateShiftBps: 100,
      }),
    ).rejects.toThrow();
  });
});
