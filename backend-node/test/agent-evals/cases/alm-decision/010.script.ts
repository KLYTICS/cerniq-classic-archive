import { script } from '../../runner/mock-llm-bridge';

/**
 * Scripted LLM replay for case 010: Bilingual PR cooperativa (EN + ES).
 *
 * Puerto Rico-domiciled cooperativa. Both English and Spanish must be fully
 * populated for every brief, finding, and action — this case gates the
 * bilingual completeness dimension (10% weight). COSSEC regulatory refs
 * required throughout.
 *
 * Turn sequence:
 *   1. runFullSwarm
 *   2. runRateShock + getLCR
 *   3. getCapitalAdequacy + getCECL
 *   4. getConcentration
 *   5. final output (end_turn)
 *
 * 6 tool calls; required tools: runFullSwarm, runRateShock.
 * topRiskDomain: "Interest Rate Risk"; bilingual required.
 */
export default script()
  .forCase('alm-010', 'Bilingual PR cooperativa — full EN/ES coverage — 5-turn')

  .addToolUseTurn(
    [
      {
        id: 'tc_001',
        name: 'runFullSwarm',
        input: {
          institutionId: 'golden-inst-003',
          language: 'bilingual',
        },
      },
    ],
    { inputTokens: 3200, outputTokens: 140 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_002',
        name: 'runRateShock',
        input: {
          institutionId: 'golden-inst-003',
          shockBps: [100, 200, 300, -100, -200],
        },
      },
      {
        id: 'tc_003',
        name: 'getLCR',
        input: { institutionId: 'golden-inst-003' },
      },
    ],
    { inputTokens: 4600, outputTokens: 120 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_004',
        name: 'getCapitalAdequacy',
        input: { institutionId: 'golden-inst-003' },
      },
      {
        id: 'tc_005',
        name: 'getCECL',
        input: { institutionId: 'golden-inst-003' },
      },
    ],
    { inputTokens: 5400, outputTokens: 100 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_006',
        name: 'getConcentration',
        input: { institutionId: 'golden-inst-003' },
      },
    ],
    { inputTokens: 5800, outputTokens: 75 },
  )

  .addEndTurn(
    JSON.stringify({
      agentId: 'alm_decision',
      version: '2.0',
      runId: 'eval-010',
      institutionId: 'golden-inst-003',
      timestamp: '2026-04-15T10:00:00.000Z',
      language: 'bilingual',
      healthSnapshot: {
        overall: 64,
        capital: 76,
        liquidity: 68,
        rateRisk: 52,
        credit: 70,
        concentration: 64,
        label: 'FAIR',
        trend: 'stable',
      },
      topRisks: [
        {
          rank: 1,
          domain: 'Interest Rate Risk',
          priorityScore: 24,
          severity: 'HIGH',
          finding:
            'NII +200bps sensitivity at 5.8% — exceeds COSSEC 5.0% policy ceiling by 80bps. Repricing gap −1.4yr driven by 3-5 year fixed-rate auto-loan portfolio. Estimated $2.0M annual NIM at risk under +200bps sustained shock.',
          findingEs:
            'Sensibilidad NII +200bps a 5.8% — excede el techo de política COSSEC de 5.0% por 80bps. Brecha de repreciación −1.4yr impulsada por la cartera de préstamos auto a tasa fija de 3-5 años. NIM anual estimado en riesgo de $2.0M bajo choque sostenido de +200bps.',
          dollarImpact: 2000000,
          dollarImpactPct: 5.9,
          regulatoryRef: 'COSSEC Carta Circular 2021-02 §III.B',
          toolsUsed: ['runFullSwarm', 'runRateShock'],
        },
        {
          rank: 2,
          domain: 'Concentration Risk',
          priorityScore: 18,
          severity: 'MEDIUM',
          finding:
            'Auto-loan sector HHI 2,720 — over internal 2,500 limit. 33% of portfolio concentrated in auto. Top-15 member exposure 9.4% of net worth (internal limit 7%).',
          findingEs:
            'HHI sector auto 2,720 — sobre límite interno de 2,500. 33% de la cartera concentrada en auto. Exposición top-15 socios 9.4% del patrimonio neto (límite interno 7%).',
          dollarImpact: 1100000,
          dollarImpactPct: 3.2,
          regulatoryRef: 'COSSEC Carta Circular 2019-01 §IV',
          toolsUsed: ['runFullSwarm', 'getConcentration'],
        },
        {
          rank: 3,
          domain: 'Credit Risk',
          priorityScore: 14,
          severity: 'MEDIUM',
          finding:
            'CECL allowance 1.42% vs peer median 1.58% — under-reserved by $440K. Commercial real-estate segment shows 2.1% 30-day delinquency vs peer 1.4%.',
          findingEs:
            'Reserva CECL 1.42% vs mediana de pares 1.58% — sub-reservado por $440K. El segmento de inmobiliario comercial muestra morosidad 30 días de 2.1% vs pares 1.4%.',
          dollarImpact: 440000,
          dollarImpactPct: 1.3,
          regulatoryRef: 'ASC 326-20 + COSSEC Carta Circular 2020-03',
          toolsUsed: ['runFullSwarm', 'getCECL'],
        },
        {
          rank: 4,
          domain: 'Liquidity Risk',
          priorityScore: 10,
          severity: 'LOW',
          finding:
            'LCR 122% — 22pp above floor and trending stable. Deposit beta 0.62 (peer median 0.65). NSFR 108% adequate.',
          findingEs:
            'LCR 122% — 22pp sobre el piso y con tendencia estable. Beta de depósito 0.62 (mediana de pares 0.65). NSFR 108% adecuado.',
          dollarImpact: 280000,
          dollarImpactPct: 0.8,
          regulatoryRef: 'COSSEC Reg. 8866 §7.2',
          toolsUsed: ['runFullSwarm', 'getLCR'],
        },
        {
          rank: 5,
          domain: 'Capital Adequacy',
          priorityScore: 7,
          severity: 'LOW',
          finding:
            'Net worth 8.2% — 120bps above 7.0% well-capitalized line. Trend stable QoQ.',
          findingEs:
            'Patrimonio neto 8.2% — 120bps sobre la línea de 7.0% bien capitalizado. Tendencia estable QoQ.',
          dollarImpact: 180000,
          dollarImpactPct: 0.5,
          regulatoryRef: 'NCUA §702.102 + COSSEC Carta Circular 2017-02',
          toolsUsed: ['runFullSwarm', 'getCapitalAdequacy'],
        },
      ],
      decisionQueue: [
        {
          priority: 1,
          action:
            'Shift $12M of 5-year fixed-rate auto loan production to 2-year variable-rate structure within 60 days to bring NII +200bps sensitivity from 5.8% to 4.7%.',
          actionEs:
            'Mover $12M de producción de préstamos auto a tasa fija de 5 años a estructura variable de 2 años dentro de 60 días para bajar la sensibilidad NII +200bps de 5.8% a 4.7%.',
          expectedImpact:
            'NIM +14bps (+$680K annualized); IRR back within COSSEC policy',
          deadline: '60d',
          owner: 'CFO',
          regulatoryRef: 'COSSEC Carta Circular 2021-02 §III.B',
          status: 'PENDING',
        },
        {
          priority: 2,
          action:
            'Cap new auto-loan originations at 30% of total portfolio for 6 months while concentration drifts back under HHI 2,500.',
          actionEs:
            'Limitar nuevas originaciones de préstamos auto al 30% de la cartera total por 6 meses mientras la concentración baja bajo HHI 2,500.',
          expectedImpact:
            'HHI to ~2,420 in 6 months; opens balance-sheet capacity for personal loans',
          deadline: '6mo',
          owner: 'ALM_COMMITTEE',
          regulatoryRef: 'COSSEC Carta Circular 2019-01 §IV',
          status: 'PENDING',
        },
        {
          priority: 3,
          action:
            'Top up CECL allowance by $440K to align with peer median 1.58%; deepen commercial-RE segmentation given 2.1% delinquency trend.',
          actionEs:
            'Aumentar reserva CECL en $440K para alinear con mediana de pares 1.58%; profundizar segmentación de inmobiliario comercial dada tendencia de morosidad 2.1%.',
          expectedImpact:
            'CECL coverage at peer median; commercial-RE risk fully accrued',
          deadline: '30d',
          owner: 'CFO',
          regulatoryRef: 'ASC 326-20',
          status: 'PENDING',
        },
        {
          priority: 4,
          action:
            'Reduce top-15 member exposure to ≤7% of net worth via $1.8M syndication/participation; document COSSEC waiver if needed.',
          actionEs:
            'Reducir exposición top-15 socios a ≤7% del patrimonio neto vía sindicación/participación de $1.8M; documentar exención COSSEC si es necesaria.',
          expectedImpact:
            'Concentration policy compliance; single-name risk to 6.8%',
          deadline: '90d',
          owner: 'CFO',
          regulatoryRef: 'COSSEC Carta Circular 2019-01 §IV',
          status: 'PENDING',
        },
        {
          priority: 5,
          action:
            'Quarterly bilingual board pack — present IRR, concentration, CECL and capital metrics in both Spanish and English (COSSEC examiner expectation).',
          actionEs:
            'Paquete trimestral bilingüe de junta — presentar IRR, concentración, CECL y métricas de capital en español e inglés (expectativa de examinador COSSEC).',
          expectedImpact:
            'COSSEC examiner readiness; member-facing report consistency',
          deadline: '90d',
          owner: 'BOARD',
          regulatoryRef: 'COSSEC Carta Circular 2017-02',
          status: 'PENDING',
        },
      ],
      brief:
        'Interest rate risk is the headline concern. NII +200bps sensitivity at 5.8% exceeds COSSEC policy by 80bps, driven by a −1.4yr repricing gap from 3-5 year fixed auto loans. Concentration in auto (HHI 2,720) compounds the issue. Liquidity (LCR 122%), capital (net worth 8.2%) and credit (CECL coverage 1.42%) are within adequate ranges. Recommended actions: reshape new auto production to 2-year variable, cap auto-loan originations, top up CECL to peer median, syndicate top-15 exposure, and adopt quarterly bilingual board reporting.',
      briefEs:
        'El riesgo de tasa de interés es la preocupación principal. La sensibilidad NII +200bps a 5.8% excede la política COSSEC por 80bps, impulsada por una brecha de repreciación de −1.4yr de los préstamos auto a tasa fija de 3-5 años. La concentración en auto (HHI 2,720) agrava el problema. Liquidez (LCR 122%), capital (patrimonio neto 8.2%) y crédito (cobertura CECL 1.42%) están en rangos adecuados. Acciones recomendadas: reestructurar la nueva producción de auto a variable de 2 años, limitar originaciones de auto, completar CECL a la mediana de pares, sindicar la exposición top-15, y adoptar paquete bilingüe trimestral de junta.',
      auditTraceId: 'eval-trace-010',
    }),
    { inputTokens: 6400, outputTokens: 2100 },
  )

  .build();
