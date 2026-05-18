// verify:no-orphan-spec-skip — integration-scope: locks pass-threshold for
// 5 LLM script fixtures under test/agent-evals/cases/alm-decision/. There is
// no single source module to pair against; the "subject" is the bundle of
// scripts + their golden cases.
/**
 * Pass-threshold lock for LLM scripts 006-010.
 *
 * Each script in test/agent-evals/cases/alm-decision/00{6,7,8,9}.script.ts +
 * 010.script.ts must score ≥ 0.8 (PASS_THRESHOLD) against its paired golden
 * case when fed through scoreOffline. The trace is synthesized from each
 * script's tool_use turns; the output is parsed from the final end_turn.
 *
 * This is the unit-level guarantee that the scripts are well-formed and
 * scoreable. The full deterministic-replay path (MockLlmBridge →
 * AgentRunnerService → scoreOffline) lands when a future T6.b wires the
 * NestJS integration; until then, these specs lock the contract for the
 * 5 scripts authored in the T6 closure (2026-05-17).
 */
import { scoreOffline } from '../../test/agent-evals/runner/eval-runner';
import { loadCase } from '../../test/agent-evals/runner/load-case';
import { PASS_THRESHOLD } from '../../test/agent-evals/scoring/weights';
import type { AuditStep } from '../../test/agent-evals/scoring/dimensions';
import type { LLMScript } from '../../test/agent-evals/runner/mock-llm-bridge';
import script006 from '../../test/agent-evals/cases/alm-decision/006.script';
import script007 from '../../test/agent-evals/cases/alm-decision/007.script';
import script008 from '../../test/agent-evals/cases/alm-decision/008.script';
import script009 from '../../test/agent-evals/cases/alm-decision/009.script';
import script010 from '../../test/agent-evals/cases/alm-decision/010.script';

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

function finalOutputFromScript(s: LLMScript): unknown {
  const last = s.turns[s.turns.length - 1];
  return JSON.parse(last.text);
}

interface CaseRow {
  script: LLMScript;
  caseFile: string;
}

const rows: CaseRow[] = [
  { script: script006, caseFile: '006-deposit-flight-scenario.json' },
  { script: script007, caseFile: '007-earlywarning-composite-amber.json' },
  { script: script008, caseFile: '008-balanced-healthy-benchmark.json' },
  { script: script009, caseFile: '009-hurricane-pr-catastrophic-overlay.json' },
  { script: script010, caseFile: '010-bilingual-pr-cooperativa.json' },
];

describe('LLM scripts 006-010 score above PASS_THRESHOLD', () => {
  it.each(rows)(
    '$script.caseId scores >= PASS_THRESHOLD',
    ({ script, caseFile }) => {
      const goldenCase = loadCase('alm-decision', caseFile);
      const result = scoreOffline({
        goldenCase,
        actualOutput: finalOutputFromScript(script),
        auditTrace: traceFromScript(script),
      });
      if (!result.pass) {
        const lines = Object.entries(result.breakdown).map(
          ([dim, info]) =>
            `  ${dim}: ${(info.score * 100).toFixed(0)}% — ${info.evidence.join('; ')}`,
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

  it('every script ends with end_turn (ScriptBuilder contract)', () => {
    for (const { script } of rows) {
      const last = script.turns[script.turns.length - 1];
      expect(last.stopReason).toBe('end_turn');
    }
  });

  it('every script meets its case minToolsCalled count', () => {
    for (const { script, caseFile } of rows) {
      const goldenCase = loadCase('alm-decision', caseFile);
      const trace = traceFromScript(script);
      const min = goldenCase.expectedFindings.minToolsCalled ?? 6;
      expect(trace.length).toBeGreaterThanOrEqual(min);
    }
  });

  it('every script calls every required tool in its case', () => {
    for (const { script, caseFile } of rows) {
      const goldenCase = loadCase('alm-decision', caseFile);
      const trace = traceFromScript(script);
      const called = new Set(trace.map((s) => s.toolName));
      const required = goldenCase.expectedFindings.requiredTools ?? [];
      for (const tool of required) {
        expect(called.has(tool)).toBe(true);
      }
    }
  });
});
