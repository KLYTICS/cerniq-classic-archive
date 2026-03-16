/**
 * COSSEC Named Regulatory Scenarios for Stress Testing
 *
 * These scenarios are specific to Puerto Rico cooperativas and align with
 * COSSEC examination guidelines. The PR Hurricane scenario is unique to
 * CERNIQ — it models the combined rate / deposit / credit shock that
 * cooperativas face during natural disasters.
 */

export interface NamedScenario {
  id: string;
  name: string;
  nameEs: string;
  type: 'parallel' | 'steepening' | 'flattening' | 'pr_specific';
  rateShiftBps: number;
  depositShockPct: number; // e.g., -5 means 5% deposit outflow
  creditShockPct: number;  // e.g., +2 means 2% increase in defaults
  description: string;
  descriptionEs: string;
  regulatoryBasis: string;
}

export interface NamedScenarioResult {
  scenario: NamedScenario;
  niiImpact: number;        // $ impact on NII
  niiImpactPct: number;     // % change vs base NII
  depositImpact: number;    // $ deposit outflow
  creditLoss: number;       // $ additional credit losses
  totalImpact: number;      // NII + deposit cost + credit loss combined
  totalImpactPct: number;   // % of base NII
  passFailStatus: 'pass' | 'warn' | 'fail';
}

export const COSSEC_SCENARIOS: NamedScenario[] = [
  {
    id: 'parallel_up_100',
    name: 'Parallel +100bps',
    nameEs: 'Paralelo +100pbs',
    type: 'parallel',
    rateShiftBps: 100,
    depositShockPct: 0,
    creditShockPct: 0,
    description: 'Uniform rate increase across all maturities',
    descriptionEs: 'Aumento uniforme de tasas en todos los plazos',
    regulatoryBasis: 'COSSEC Standard Scenario Set',
  },
  {
    id: 'parallel_up_200',
    name: 'Parallel +200bps',
    nameEs: 'Paralelo +200pbs',
    type: 'parallel',
    rateShiftBps: 200,
    depositShockPct: 0,
    creditShockPct: 0,
    description: 'Moderate rate increase stress test',
    descriptionEs: 'Prueba de estres con aumento moderado de tasas',
    regulatoryBasis: 'COSSEC Standard Scenario Set',
  },
  {
    id: 'parallel_up_300',
    name: 'Parallel +300bps',
    nameEs: 'Paralelo +300pbs',
    type: 'parallel',
    rateShiftBps: 300,
    depositShockPct: 0,
    creditShockPct: 0,
    description: 'Severe rate increase stress test',
    descriptionEs: 'Prueba de estres severa con aumento de tasas',
    regulatoryBasis: 'COSSEC Standard Scenario Set',
  },
  {
    id: 'parallel_down_100',
    name: 'Parallel -100bps',
    nameEs: 'Paralelo -100pbs',
    type: 'parallel',
    rateShiftBps: -100,
    depositShockPct: 0,
    creditShockPct: 0,
    description: 'Rate decrease scenario',
    descriptionEs: 'Escenario de disminucion de tasas',
    regulatoryBasis: 'COSSEC Standard Scenario Set',
  },
  {
    id: 'steepening',
    name: 'Yield Curve Steepening',
    nameEs: 'Empinamiento de Curva',
    type: 'steepening',
    rateShiftBps: 200, // short +200bps, long +100bps
    depositShockPct: -2,
    creditShockPct: 0,
    description: 'Short rates +200bps, long rates +100bps — deposit competition',
    descriptionEs: 'Tasas cortas +200pbs, tasas largas +100pbs — competencia por depositos',
    regulatoryBasis: 'COSSEC Enhanced Scenario Guidelines',
  },
  {
    id: 'pr_hurricane_stress',
    name: 'PR Economic Stress',
    nameEs: 'Estres Economico PR',
    type: 'pr_specific',
    rateShiftBps: 150,
    depositShockPct: -5,
    creditShockPct: 2,
    description: 'Rates +150bps, deposits -5%, loan defaults +2% — hurricane/disaster scenario',
    descriptionEs: 'Tasas +150pbs, depositos -5%, morosidad +2% — escenario huracan/desastre',
    regulatoryBasis: 'COSSEC Hurricane Preparedness Guidelines',
  },
];
