import { script } from '../../runner/mock-llm-bridge';

/**
 * Scripted LLM replay for case rm-001: Quiet run — silence is signal.
 *
 * All metrics within thresholds. Agent must return alerts: [], quietRun: true.
 * Locks the contract that risk-monitor does NOT fabricate alerts when none
 * are warranted — the opposite failure mode (false positive) is worse than
 * a quiet run because it consumes operator attention.
 *
 * Output shape: RiskMonitorOutputSchema (src/agents/contracts/risk-monitor.contracts.ts)
 *   - agentId, runId, institutionId, scanKind
 *   - alerts: [] (empty for quiet run)
 *   - alertCount: 0 (mirrors alerts.length)
 *   - quietRun: true (always true when no CRITICAL/HIGH alerts)
 *
 * Turn sequence:
 *   1. getLCR + getCapitalAdequacy (the two required tools)
 *   2. getCECL + getConcentration (4 total = minToolsCalled hit)
 *   3. final output (end_turn) — empty alerts
 *
 * 4 tool calls — meets minToolsCalled=4 in 001.json.
 * Required tools: getLCR, getCapitalAdequacy. Bilingual NOT required.
 */
export default script()
  .forCase('rm-001', 'Risk monitor — quiet run — 3-turn')

  .addToolUseTurn(
    [
      {
        id: 'tc_001',
        name: 'getLCR',
        input: { institutionId: 'golden-inst-002' },
      },
      {
        id: 'tc_002',
        name: 'getCapitalAdequacy',
        input: { institutionId: 'golden-inst-002' },
      },
    ],
    { inputTokens: 2800, outputTokens: 100 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_003',
        name: 'getCECL',
        input: { institutionId: 'golden-inst-002' },
      },
      {
        id: 'tc_004',
        name: 'getConcentration',
        input: { institutionId: 'golden-inst-002' },
      },
    ],
    { inputTokens: 3600, outputTokens: 80 },
  )

  .addEndTurn(
    JSON.stringify({
      agentId: 'risk_monitor',
      runId: 'eval-rm-001',
      institutionId: 'golden-inst-002',
      scanKind: 'daily',
      alerts: [],
      alertCount: 0,
      quietRun: true,
    }),
    { inputTokens: 4200, outputTokens: 60 },
  )

  .build();
