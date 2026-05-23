import { script } from '../../runner/mock-llm-bridge';

/**
 * Scripted LLM replay for case 006: Deposit flight scenario.
 *
 * Tests the agent's ability to detect funding-side risk even when LCR is
 * still above its minimum — the smoking gun is the deposit-beta + NSFR
 * trajectory, not the headline LCR.
 *
 * Turn sequence:
 *   1. runFullSwarm
 *   2. getLCR + getDepositBeta (parallel — agent realises funding-side)
 *   3. getNSFR + getConcentration (depth on funding mix)
 *   4. getCECL (credit knock-on)
 *   5. final output (end_turn)
 *
 * 6 tool calls — meets minToolsCalled=6 in 006.json.
 * Required tools per JSON: runFullSwarm, getLCR, getDepositBeta.
 * topRiskDomain: "Liquidity Risk"; healthScoreRange: [45, 65].
 */
export default script()
  .forCase('alm-006', 'Deposit flight — funding-side liquidity risk — 5-turn')

  .addToolUseTurn(
    [
      {
        id: 'tc_001',
        name: 'runFullSwarm',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 3200, outputTokens: 140 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_002',
        name: 'getLCR',
        input: { institutionId: 'golden-inst-001' },
      },
      {
        id: 'tc_003',
        name: 'getDepositBeta',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 4600, outputTokens: 110 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_004',
        name: 'getNSFR',
        input: { institutionId: 'golden-inst-001' },
      },
      {
        id: 'tc_005',
        name: 'getConcentration',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 5400, outputTokens: 95 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_006',
        name: 'getCECL',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 5800, outputTokens: 70 },
  )

  .addEndTurn(
    JSON.stringify({
      agentId: 'alm_decision',
      version: '2.0',
      runId: 'eval-006',
      institutionId: 'golden-inst-001',
      timestamp: '2026-04-15T10:00:00.000Z',
      language: 'en',
      healthSnapshot: {
        overall: 54,
        capital: 68,
        liquidity: 42,
        rateRisk: 58,
        credit: 64,
        concentration: 50,
        label: 'FAIR',
        trend: 'deteriorating',
      },
      topRisks: [
        {
          rank: 1,
          domain: 'Liquidity Risk',
          priorityScore: 26,
          severity: 'HIGH',
          finding:
            'Checking deposits declining 12% QoQ. Deposit beta on checking is 0.78 (high rate sensitivity). NSFR at 102% — 2pp above floor and trending down 4pp/quarter. Brokered CD concentration up to 18% of total funding (was 9% one year ago). LCR 117% still above minimum but masks $4.2M of funding-mix deterioration.',
          findingEs:
            'Depósitos de cuenta corriente bajando 12% QoQ. Beta de depósito en cuenta corriente 0.78 (alta sensibilidad a tasas). NSFR a 102% — 2pp sobre el piso y bajando 4pp/trimestre. Concentración de CDs intermediados subió a 18% del fondeo total (era 9% hace un año).',
          dollarImpact: 4200000,
          dollarImpactPct: 12.4,
          regulatoryRef: 'COSSEC Reg. 8866 §7.2 + Basel NSFR §10',
          toolsUsed: ['runFullSwarm', 'getLCR', 'getDepositBeta', 'getNSFR'],
        },
        {
          rank: 2,
          domain: 'Concentration Risk',
          priorityScore: 18,
          severity: 'MEDIUM',
          finding:
            'Brokered CD concentration 18% breaches internal 15% policy. Top-10 depositor concentration up to 22% (peer median 14%).',
          findingEs:
            'Concentración de CDs intermediados 18% excede política interna de 15%. Concentración de top-10 depositantes 22% (mediana de pares 14%).',
          dollarImpact: 1850000,
          dollarImpactPct: 5.5,
          regulatoryRef: 'COSSEC Carta Circular 2019-01 §IV',
          toolsUsed: ['runFullSwarm', 'getConcentration'],
        },
        {
          rank: 3,
          domain: 'Interest Rate Risk',
          priorityScore: 14,
          severity: 'MEDIUM',
          finding:
            'High deposit beta amplifies +200bps NII sensitivity to 4.8%, near the 5.5% policy ceiling.',
          findingEs:
            'Beta de depósito alto amplifica sensibilidad NII +200bps a 4.8%, cerca del techo de política de 5.5%.',
          dollarImpact: 920000,
          dollarImpactPct: 2.7,
          regulatoryRef: 'COSSEC Carta Circular 2021-02 §III.B',
          toolsUsed: ['runFullSwarm'],
        },
        {
          rank: 4,
          domain: 'Credit Risk',
          priorityScore: 9,
          severity: 'LOW',
          finding:
            'CECL allowance 1.48% vs peer median 1.58% — under-reserved $310K. Stable but watch under deposit-flight stress.',
          findingEs:
            'Reserva CECL 1.48% vs mediana de pares 1.58% — sub-reservado $310K. Estable pero vigilar bajo estrés de fuga de depósitos.',
          dollarImpact: 310000,
          dollarImpactPct: 0.9,
          regulatoryRef: 'ASC 326-20',
          toolsUsed: ['runFullSwarm', 'getCECL'],
        },
        {
          rank: 5,
          domain: 'Capital Adequacy',
          priorityScore: 6,
          severity: 'LOW',
          finding:
            'Net worth 7.6% — adequate buffer above 7.0% well-capitalized line.',
          findingEs:
            'Patrimonio neto 7.6% — buffer adecuado sobre línea de 7.0%.',
          dollarImpact: 180000,
          dollarImpactPct: 0.5,
          regulatoryRef: 'NCUA §702.102',
          toolsUsed: ['runFullSwarm'],
        },
      ],
      decisionQueue: [
        {
          priority: 1,
          action:
            'Cap brokered CD funding at 15% of total funding within 60 days; replace $1.2M of brokered CDs with member CD specials.',
          actionEs:
            'Limitar fondeo de CDs intermediados al 15% del fondeo total en 60 días; reemplazar $1.2M de CDs intermediados con especiales de CD de socios.',
          expectedImpact:
            'NSFR +180bps; reduce funding-cost beta from 0.78 to ~0.65 (+$420K/yr NIM)',
          deadline: '60d',
          owner: 'CFO',
          regulatoryRef: 'COSSEC Reg. 8866',
          status: 'PENDING',
        },
        {
          priority: 2,
          action:
            'Launch 12-month member CD special at +25bps over peer median to staunch checking outflow ($2.5M campaign).',
          actionEs:
            'Lanzar CD especial de socio a 12 meses a +25bps sobre mediana de pares para detener fuga de cuenta corriente (campaña $2.5M).',
          expectedImpact:
            'Reverse $1.5M/quarter of checking outflow; deposit beta to 0.70',
          deadline: '30d',
          owner: 'CFO',
          regulatoryRef: 'COSSEC Carta Circular 2018-04',
          status: 'PENDING',
        },
        {
          priority: 3,
          action:
            'Increase HQLA buffer by $1.8M via 3-month Treasury ladder to lift LCR to 125% safe zone.',
          actionEs:
            'Aumentar buffer HQLA en $1.8M vía escalera Tesoro 3 meses para subir LCR a zona segura de 125%.',
          expectedImpact: 'LCR +800bps; absorb 30-day stress without breach',
          deadline: '45d',
          owner: 'CFO',
          regulatoryRef: 'COSSEC Reg. 8866 §7.2',
          status: 'PENDING',
        },
        {
          priority: 4,
          action:
            'Reduce single-depositor concentration: 5 largest accounts to <2% of total deposits each ($800K relationship reviews).',
          actionEs:
            'Reducir concentración de depositante único: 5 cuentas más grandes a <2% del total cada una (revisión de relaciones de $800K).',
          expectedImpact: 'Top-10 concentration to 18% (peer median)',
          deadline: '90d',
          owner: 'ALM_COMMITTEE',
          regulatoryRef: 'COSSEC Carta Circular 2019-01 §IV',
          status: 'PENDING',
        },
        {
          priority: 5,
          action:
            'Refresh weekly funding dashboard for ALCO with deposit-beta + NSFR + LCR trio plus brokered-CD share alert at 16%.',
          actionEs:
            'Renovar tablero semanal de fondeo para ALCO con trío beta-depósito + NSFR + LCR más alerta de CDs intermediados al 16%.',
          expectedImpact:
            'Early-warning visibility; +30d lead time on next funding stress',
          deadline: '30d',
          owner: 'ALM_COMMITTEE',
          regulatoryRef: 'COSSEC Reg. 8866 §9',
          status: 'PENDING',
        },
      ],
      brief:
        'Liquidity risk is the top concern despite LCR still above minimum. Checking deposits are declining 12% QoQ with a 0.78 deposit beta, and the institution is replacing those losses with brokered CDs — now 18% of funding vs 9% a year ago, above internal policy. NSFR has trended down 4pp/quarter to 102%. The recommended package caps brokered CD reliance, launches a member CD special, and lifts the HQLA buffer to 125% LCR.',
      briefEs:
        'El riesgo de liquidez es la preocupación principal a pesar de un LCR aún sobre el mínimo. Los depósitos de cuenta corriente bajan 12% QoQ con beta de 0.78, y la institución reemplaza las pérdidas con CDs intermediados — ahora 18% del fondeo vs 9% hace un año. NSFR bajó 4pp/trimestre a 102%. El plan recomendado limita la dependencia de CDs intermediados, lanza un CD especial para socios y eleva el buffer HQLA a LCR 125%.',
      auditTraceId: 'eval-trace-006',
    }),
    { inputTokens: 6400, outputTokens: 2100 },
  )

  .build();
