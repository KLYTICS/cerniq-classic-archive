#!/usr/bin/env npx ts-node
/**
 * Agent-eval CLI — run scoreOffline against every registered LLM script and
 * produce a per-agent scorecard + machine-readable results files.
 *
 * Usage:
 *   npm run agent-eval                  # score every script, write results files
 *   npm run agent-eval -- --agent ALM_DECISION   # score one agent type
 *   npm run agent-eval -- --json       # print results JSON to stdout (no banner)
 *   npm run agent-eval -- --quiet      # exit code only (CI)
 *
 * Outputs (one file per agent type):
 *   test/agent-evals/results/<agent-id-lowercased>.json
 *
 * Each output is an array of `EvalResult` matching fixture-types.ts. The
 * regression-gate.ts consumer reads these via CERNIQ_EVAL_RESULTS.
 *
 * Exit codes:
 *   0   every script scored ≥ PASS_THRESHOLD (0.8)
 *   1   at least one script failed
 *   2   args/IO error
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SCRIPT_REGISTRY,
  scriptsForAgent,
  knownAgentIds,
  type ScriptRegistryEntry,
} from '../test/agent-evals/script-registry';
import {
  scoreOffline,
  printScorecard,
} from '../test/agent-evals/runner/eval-runner';
import { loadCase } from '../test/agent-evals/runner/load-case';
import { PASS_THRESHOLD } from '../test/agent-evals/scoring/weights';
import type { AuditStep } from '../test/agent-evals/scoring/dimensions';
import type { LLMScript } from '../test/agent-evals/runner/mock-llm-bridge';
import type { EvalResult } from '../test/agent-evals/runner/fixture-types';

const RESULTS_DIR = join(__dirname, '..', 'test', 'agent-evals', 'results');

interface Args {
  agent?: string;
  json: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { json: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agent') args.agent = argv[++i];
    else if (a === '--json') args.json = true;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      printHelp();
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: npm run agent-eval [-- --agent <ID>] [-- --json] [-- --quiet]',
      '',
      'Runs scoreOffline against every registered LLM script and writes',
      'per-agent results to test/agent-evals/results/<agent>.json.',
      '',
      'Options:',
      '  --agent <ID>   Score only one agent type (e.g. ALM_DECISION)',
      '  --json         Print the merged results JSON to stdout (no banner)',
      '  --quiet        Suppress scorecard banner — exit code only',
      '  -h, --help     Show this help',
      '',
    ].join('\n'),
  );
}

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

function finalOutput(s: LLMScript): unknown {
  return JSON.parse(s.turns[s.turns.length - 1].text);
}

function scoreEntry(entry: ScriptRegistryEntry): EvalResult {
  const goldenCase = loadCase(entry.agentDir, entry.caseFile);
  return scoreOffline({
    goldenCase,
    actualOutput: finalOutput(entry.script),
    auditTrace: traceFromScript(entry.script),
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const entries = args.agent
    ? scriptsForAgent(args.agent.toUpperCase())
    : SCRIPT_REGISTRY;

  if (entries.length === 0) {
    console.error(
      `no scripts registered${args.agent ? ` for agent "${args.agent}"` : ''}`,
    );
    console.error(`known agents: ${knownAgentIds().join(', ')}`);
    process.exit(2);
  }

  // Group by agentId so each agent gets its own results file.
  const byAgent = new Map<string, EvalResult[]>();
  for (const entry of entries) {
    const result = scoreEntry(entry);
    if (!byAgent.has(entry.agentId)) byAgent.set(entry.agentId, []);
    byAgent.get(entry.agentId)!.push(result);
  }

  // Always write the results files unless --json (then stdout is the
  // machine-readable artifact). The regression-gate.ts consumer reads
  // CERNIQ_EVAL_RESULTS=<path>.
  if (!args.json) {
    mkdirSync(RESULTS_DIR, { recursive: true });
    for (const [agentId, results] of byAgent) {
      const fname = agentId.toLowerCase() + '.json';
      writeFileSync(
        join(RESULTS_DIR, fname),
        JSON.stringify(results, null, 2) + '\n',
      );
    }
  }

  // Stdout: either banner-style scorecard or raw JSON.
  if (args.json) {
    const flat: EvalResult[] = [];
    for (const results of byAgent.values()) flat.push(...results);
    process.stdout.write(JSON.stringify(flat, null, 2));
  } else if (!args.quiet) {
    for (const [agentId, results] of byAgent) {
      process.stdout.write(`\nAgent: ${agentId}`);
      printScorecard(results);
    }
  }

  // Exit code reflects whether every script passed.
  const allResults: EvalResult[] = [];
  for (const r of byAgent.values()) allResults.push(...r);
  const allPass = allResults.every((r) => r.score >= PASS_THRESHOLD);
  process.exit(allPass ? 0 : 1);
}

main();
