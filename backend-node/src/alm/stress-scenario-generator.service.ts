import { Injectable } from '@nestjs/common';

/**
 * Stress Scenario Generator — Quant Model #57
 *
 * Generates regulatory and custom stress scenarios for ALM analysis.
 * Includes COSSEC-mandated, Basel IRRBB, Fed DFAST, and custom scenarios.
 */
@Injectable()
export class StressScenarioGeneratorService {
  generate(params: { framework: 'cossec' | 'basel' | 'dfast' | 'custom'; customShocks?: Record<string, number> }): {
    scenarios: Array<{
      name: string; nameEs: string; category: string;
      shocks: Record<string, number>;
      probability: string;
      severity: 'mild' | 'moderate' | 'severe' | 'extreme';
    }>;
  } {
    switch (params.framework) {
      case 'cossec': return { scenarios: this.cossecScenarios() as any };
      case 'basel': return { scenarios: this.baselScenarios() as any };
      case 'dfast': return { scenarios: this.dfastScenarios() as any };
      default: return { scenarios: [{ name: 'Custom', nameEs: 'Personalizado', category: 'custom', shocks: params.customShocks ?? {}, probability: 'User-defined', severity: 'moderate' }] };
    }
  }

  private cossecScenarios() {
    return [
      { name: 'COSSEC Parallel Up 200', nameEs: 'COSSEC Paralelo +200', category: 'rate', shocks: { parallel: 200 }, probability: '10-15%', severity: 'moderate' as const },
      { name: 'COSSEC Parallel Down 200', nameEs: 'COSSEC Paralelo -200', category: 'rate', shocks: { parallel: -200 }, probability: '10-15%', severity: 'moderate' as const },
      { name: 'COSSEC Steepener', nameEs: 'COSSEC Empinamiento', category: 'rate', shocks: { short: -100, long: 100 }, probability: '15-20%', severity: 'mild' as const },
      { name: 'COSSEC Flattener', nameEs: 'COSSEC Aplanamiento', category: 'rate', shocks: { short: 100, long: -100 }, probability: '15-20%', severity: 'mild' as const },
      { name: 'PR Hurricane Impact', nameEs: 'Impacto Huracan PR', category: 'credit', shocks: { defaultRate: 300, recovery: -20, realEstate: -15 }, probability: '5-8%', severity: 'severe' as const },
      { name: 'Deposit Flight', nameEs: 'Fuga de Depositos', category: 'liquidity', shocks: { depositOutflow: -20, wholesale: -50 }, probability: '3-5%', severity: 'extreme' as const },
    ];
  }

  private baselScenarios() {
    return [
      { name: 'Parallel Up 200', nameEs: 'Paralelo +200', category: 'irrbb', shocks: { parallel: 200 }, probability: 'Standard', severity: 'moderate' as const },
      { name: 'Parallel Down 200', nameEs: 'Paralelo -200', category: 'irrbb', shocks: { parallel: -200 }, probability: 'Standard', severity: 'moderate' as const },
      { name: 'Short Up 300', nameEs: 'Corto +300', category: 'irrbb', shocks: { short: 300, long: 0 }, probability: 'Standard', severity: 'severe' as const },
      { name: 'Short Down 300', nameEs: 'Corto -300', category: 'irrbb', shocks: { short: -300, long: 0 }, probability: 'Standard', severity: 'severe' as const },
      { name: 'Steepener', nameEs: 'Empinamiento', category: 'irrbb', shocks: { short: -100, long: 100 }, probability: 'Standard', severity: 'mild' as const },
      { name: 'Flattener', nameEs: 'Aplanamiento', category: 'irrbb', shocks: { short: 100, long: -100 }, probability: 'Standard', severity: 'mild' as const },
    ];
  }

  private dfastScenarios() {
    return [
      { name: 'Baseline', nameEs: 'Base', category: 'dfast', shocks: { gdp: 2.1, unemployment: 4.2, rates: -25 }, probability: '60-70%', severity: 'mild' as const },
      { name: 'Adverse', nameEs: 'Adverso', category: 'dfast', shocks: { gdp: -1.5, unemployment: 7.5, rates: -150 }, probability: '15-25%', severity: 'severe' as const },
      { name: 'Severely Adverse', nameEs: 'Severamente Adverso', category: 'dfast', shocks: { gdp: -4.0, unemployment: 10.0, rates: -200, equities: -45 }, probability: '5-10%', severity: 'extreme' as const },
    ];
  }
}
