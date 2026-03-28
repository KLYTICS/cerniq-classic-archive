import { Injectable } from '@nestjs/common';

/**
 * Economic Capital Model — Quant Model #63
 *
 * Calculates the capital required to absorb unexpected losses
 * at a target confidence level (typically 99.9% for banks).
 *
 * EC = UL(99.9%) = VaR(99.9%) - EL
 *
 * Aggregates across risk types:
 * - Credit risk capital
 * - Market/interest rate risk capital
 * - Operational risk capital
 * - Concentration risk add-on
 *
 * Diversification benefit via correlation matrix.
 */
@Injectable()
export class EconomicCapitalService {
  calculate(params: {
    creditRiskCapital: number;
    marketRiskCapital: number;
    operationalRiskCapital: number;
    concentrationAddOn: number;
    correlationMatrix?: number[][]; // 3x3 for credit, market, ops
    totalAssets: number;
    regulatoryCapital: number;
  }): {
    undiversifiedEC: number;
    diversifiedEC: number;
    diversificationBenefit: number;
    capitalAdequacy: number;
    surplus: number;
    components: Array<{
      risk: string;
      riskEs: string;
      standalone: number;
      diversified: number;
      pct: number;
    }>;
    interpretation: string;
    interpretationEs: string;
  } {
    const {
      creditRiskCapital,
      marketRiskCapital,
      operationalRiskCapital,
      concentrationAddOn,
      totalAssets,
      regulatoryCapital,
    } = params;
    const correlation = params.correlationMatrix ?? [
      [1.0, 0.3, 0.1],
      [0.3, 1.0, 0.2],
      [0.1, 0.2, 1.0],
    ];

    const standalone = [
      creditRiskCapital,
      marketRiskCapital,
      operationalRiskCapital,
    ];
    const undiversified =
      standalone.reduce((s, c) => s + c, 0) + concentrationAddOn;

    // Diversified EC via correlation
    let diversifiedSq = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        diversifiedSq += standalone[i] * standalone[j] * correlation[i][j];
      }
    }
    const diversified = Math.sqrt(diversifiedSq) + concentrationAddOn;
    const benefit = undiversified - diversified;

    const capitalAdequacy = (regulatoryCapital / diversified) * 100;
    const surplus = regulatoryCapital - diversified;

    const components = [
      {
        risk: 'Credit Risk',
        riskEs: 'Riesgo Crediticio',
        standalone: creditRiskCapital,
        diversified: (creditRiskCapital * diversified) / undiversified,
        pct: (creditRiskCapital / undiversified) * 100,
      },
      {
        risk: 'Market Risk',
        riskEs: 'Riesgo de Mercado',
        standalone: marketRiskCapital,
        diversified: (marketRiskCapital * diversified) / undiversified,
        pct: (marketRiskCapital / undiversified) * 100,
      },
      {
        risk: 'Operational Risk',
        riskEs: 'Riesgo Operacional',
        standalone: operationalRiskCapital,
        diversified: (operationalRiskCapital * diversified) / undiversified,
        pct: (operationalRiskCapital / undiversified) * 100,
      },
      {
        risk: 'Concentration',
        riskEs: 'Concentracion',
        standalone: concentrationAddOn,
        diversified: concentrationAddOn,
        pct: (concentrationAddOn / undiversified) * 100,
      },
    ].map((c) => ({
      ...c,
      standalone: +c.standalone.toFixed(0),
      diversified: +c.diversified.toFixed(0),
      pct: +c.pct.toFixed(1),
    }));

    return {
      undiversifiedEC: +undiversified.toFixed(0),
      diversifiedEC: +diversified.toFixed(0),
      diversificationBenefit: +benefit.toFixed(0),
      capitalAdequacy: +capitalAdequacy.toFixed(1),
      surplus: +surplus.toFixed(0),
      components,
      interpretation: `Economic capital: $${(diversified / 1e6).toFixed(0)}M (diversified). Diversification benefit: $${(benefit / 1e6).toFixed(0)}M (${((benefit / undiversified) * 100).toFixed(0)}%). Capital adequacy: ${capitalAdequacy.toFixed(0)}%. ${surplus > 0 ? `Surplus: $${(surplus / 1e6).toFixed(0)}M.` : `Shortfall: $${(Math.abs(surplus) / 1e6).toFixed(0)}M.`}`,
      interpretationEs: `Capital economico: $${(diversified / 1e6).toFixed(0)}M (diversificado). Beneficio diversificacion: $${(benefit / 1e6).toFixed(0)}M (${((benefit / undiversified) * 100).toFixed(0)}%). Adecuacion capital: ${capitalAdequacy.toFixed(0)}%. ${surplus > 0 ? `Superavit: $${(surplus / 1e6).toFixed(0)}M.` : `Deficit: $${(Math.abs(surplus) / 1e6).toFixed(0)}M.`}`,
    };
  }
}
