#!/usr/bin/env npx ts-node
/**
 * Agent-eval gate CLI — compares every agent's latest results.json against
 * its blessed baseline.json. Exit codes:
 *
 *   0   every agent's mean score ≥ PASS_THRESHOLD (0.8) AND no agent
 *       dropped by ≥ REGRESSION_DROP_THRESHOLD (0.05) since last bless.
 *   1   at least one agent below threshold or regressed.
 *   2   args/IO error (missing results, missing baseline).
 *
 * Usage:
 *   npm run agent-eval:gate                  # check every agent
 *   npm run agent-eval:gate -- --agent ALM_DECISION
 *
 * Prerequisites:
 *   `npm run agent-eval` has been run (so results/*.json exist).
 *   `npm run agent-eval:bless` has been run at least once for the agent
 *   (so baselines/*.json exists with non-empty perCase).
 *
 * The companion `runner/regression-gate.ts` script implements the same
 * semantics for a single agent via CERNIQ_EVAL_RESULTS + CERNIQ_EVAL_BASELINE
 * env vars (legacy CI shape, dist/ compiled). This wrapper iterates over
 * every registered agent without env-var ceremony.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { knownAgentIds } from '../test/agent-evals/script-registry';
import {
  PASS_THRESHOLD,
  REGRESSION_DROP_THRESHOLD,
} from '../test/agent-evals/scoring/weights';
import type {
  EvalResult,
  EvalBaseline,
} from '../test/agent-evals/runner/fixture-types';

const RESULTS_DIR = join(__dirname, '..', 'test', 'agent-evals', 'results');
const BASELINES_DIR = join(__dirname, '..', 'test', 'agent-evals', 'baselines');

function parseArgs(argv: string[]): { agent?: string } {
  const out: { agent?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agent') out.agent = argv[++i];
    else if (a === '-h' || a === '--help') {
      process.stdout.write(
        'Usage: npm run agent-eval:gate [-- --agent <ID>]\n',
      );
      process.exit(0);
    }
  }
  return out;
}

function mean(results: EvalResult[]): number {
  if (results.length === 0) return 0;
  return results.reduce((s, r) => s + r.score, 0) / results.length;
}

interface AgentGateResult {
  agentId: string;
  cases: number;
  currentMean: number;
  baselineMean: number;
  drop: number;
  underThreshold: boolean;
  regressed: boolean;
  perCaseRegressions: Array<{
    caseId: string;
    current: number;
    baseline: number;
    drop: number;
  }>;
}

function gateOne(agentId: string): AgentGateResult {
  const resultsPath = join(RESULTS_DIR, agentId.toLowerCase() + '.json');
  const baselinePath = join(BASELINES_DIR, agentId.toLowerCase() + '.json');

  if (!existsSync(resultsPath)) {
    throw new Error(
      `no results for ${agentId} at ${resultsPath}. Run \`npm run agent-eval\` first.`,
    );
  }

  const results: EvalResult[] = JSON.parse(readFileSync(resultsPath, 'utf-8'));
  const currentMean = mean(results);

  let baselineMean = 0;
  const perCaseRegressions: AgentGateResult['perCaseRegressions'] = [];

  if (existsSync(baselinePath)) {
    const baseline: EvalBaseline = JSON.parse(
      readFileSync(baselinePath, 'utf-8'),
    );
    baselineMean = baseline.meanScore;

    // Per-case drop detection: even if the overall mean is fine, a single
    // case dropping by ≥ REGRESSION_DROP_THRESHOLD is a regression worth
    // surfacing. The overall mean might mask it if other cases compensate.
    for (const r of results) {
      const prev = baseline.perCase[r.caseId];
      if (typeof prev !== 'number') continue;
      const drop = prev - r.score;
      if (drop >= REGRESSION_DROP_THRESHOLD) {
        perCaseRegressions.push({
          caseId: r.caseId,
          current: r.score,
          baseline: prev,
          drop,
        });
      }
    }
  }

  const drop = baselineMean - currentMean;
  const underThreshold = currentMean < PASS_THRESHOLD;
  const regressed =
    drop >= REGRESSION_DROP_THRESHOLD || perCaseRegressions.length > 0;

  return {
    agentId,
    cases: results.length,
    currentMean,
    baselineMean,
    drop,
    underThreshold,
    regressed,
    perCaseRegressions,
  };
}

function main() {
  const { agent } = parseArgs(process.argv.slice(2));
  const agents = agent ? [agent.toUpperCase()] : knownAgentIds();

  process.stdout.write('\n  Agent Eval Gate\n');
  process.stdout.write('  ═══════════════════════════════════\n');

  let anyFail = false;
  for (const agentId of agents) {
    let result: AgentGateResult;
    try {
      result = gateOne(agentId);
    } catch (err) {
      console.error(`  ✗ ${agentId}: ${(err as Error).message}`);
      anyFail = true;
      continue;
    }

    const isFirstRun = result.baselineMean === 0;
    const dropPct = (result.drop * 100).toFixed(1);
    const meanPct = (result.currentMean * 100).toFixed(1);
    const baselinePct = (result.baselineMean * 100).toFixed(1);

    process.stdout.write(
      `  ${agentId.padEnd(20)} ` +
        `cases=${result.cases.toString().padStart(2)}  ` +
        `mean=${meanPct.padStart(5)}%  ` +
        (isFirstRun
          ? '(no baseline — first run)'
          : `baseline=${baselinePct}%  drop=${dropPct}pp`) +
        '\n',
    );

    if (result.underThreshold) {
      console.error(
        `     ❌ BELOW THRESHOLD: ${meanPct}% < ${(PASS_THRESHOLD * 100).toFixed(0)}%`,
      );
      anyFail = true;
    }
    if (result.regressed) {
      console.error(
        `     ❌ REGRESSION: drop ${dropPct}pp ≥ ${(REGRESSION_DROP_THRESHOLD * 100).toFixed(0)}pp`,
      );
      for (const r of result.perCaseRegressions) {
        console.error(
          `        · ${r.caseId}: ${(r.current * 100).toFixed(1)}% (was ${(r.baseline * 100).toFixed(1)}%, drop ${(r.drop * 100).toFixed(1)}pp)`,
        );
      }
      anyFail = true;
    }
  }

  process.stdout.write('  ═══════════════════════════════════\n');
  if (anyFail) {
    process.stdout.write('  ⚠ AGENT EVAL GATE FAILED\n\n');
    process.exit(1);
  }
  process.stdout.write('  ✓ AGENT EVAL GATE PASSED\n\n');
  process.exit(0);
}

main();
