// verify:no-orphan-spec-skip — integration-scope: locks contracts + full
// pass-threshold scoring for the 4 LLM scripts under test/agent-evals/cases/
// {cfo-copilot,committee-report,risk-monitor}/*.script.ts. The scoring path
// uses the per-agent adapter + weight registry from test/agent-evals/scoring/
// adapters.ts so non-ALM output shapes (alerts[], sections{}, message+
// followups) are normalised into the ScoreableOutput shape the dimension
// scorers consume.
/**
 * Pass-threshold + contract locks for LLM scripts on cfo-copilot,
 * committee-report, and risk-monitor agent types.
 *
 * Two layers:
 *
 *   1. Contract locks (per script): ends with end_turn, trace length ≥
 *      minToolsCalled, every requiredTool present in the trace, end_turn
 *      payload is valid JSON.
 *
 *   2. Pass-threshold scoring: scoreOffline runs the per-agent adapter
 *      registered in scoring/adapters.ts so cfo-copilot's
 *      {message, followups} becomes a synthetic ScoreableOutput, then
 *      scores ≥ PASS_THRESHOLD (0.8) under the agent's own weight profile
 *      (CFO_COPILOT pins specificity at 45% / dollarQuantification at 0;
 *      COMMITTEE_REPORT pins regulatoryRef at 25%; RISK_MONITOR keeps
 *      ALM-like weights with dollar slightly de-emphasised).
 *
 * If any script's score drops below threshold the breakdown is logged so
 * the failing dimension is named (e.g. "regulatoryRef: 60%").
 */
import { scoreOffline } from '../../test/agent-evals/runner/eval-runner';
import { loadCase } from '../../test/agent-evals/runner/load-case';
import { PASS_THRESHOLD } from '../../test/agent-evals/scoring/weights';
import type { AuditStep } from '../../test/agent-evals/scoring/dimensions';
import type { LLMScript } from '../../test/agent-evals/runner/mock-llm-bridge';
import cfoCopilot001 from '../../test/agent-evals/cases/cfo-copilot/001.script';
import committeeReport001 from '../../test/agent-evals/cases/committee-report/001.script';
import riskMonitor001 from '../../test/agent-evals/cases/risk-monitor/001.script';
import riskMonitor002 from '../../test/agent-evals/cases/risk-monitor/002.script';

function traceFromScript(s: LLMScript): AuditStep[] {
  const steps: AuditStep[] = [];
  for (const turn of s.turns) {
    if (turn.stopReason === 'tool_use') {
      for (const tc of turn.toolCalls) {
        steps.push({
          stepKind: 'TOOL_CALL',
          toolName: tc.name,
          toolOutput: null,
        });
      }
    }
  }
  return steps;
}

function finalOutputText(s: LLMScript): string {
  return s.turns[s.turns.length - 1].text;
}

function finalOutput(s: LLMScript): unknown {
  return JSON.parse(finalOutputText(s));
}

interface CaseRow {
  script: LLMScript;
  agentDir: string;
  caseFile: string;
}

const rows: CaseRow[] = [
  {
    script: cfoCopilot001,
    agentDir: 'cfo-copilot',
    caseFile: '001-rate-shock-200bps.json',
  },
  {
    script: committeeReport001,
    agentDir: 'committee-report',
    caseFile: '001-board-bilingual.json',
  },
  {
    script: riskMonitor001,
    agentDir: 'risk-monitor',
    caseFile: '001-quiet-run.json',
  },
  {
    script: riskMonitor002,
    agentDir: 'risk-monitor',
    caseFile: '002-critical-lcr-breach.json',
  },
];

describe('LLM script contracts + scoring — non-ALM agent types', () => {
  // ─── Contract locks ───────────────────────────────────────────────────────

  it.each(rows)('$script.caseId ends with end_turn', ({ script }) => {
    const last = script.turns[script.turns.length - 1];
    expect(last.stopReason).toBe('end_turn');
  });

  it.each(rows)(
    '$script.caseId trace length ≥ minToolsCalled',
    ({ script, agentDir, caseFile }) => {
      const goldenCase = loadCase(agentDir, caseFile);
      const trace = traceFromScript(script);
      const min = goldenCase.expectedFindings.minToolsCalled ?? 6;
      expect(trace.length).toBeGreaterThanOrEqual(min);
    },
  );

  it.each(rows)(
    '$script.caseId calls every requiredTool',
    ({ script, agentDir, caseFile }) => {
      const goldenCase = loadCase(agentDir, caseFile);
      const called = new Set(traceFromScript(script).map((s) => s.toolName));
      const required = goldenCase.expectedFindings.requiredTools ?? [];
      for (const tool of required) {
        expect(called.has(tool)).toBe(true);
      }
    },
  );

  it.each(rows)(
    '$script.caseId end_turn payload is valid JSON',
    ({ script }) => {
      const text = finalOutputText(script);
      expect(() => JSON.parse(text)).not.toThrow();
    },
  );

  // ─── Pass-threshold scoring (post-T6.b adapter registry) ──────────────────

  it.each(rows)(
    '$script.caseId scores ≥ PASS_THRESHOLD under its agent-type weights',
    ({ script, agentDir, caseFile }) => {
      const goldenCase = loadCase(agentDir, caseFile);
      const result = scoreOffline({
        goldenCase,
        actualOutput: finalOutput(script),
        auditTrace: traceFromScript(script),
      });
      if (!result.pass) {
        const lines = Object.entries(result.breakdown).map(
          ([dim, info]) =>
            `  ${dim}: ${(info.score * 100).toFixed(0)}% (weight ${(
              info.weight * 100
            ).toFixed(0)}%) — ${info.evidence.join('; ')}`,
        );
        throw new Error(
          `${script.caseId} scored ${(result.score * 100).toFixed(1)}% (< ${(
            PASS_THRESHOLD * 100
          ).toFixed(0)}%):\n${lines.join('\n')}`,
        );
      }
      expect(result.score).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    },
  );
});
