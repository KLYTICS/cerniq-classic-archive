#!/usr/bin/env npx ts-node
/**
 * Agent-eval bless CLI — promote latest results.json into a per-agent
 * baseline.json. This is the manual gate that locks in "the current
 * passing scores are the new floor". Future runs scoring ≥ 5pp below this
 * baseline fail in `npm run agent-eval:gate`.
 *
 * Usage:
 *   npm run agent-eval:bless                  # bless every agent
 *   npm run agent-eval:bless -- --agent ALM_DECISION
 *
 * Prerequisites:
 *   `npm run agent-eval` has been run (so results/*.json exist).
 *
 * Each baseline file matches the EvalBaseline shape:
 *   {
 *     agentId, meanScore, perCase: { caseId: score },
 *     updatedAt, note
 *   }
 *
 * Blessing requires `BLESS_REASON` env var so the rationale is captured —
 * Vol3 §Layer 2 Consistency gate, and so the SESSION_HANDOFF entry has
 * something concrete to quote.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { knownAgentIds } from '../test/agent-evals/script-registry';
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
        [
          'Usage: npm run agent-eval:bless [-- --agent <ID>]',
          '',
          'Promotes test/agent-evals/results/<agent>.json into',
          'test/agent-evals/baselines/<agent>.json. Future regressions ≥ 5pp',
          'below the blessed baseline fail `npm run agent-eval:gate`.',
          '',
          'Env: BLESS_REASON="..." (required) — captured in the baseline note',
          '',
        ].join('\n'),
      );
      process.exit(0);
    }
  }
  return out;
}

function loadResults(agentId: string): EvalResult[] {
  const path = join(RESULTS_DIR, agentId.toLowerCase() + '.json');
  if (!existsSync(path)) {
    throw new Error(
      `no results for ${agentId} at ${path}. Run \`npm run agent-eval\` first.`,
    );
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as EvalResult[];
}

function meanScore(results: EvalResult[]): number {
  if (results.length === 0) return 0;
  return results.reduce((s, r) => s + r.score, 0) / results.length;
}

function buildBaseline(
  agentId: string,
  results: EvalResult[],
  reason: string,
): EvalBaseline {
  const perCase: Record<string, number> = {};
  for (const r of results) perCase[r.caseId] = r.score;
  return {
    agentId,
    meanScore: Math.round(meanScore(results) * 10000) / 10000,
    perCase,
    updatedAt: new Date().toISOString(),
    note: reason,
  };
}

function main() {
  const { agent } = parseArgs(process.argv.slice(2));
  const reason = process.env.BLESS_REASON?.trim();

  if (!reason) {
    console.error(
      'BLESS_REASON env var is required — describe what this baseline\n' +
        'reflects (e.g. "T6.b initial bless after scorer generalization").',
    );
    process.exit(2);
  }

  const agents = agent ? [agent.toUpperCase()] : knownAgentIds();

  mkdirSync(BASELINES_DIR, { recursive: true });

  for (const agentId of agents) {
    const results = loadResults(agentId);
    const baseline = buildBaseline(agentId, results, reason);
    const path = join(BASELINES_DIR, agentId.toLowerCase() + '.json');
    writeFileSync(path, JSON.stringify(baseline, null, 2) + '\n');
    process.stdout.write(
      `✓ blessed ${agentId} → ${path}\n` +
        `   ${results.length} case(s), mean ${(baseline.meanScore * 100).toFixed(1)}%\n`,
    );
  }
}

main();
