import { script } from '../../runner/mock-llm-bridge';

/**
 * Scripted LLM replay for case rm-002: Critical LCR breach.
 *
 * LCR dropped to 94% (below 100% regulatory minimum). HQLA depleted by
 * $3.2M outflow. NSFR still above 100% at 104%. The agent must produce a
 * CRITICAL alert on liquidity with regulatory ref to COSSEC Reg. 8866 and
 * a 30-day deadline. Tests that the agent correctly escalates regulatory
 * breaches (must-act) vs policy breaches (should-act).
 *
 * Output shape: RiskMonitorOutputSchema (src/agents/contracts/risk-monitor.contracts.ts)
 *   - alerts[] populated with at least one CRITICAL liquidity alert
 *   - alertCount mirrors alerts.length
 *   - quietRun: false (since CRITICAL alerts present)
 *   - Each alert: category, severity, metric, currentValue, threshold,
 *     delta, trend, finding, findingEs, recommendation, regulatoryRef,
 *     deadline (ISO date), dedupSeed
 *
 * Turn sequence:
 *   1. getLCR + getNSFR (the headline metrics)
 *   2. getCapitalAdequacy (knock-on capital check)
 *   3. getCECL + getConcentration (5 total tools = minToolsCalled hit)
 *   4. final output (end_turn)
 *
 * 5 tool calls — meets minToolsCalled=5 in 002.json.
 * Required tools: getLCR, getNSFR, getCapitalAdequacy. Bilingual required.
 */
export default script()
  .forCase('rm-002', 'Risk monitor — critical LCR breach — 4-turn')

  .addToolUseTurn(
    [
      {
        id: 'tc_001',
        name: 'getLCR',
        input: { institutionId: 'golden-inst-004' },
      },
      {
        id: 'tc_002',
        name: 'getNSFR',
        input: { institutionId: 'golden-inst-004' },
      },
    ],
    { inputTokens: 2800, outputTokens: 110 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_003',
        name: 'getCapitalAdequacy',
        input: { institutionId: 'golden-inst-004' },
      },
    ],
    { inputTokens: 3600, outputTokens: 70 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_004',
        name: 'getCECL',
        input: { institutionId: 'golden-inst-004' },
      },
      {
        id: 'tc_005',
        name: 'getConcentration',
        input: { institutionId: 'golden-inst-004' },
      },
    ],
    { inputTokens: 4200, outputTokens: 80 },
  )

  .addEndTurn(
    JSON.stringify({
      agentId: 'risk_monitor',
      runId: 'eval-rm-002',
      institutionId: 'golden-inst-004',
      scanKind: 'daily',
      alerts: [
        {
          category: 'liquidity',
          severity: 'CRITICAL',
          metric: 'Liquidity Coverage Ratio',
          currentValue: 94,
          threshold: 100,
          delta: -6,
          trend: 'worsening',
          finding:
            'LCR 94% — 6pp below COSSEC regulatory minimum of 100%. HQLA depleted by $3.2M of net deposit outflow over 14 days. NSFR 104% still above floor but trending down. Mandatory regulator notification + 30-day cure period under COSSEC Reg. 8866.',
          findingEs:
            'LCR 94% — 6pp bajo el mínimo regulatorio COSSEC de 100%. HQLA agotado por $3.2M de salida neta de depósitos en 14 días. NSFR 104% aún sobre piso pero con tendencia a la baja. Notificación obligatoria al regulador + período de cura de 30 días bajo COSSEC Reg. 8866.',
          recommendation:
            'File COSSEC Form L-2 within 5 business days; pre-draw $4M FHLB advance to restore LCR to 112%; freeze new commercial commitments; daily LCR reporting to ALCO until cured.',
          regulatoryRef: 'COSSEC Reg. 8866 §7.2',
          deadline: '2026-06-16',
          dedupSeed: 'liquidity-lcr-breach-2026-Q2',
        },
        {
          category: 'liquidity',
          severity: 'HIGH',
          metric: 'Net Stable Funding Ratio',
          currentValue: 104,
          threshold: 110,
          delta: -6,
          trend: 'worsening',
          finding:
            'NSFR 104% — above 100% regulatory floor but 6pp below 110% internal policy. Funding-side erosion correlated with LCR breach above; combined funding-stress profile.',
          findingEs:
            'NSFR 104% — sobre piso regulatorio 100% pero 6pp bajo política interna 110%. Erosión de fondeo correlacionada con la brecha LCR; perfil de estrés de fondeo combinado.',
          recommendation:
            'Lock 12-month member CD special at +30bps over peer; lift core-deposit retention via dedicated campaign; cap brokered-CD share at current level.',
          regulatoryRef: 'COSSEC Reg. 8866 §7.2 + Basel NSFR §10',
          deadline: '2026-07-01',
          dedupSeed: 'liquidity-nsfr-policy-2026-Q2',
        },
        {
          category: 'capital',
          severity: 'MEDIUM',
          metric: 'Net Worth Ratio',
          currentValue: 7.1,
          threshold: 7.0,
          delta: 0.1,
          trend: 'stable',
          finding:
            'Net worth 7.1% — 10bps above well-capitalized line. Under +200bps rate shock + 5% deposit outflow stress, modeled net worth drops to 6.6% (adequately capitalized).',
          findingEs:
            'Patrimonio neto 7.1% — 10bps sobre línea bien capitalizada. Bajo escenario +200bps + 5% salida de depósitos, patrimonio modelado cae a 6.6% (adecuadamente capitalizado).',
          recommendation:
            'Suspend discretionary dividend until LCR cure complete; review capital plan with $1M subordinated debt option as buffer.',
          regulatoryRef: 'NCUA §702.102',
          deadline: '2026-07-15',
          dedupSeed: 'capital-net-worth-watch-2026-Q2',
        },
      ],
      alertCount: 3,
      quietRun: false,
    }),
    { inputTokens: 5800, outputTokens: 1400 },
  )

  .build();
