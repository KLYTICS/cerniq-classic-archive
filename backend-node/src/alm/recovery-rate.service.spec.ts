import { RecoveryRateService } from './recovery-rate.service';

describe('RecoveryRateService', () => {
  let service: RecoveryRateService;

  beforeEach(() => {
    service = new RecoveryRateService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('estimates LGD by collateral type for a portfolio', () => {
    const result = service.estimate([
      {
        type: 'Mortgage',
        typeEs: 'Hipoteca',
        balance: 200,
        collateralValue: 250,
        collateralType: 'real estate',
        seniorityRank: 1,
      },
      {
        type: 'Auto',
        typeEs: 'Auto',
        balance: 50,
        collateralValue: 40,
        collateralType: 'auto',
        seniorityRank: 1,
      },
      {
        type: 'Unsecured',
        typeEs: 'No garantizado',
        balance: 30,
        collateralValue: 0,
        collateralType: 'unsecured',
        seniorityRank: 1,
      },
    ]);

    expect(result.loans).toHaveLength(3);
    expect(result.portfolioLGD).toBeGreaterThan(0);
    expect(result.portfolioLGD).toBeLessThanOrEqual(1);
    expect(result.portfolioRecovery).toBeCloseTo(1 - result.portfolioLGD, 2);
    expect(result.interpretation).toContain('LGD');
    expect(result.interpretationEs).toContain('LGD');
  });

  it('real estate gets highest base recovery rate (0.65)', () => {
    const result = service.estimate([
      {
        type: 'RE',
        typeEs: 'RE',
        balance: 100,
        collateralValue: 120,
        collateralType: 'real estate',
        seniorityRank: 1,
      },
    ]);

    expect(result.loans[0].estimatedRecovery).toBeCloseTo(0.65, 1);
    expect(result.loans[0].lgd).toBeCloseTo(0.35, 1);
  });

  it('seniority rank reduces recovery for junior tranches', () => {
    const senior = service.estimate([
      {
        type: 'A',
        typeEs: 'A',
        balance: 100,
        collateralValue: 150,
        collateralType: 'real estate',
        seniorityRank: 1,
      },
    ]);
    const junior = service.estimate([
      {
        type: 'B',
        typeEs: 'B',
        balance: 100,
        collateralValue: 150,
        collateralType: 'real estate',
        seniorityRank: 3,
      },
    ]);

    expect(senior.loans[0].estimatedRecovery).toBeGreaterThan(
      junior.loans[0].estimatedRecovery,
    );
  });

  it('LTV > 100% reduces recovery proportionally', () => {
    const result = service.estimate([
      {
        type: 'Underwater',
        typeEs: 'Bajo agua',
        balance: 200,
        collateralValue: 100,
        collateralType: 'real estate',
        seniorityRank: 1,
      },
    ]);

    // collateralValue/balance = 0.5, so recovery = 0.65 * 1 * 0.5 = 0.325, rounded to 0.33
    expect(result.loans[0].estimatedRecovery).toBeCloseTo(0.33, 2);
    expect(result.loans[0].ltv).toBeCloseTo(200, 0);
  });

  it('unsecured loans have lowest base recovery (0.25)', () => {
    const result = service.estimate([
      {
        type: 'Personal',
        typeEs: 'Personal',
        balance: 100,
        collateralValue: 100,
        collateralType: 'unsecured',
        seniorityRank: 1,
      },
    ]);

    expect(result.loans[0].estimatedRecovery).toBeCloseTo(0.25, 1);
  });

  it('returns default recovery rate of 0.4 for unknown collateral type', () => {
    const result = service.estimate([
      {
        type: 'Unknown',
        typeEs: 'Desconocido',
        balance: 100000,
        collateralValue: 100000,
        collateralType: 'alien_artifacts',
        seniorityRank: 1,
      },
    ]);
    // getBaseRecovery default branch returns 0.4
    expect(result.loans[0].estimatedRecovery).toBeCloseTo(0.4, 1);
  });

  it('equipment collateral gets 0.45 base recovery', () => {
    const result = service.estimate([
      {
        type: 'Equipment',
        typeEs: 'Equipo',
        balance: 100,
        collateralValue: 120,
        collateralType: 'equipment',
        seniorityRank: 1,
      },
    ]);
    expect(result.loans[0].estimatedRecovery).toBeCloseTo(0.45, 1);
  });

  it('vehicle collateral maps to auto recovery rate (0.55)', () => {
    const result = service.estimate([
      {
        type: 'Vehicle',
        typeEs: 'Vehiculo',
        balance: 80,
        collateralValue: 100,
        collateralType: 'vehicle_loan',
        seniorityRank: 1,
      },
    ]);
    expect(result.loans[0].estimatedRecovery).toBeCloseTo(0.55, 1);
  });

  it('mortgage collateral maps to real estate recovery rate (0.65)', () => {
    const result = service.estimate([
      {
        type: 'Mortgage',
        typeEs: 'Hipoteca',
        balance: 100,
        collateralValue: 150,
        collateralType: 'mortgage_backed',
        seniorityRank: 1,
      },
    ]);
    expect(result.loans[0].estimatedRecovery).toBeCloseTo(0.65, 1);
  });
});
