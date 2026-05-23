import { script } from '../../runner/mock-llm-bridge';

/**
 * Scripted LLM replay for case copilot-001: CFO asks "What happens if rates
 * rise 200bps?" — the core CFO Copilot value-prop case.
 *
 * Output shape: CFOCopilotOutputSchema (src/agents/contracts/cfo-copilot.contracts.ts)
 *   - agentId, runId, institutionId, sessionId, language
 *   - message (≤ 300 words, English here)
 *   - followups (exactly 4, each with {en, es})
 *   - toolsCalled
 *
 * Turn sequence:
 *   1. runRateShock at [200] (the gating tool)
 *   2. getRepricingGap (context for the message)
 *   3. final output (end_turn) — CFOCopilot JSON
 *
 * 2 tool calls — meets minToolsCalled=2 in 001.json.
 * Required tools per JSON: runRateShock. Bilingual NOT required.
 */
export default script()
  .forCase('copilot-001', 'CFO copilot — +200bps rate-shock question — 3-turn')

  .addToolUseTurn(
    [
      {
        id: 'tc_001',
        name: 'runRateShock',
        input: { institutionId: 'golden-inst-001', shockBps: [200] },
      },
    ],
    { inputTokens: 2800, outputTokens: 110 },
  )

  .addToolUseTurn(
    [
      {
        id: 'tc_002',
        name: 'getRepricingGap',
        input: { institutionId: 'golden-inst-001' },
      },
    ],
    { inputTokens: 3600, outputTokens: 80 },
  )

  .addEndTurn(
    JSON.stringify({
      agentId: 'cfo_copilot',
      runId: 'eval-copilot-001',
      institutionId: 'golden-inst-001',
      sessionId: 'eval-session-copilot-001',
      language: 'en',
      message:
        "A +200bps rate shock would compress NII by 6.2% — about $2.1M annualized — driven by a −1.8yr duration gap from 3–5 year fixed-rate auto loans. That exceeds the institution's COSSEC IRR policy limit of 5.5%. To bring sensitivity back inside policy, the highest-leverage move is to shift roughly $15M of new auto-loan production from 5-year fixed to 1–2 year variable structures, which closes about 1.2yr of the duration mismatch and contributes ~$840K of annualized NIM benefit. A smaller HQLA top-up of $2M via Treasury bills lifts LCR from 112% to ~121% and adds a modest IRR cushion. Capital is adequate at 7.4% net worth, so the constraint here is IRR policy, not regulatory capital.",
      followups: [
        {
          en: 'What if rates fall 100bps instead?',
          es: '¿Qué pasa si las tasas bajan 100bps?',
        },
        {
          en: 'Show me the auto-loan duration heatmap',
          es: 'Muéstrame el mapa de calor de duración de préstamos auto',
        },
        {
          en: 'Estimate the cost of shifting $15M to 2-year variable',
          es: 'Estimar el costo de mover $15M a variable a 2 años',
        },
        {
          en: 'What is the peer median NII sensitivity at +200bps?',
          es: '¿Cuál es la sensibilidad NII +200bps de la mediana de pares?',
        },
      ],
      toolsCalled: ['runRateShock', 'getRepricingGap'],
    }),
    { inputTokens: 4400, outputTokens: 900 },
  )

  .build();
