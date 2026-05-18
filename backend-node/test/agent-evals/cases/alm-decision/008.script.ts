import { script } from '../../runner/mock-llm-bridge';

/**
 * Scripted LLM replay for case 008: Balanced healthy institution (pass-case).
 *
 * Tests that the agent does NOT fabricate risks when the institution is
 * well-managed. NII sensitivity within policy, LCR 135%, CAMEL 2, no
 * concentration breaches. Only 1 MEDIUM finding expected. topRiskDomain
 * is null (no headline risk to elevate).
 *
 * Turn sequence is the long form — the agent still runs the full battery
 * because the customer expects evidence of due diligence even on green runs.
 *
 *   1. runFullSwarm
 *   2. getLCR + getCapitalAdequacy
 *   3. getRepricingGap + getConcentration
 *   4. getCECL + getPeerBenchmark
 *   5. final output (end_turn)
 *
 * 7 tool calls; required tool: runFullSwarm only. Bilingual NOT required.
 */
export default script()
  .forCase('alm-008', 'Balanced healthy institution — pass case — 5-turn')

  .addToolUseTurn(
    [
      {
        id: 'tc_001',
        name: 'runFullSwarm',
        input: { institutionId: 'golden-inst-002' },
      },
    ],
    { inputTokens: 3200, outputTokens: 140 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_002',
        name: 'getLCR',
        input: { institutionId: 'golden-inst-002' },
      },
      {
        id: 'tc_003',
        name: 'getCapitalAdequacy',
        input: { institutionId: 'golden-inst-002' },
      },
    ],
    { inputTokens: 4600, outputTokens: 110 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_004',
        name: 'getRepricingGap',
        input: { institutionId: 'golden-inst-002' },
      },
      {
        id: 'tc_005',
        name: 'getConcentration',
        input: { institutionId: 'golden-inst-002' },
      },
    ],
    { inputTokens: 5400, outputTokens: 90 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_006',
        name: 'getCECL',
        input: { institutionId: 'golden-inst-002' },
      },
      {
        id: 'tc_007',
        name: 'getPeerBenchmark',
        input: { institutionId: 'golden-inst-002' },
      },
    ],
    { inputTokens: 5800, outputTokens: 80 },
  )

  .addEndTurn(
    JSON.stringify({
      agentId: 'alm_decision',
      version: '2.0',
      runId: 'eval-008',
      institutionId: 'golden-inst-002',
      timestamp: '2026-04-15T10:00:00.000Z',
      language: 'en',
      healthSnapshot: {
        overall: 87,
        capital: 92,
        liquidity: 88,
        rateRisk: 84,
        credit: 86,
        concentration: 85,
        label: 'HEALTHY',
        trend: 'stable',
      },
      topRisks: [
        {
          rank: 1,
          domain: 'Interest Rate Risk',
          priorityScore: 8,
          severity: 'MEDIUM',
          finding:
            'NII +200bps sensitivity at 3.9% — within 5.5% policy and well below 4.5% internal target. Repricing gap −0.4yr, modest. Watch-item only; not a current action driver but the only finding above LOW severity.',
          findingEs:
            'Sensibilidad NII +200bps a 3.9% — dentro de política de 5.5% y bajo objetivo interno de 4.5%. Brecha de repreciación −0.4yr, modesta. Solo punto de observación; no impulsa acción actual pero es el único hallazgo sobre severidad BAJA.',
          dollarImpact: 580000,
          dollarImpactPct: 1.7,
          regulatoryRef: 'COSSEC Carta Circular 2021-02 §III.B',
          toolsUsed: ['runFullSwarm', 'getRepricingGap'],
        },
      ],
      decisionQueue: [
        {
          priority: 1,
          action:
            'Maintain current ALM posture; reaffirm quarterly stress-testing cadence with +200bps / −100bps / hurricane overlay scenarios.',
          actionEs:
            'Mantener postura ALM actual; reafirmar cadencia trimestral de pruebas de estrés con escenarios +200bps / −100bps / huracán.',
          expectedImpact:
            'Continued CAMEL 2 standing; LCR/NWR cushions preserved',
          deadline: '90d',
          owner: 'ALM_COMMITTEE',
          regulatoryRef: 'COSSEC Carta Circular 2021-02',
          status: 'PENDING',
        },
        {
          priority: 2,
          action:
            'Opportunistic: shift $4M of new auto-loan originations to 2-year variable to tighten repricing gap toward −0.2yr.',
          actionEs:
            'Oportunístico: mover $4M de nuevas originaciones de préstamos auto a 2 años variable para cerrar brecha hacia −0.2yr.',
          expectedImpact: '+4bps NIM (+$160K annualized); not urgent',
          deadline: '180d',
          owner: 'CFO',
          regulatoryRef: 'COSSEC Carta Circular 2021-02',
          status: 'PENDING',
        },
      ],
      brief:
        'The institution is in a healthy, balanced posture. Composite health score 87/100, CAMEL 2, LCR 135%, net worth ratio 9.4% (well above 7.0% threshold), and CECL coverage at the peer median. The only finding above LOW severity is a modest +200bps NII sensitivity at 3.9%, well within policy. Recommended actions are maintenance — stay the course on quarterly stress testing and an opportunistic 4M repricing-gap tightening when new auto-loan demand permits.',
      briefEs:
        'La institución mantiene una postura saludable y balanceada. Puntaje compuesto 87/100, CAMEL 2, LCR 135%, razón de patrimonio neto 9.4% (muy sobre el umbral de 7.0%), y cobertura CECL en la mediana de pares. El único hallazgo sobre severidad BAJA es una sensibilidad +200bps modesta a 3.9%, bien dentro de política. Acciones recomendadas son de mantenimiento — continuar pruebas de estrés trimestrales y un cierre oportunístico de brecha de repreciación de 4M.',
      auditTraceId: 'eval-trace-008',
    }),
    { inputTokens: 6200, outputTokens: 1400 },
  )

  .build();
