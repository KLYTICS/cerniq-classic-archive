// verify:no-orphan-spec-skip — integration-scope: locks the regression-gate
// mechanism in scripts/agent-eval-gate.ts. Exercises the script as a
// subprocess against a temporary results/baseline pair so the test is
// faithful to what CI runs.
/**
 * Locks the regression-gate semantics:
 *
 *   - drop ≥ REGRESSION_DROP_THRESHOLD (0.05) triggers regression failure
 *   - drop < REGRESSION_DROP_THRESHOLD passes
 *   - mean < PASS_THRESHOLD (0.8) triggers under-threshold failure
 *   - missing baseline (first-time run) prints "no baseline" but doesn't fail
 *   - per-case drop ≥ 5pp triggers failure even if overall mean is fine
 *
 * The gate is tested by writing a fake results.json + baseline.json into a
 * temp dir, then invoking the gate via `npx ts-node` with --agent set to a
 * synthetic agentId. The script reads from a fixed path (results/<agent>.json),
 * so the test stages files into the real results/ + baselines/ directories
 * under a "TEST_REGRESSION_GATE_*" prefix that won't collide with real agents.
 *
 * Cleanup happens in afterAll — the staged files are deleted.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BACKEND_ROOT = join(__dirname, '..', '..');
const RESULTS_DIR = join(BACKEND_ROOT, 'test', 'agent-evals', 'results');
const BASELINES_DIR = join(BACKEND_ROOT, 'test', 'agent-evals', 'baselines');
const GATE_SCRIPT = join(BACKEND_ROOT, 'scripts', 'agent-eval-gate.ts');

// Synthetic agentId — won't collide with any real agent in the registry,
// because knownAgentIds() reads from script-registry.ts. We bypass that by
// passing --agent <SYNTH> directly to the script.
const SYNTH_AGENT = 'TEST_REGRESSION_GATE_SYNTH';
const SYNTH_LC = SYNTH_AGENT.toLowerCase();

const resultsPath = join(RESULTS_DIR, SYNTH_LC + '.json');
const baselinePath = join(BASELINES_DIR, SYNTH_LC + '.json');

function stageResults(scores: Record<string, number>) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const results = Object.entries(scores).map(([caseId, score]) => ({
    caseId,
    caseName: caseId,
    agentId: SYNTH_AGENT,
    score,
    pass: score >= 0.8,
    breakdown: {},
    durationMs: 0,
    toolsCalled: [],
  }));
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
}

function stageBaseline(scores: Record<string, number>) {
  mkdirSync(BASELINES_DIR, { recursive: true });
  const meanScore =
    Object.values(scores).reduce((a, b) => a + b, 0) /
    Math.max(Object.keys(scores).length, 1);
  const baseline = {
    agentId: SYNTH_AGENT,
    meanScore,
    perCase: scores,
    updatedAt: new Date().toISOString(),
    note: 'test fixture',
  };
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
}

function clearBaseline() {
  // Some sandbox mounts disallow unlink; write a sentinel baseline with
  // meanScore=0 + empty perCase instead — the gate treats this as a
  // first-run / no-baseline state because the `isFirstRun` branch keys on
  // baselineMean === 0.
  mkdirSync(BASELINES_DIR, { recursive: true });
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        agentId: SYNTH_AGENT,
        meanScore: 0,
        perCase: {},
        updatedAt: new Date().toISOString(),
        note: 'cleared by test',
      },
      null,
      2,
    ),
  );
}

function runGate(): { exitCode: number; stdout: string; stderr: string } {
  const r = spawnSync('npx', ['ts-node', GATE_SCRIPT, '--agent', SYNTH_AGENT], {
    cwd: BACKEND_ROOT,
    encoding: 'utf-8',
  });
  return {
    exitCode: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

afterAll(() => {
  // Cleanup is best-effort. On some sandboxed FS mounts (notably the
  // fuse-backed dev mount), the test runner can write files but not unlink
  // them. The synthetic agentId TEST_REGRESSION_GATE_SYNTH is not in the
  // production registry (knownAgentIds()), so leftover files never collide
  // with real eval runs — the next test invocation just overwrites them.
  try {
    if (existsSync(resultsPath)) rmSync(resultsPath);
  } catch {
    /* best-effort */
  }
  try {
    if (existsSync(baselinePath)) rmSync(baselinePath);
  } catch {
    /* best-effort */
  }
});

describe('agent-eval-gate regression detection', () => {
  // ts-node startup is slow; jest's default 5s isn't always enough on
  // sandbox CI. The spec is small (≤6 invocations) so 60s ceiling is fine.
  jest.setTimeout(60_000);

  it('first run with no baseline passes when mean ≥ PASS_THRESHOLD', () => {
    stageResults({ 'case-a': 0.9, 'case-b': 0.85 });
    clearBaseline();
    const { exitCode, stdout } = runGate();
    expect(stdout).toContain('no baseline');
    expect(exitCode).toBe(0);
  });

  it('first run with no baseline fails when mean < PASS_THRESHOLD', () => {
    stageResults({ 'case-a': 0.7, 'case-b': 0.65 });
    clearBaseline();
    const { exitCode, stderr } = runGate();
    expect(stderr).toContain('BELOW THRESHOLD');
    expect(exitCode).toBe(1);
  });

  it('no drop from baseline passes', () => {
    const same = { 'case-a': 0.9, 'case-b': 0.85 };
    stageResults(same);
    stageBaseline(same);
    const { exitCode } = runGate();
    expect(exitCode).toBe(0);
  });

  it('drop < 5pp passes (within tolerance)', () => {
    stageBaseline({ 'case-a': 0.9, 'case-b': 0.85 });
    // mean baseline = 0.875; new mean = (0.88 + 0.83)/2 = 0.855; drop = 0.02 (2pp)
    stageResults({ 'case-a': 0.88, 'case-b': 0.83 });
    const { exitCode } = runGate();
    expect(exitCode).toBe(0);
  });

  it('overall mean drop ≥ 5pp fails as regression', () => {
    stageBaseline({ 'case-a': 0.95, 'case-b': 0.95 });
    // mean baseline = 0.95; new mean = 0.85; drop = 0.10 (10pp)
    stageResults({ 'case-a': 0.85, 'case-b': 0.85 });
    const { exitCode, stderr } = runGate();
    expect(stderr).toContain('REGRESSION');
    expect(exitCode).toBe(1);
  });

  it('per-case drop ≥ 5pp fails even if overall mean is fine', () => {
    // Baseline: a=0.95, b=0.85 (mean 0.90).
    // Results: a=0.85 (drop 10pp), b=0.95 (+10pp). Mean stays at 0.90.
    // The overall mean is unchanged but case-a regressed 10pp on its own.
    stageBaseline({ 'case-a': 0.95, 'case-b': 0.85 });
    stageResults({ 'case-a': 0.85, 'case-b': 0.95 });
    const { exitCode, stderr } = runGate();
    expect(stderr).toContain('REGRESSION');
    expect(stderr).toContain('case-a');
    expect(exitCode).toBe(1);
  });
});
