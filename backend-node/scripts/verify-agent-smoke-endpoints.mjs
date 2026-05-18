#!/usr/bin/env node
/**
 * verify-agent-smoke-endpoints.mjs — static drift guard for scripts/agent-smoke.sh.
 *
 * The smoke script hard-codes four endpoint patterns:
 *   POST /api/v1/agents/:institutionId/run
 *   GET  /api/v1/agents/:institutionId/runs/:runId
 *   GET  /api/v1/agents/:institutionId/runs/:runId/trace
 *   GET  /api/v1/agents/:institutionId/runs            (cross-tenant assertion)
 *
 * If any of those routes is renamed/removed in AgentRunsController without
 * updating the smoke script, the next ship-gate run silently fails with an
 * opaque 404 — and operators waste hours debugging "why does the smoke break
 * on green deploys". This verifier turns that drift into a CI-time error.
 *
 * Strategy: scan `src/agent-api/agent-runs.controller.ts` for
 * `@Controller('api/v1/agents/:institutionId')` + `@Get('...')` / `@Post('...')`
 * decorators, derive the full URL patterns from them, then assert each
 * required endpoint is present.
 *
 * Mirrors the pattern from `verify-rule-9-stamping.mjs` + `verify-vendor-registry.mjs`:
 * single-script, no deps, embedded --self-test fixture, exits 1 on drift.
 *
 * Usage:
 *   node scripts/verify-agent-smoke-endpoints.mjs              # scan + report
 *   node scripts/verify-agent-smoke-endpoints.mjs --self-test  # exercise the parser against fixtures
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO = join(__dirname, '..', '..');
const CONTROLLER = join(
  REPO,
  'backend-node',
  'src',
  'agent-api',
  'agent-runs.controller.ts',
);

const SELF_TEST = process.argv.includes('--self-test');

/**
 * The controller-level prefix the smoke script hardcodes. Bumping this (e.g.
 * to api/v2) would break the smoke unless the script is updated in lockstep.
 */
const EXPECTED_PREFIX = 'api/v1/agents/:institutionId';

/**
 * Required (METHOD, sub-path) pairs that the agent-smoke.sh script depends on.
 * Sub-paths are everything AFTER the controller-level prefix.
 */
const REQUIRED_ROUTES = [
  ['POST', 'run'],
  ['GET', 'runs/:runId'],
  ['GET', 'runs/:runId/trace'],
  ['GET', 'runs'],
];

/**
 * Parse a controller source string. Returns:
 *   { prefix: string, routes: Array<[method, subPath]> }
 *
 * Tolerant of arbitrary whitespace/newlines between the decorator and the
 * method definition. Single-quote and double-quote both accepted.
 */
export function parseController(src) {
  const prefixMatch = src.match(/@Controller\(\s*['"]([^'"]+)['"]\s*\)/);
  if (!prefixMatch) {
    throw new Error('no @Controller decorator found');
  }
  const prefix = prefixMatch[1];

  const routes = [];
  // Match @Get('x') / @Post('x') / @Put / @Delete / @Patch
  const decoratorRe = /@(Get|Post|Put|Delete|Patch)\(\s*['"]([^'"]*)['"]\s*\)/g;
  let m;
  while ((m = decoratorRe.exec(src)) !== null) {
    const method = m[1].toUpperCase();
    const subPath = m[2];
    routes.push([method, subPath]);
  }

  return { prefix, routes };
}

/**
 * Returns the list of missing required routes (each as a "METHOD prefix/sub").
 *
 * Drift detection has two layers:
 *   (a) The controller-level @Controller(...) prefix must equal `expectedPrefix`
 *       (default EXPECTED_PREFIX). If it doesn't, EVERY required route is
 *       reported as missing — because the smoke script's hardcoded URL would
 *       no longer find any of them.
 *   (b) Within the expected prefix, every required (method, sub-path) pair
 *       must be present.
 */
export function findMissing(
  parsed,
  required = REQUIRED_ROUTES,
  expectedPrefix = EXPECTED_PREFIX,
) {
  if (parsed.prefix !== expectedPrefix) {
    return required.map(
      ([method, sub]) => `${method} ${expectedPrefix}/${sub}`,
    );
  }
  const have = new Set(
    parsed.routes.map(([method, sub]) => `${method} ${parsed.prefix}/${sub}`),
  );
  const missing = [];
  for (const [method, sub] of required) {
    const fullPath = `${method} ${parsed.prefix}/${sub}`;
    if (!have.has(fullPath)) missing.push(fullPath);
  }
  return missing;
}

// ─── Self-test ────────────────────────────────────────────────────────────────

function selfTest() {
  let failures = 0;
  const expect = (label, ok) => {
    if (ok) {
      console.log(`  ✓ ${label}`);
    } else {
      console.log(`  ✗ ${label}`);
      failures++;
    }
  };

  // Fixture 1: all four required routes present — must pass cleanly.
  const f1 = `
    @Controller('api/v1/agents/:institutionId')
    export class C {
      @Post('run') async a() {}
      @Get('runs/:runId') async b() {}
      @Get('runs/:runId/trace') async c() {}
      @Get('runs') async d() {}
      @Get('schedule') async e() {}
    }
  `;
  const p1 = parseController(f1);
  expect(
    'fixture 1 prefix parsed',
    p1.prefix === 'api/v1/agents/:institutionId',
  );
  expect('fixture 1 routes count == 5', p1.routes.length === 5);
  expect('fixture 1 no missing required', findMissing(p1).length === 0);

  // Fixture 2: trace route renamed — must surface as drift.
  const f2 = `
    @Controller('api/v1/agents/:institutionId')
    export class C {
      @Post('run') async a() {}
      @Get('runs/:runId') async b() {}
      @Get('runs/:runId/audit-log') async c() {}
      @Get('runs') async d() {}
    }
  `;
  const p2 = parseController(f2);
  const m2 = findMissing(p2);
  expect(
    'fixture 2 detects renamed trace',
    m2.length === 1 && m2[0].endsWith('runs/:runId/trace'),
  );

  // Fixture 3: controller prefix changed — every route should be reported missing.
  const f3 = `
    @Controller('api/v2/agents/:institutionId')
    export class C {
      @Post('run') async a() {}
      @Get('runs/:runId') async b() {}
      @Get('runs/:runId/trace') async c() {}
      @Get('runs') async d() {}
    }
  `;
  const p3 = parseController(f3);
  expect(
    'fixture 3 prefix change makes all 4 missing',
    findMissing(p3).length === 4,
  );

  // Fixture 4: missing @Controller decorator — must throw.
  let threw = false;
  try {
    parseController('export class C { @Get("x") a() {} }');
  } catch {
    threw = true;
  }
  expect('fixture 4 missing @Controller throws', threw);

  // Fixture 5: double-quoted decorators also parsed.
  const f5 = `
    @Controller("api/v1/agents/:institutionId")
    export class C {
      @Post("run") async a() {}
      @Get("runs/:runId") async b() {}
      @Get("runs/:runId/trace") async c() {}
      @Get("runs") async d() {}
    }
  `;
  expect(
    'fixture 5 double-quoted prefix parsed',
    parseController(f5).prefix === 'api/v1/agents/:institutionId',
  );
  expect(
    'fixture 5 no missing required',
    findMissing(parseController(f5)).length === 0,
  );

  if (failures > 0) {
    console.log(`\n${failures} self-test failure(s)`);
    process.exit(1);
  }
  console.log(`\n✓ verify-agent-smoke-endpoints self-test: all checks pass`);
}

// ─── Live scan ────────────────────────────────────────────────────────────────

function liveScan() {
  let src;
  try {
    src = readFileSync(CONTROLLER, 'utf-8');
  } catch (err) {
    console.error(`error: cannot read ${CONTROLLER}`);
    console.error(err.message);
    process.exit(2);
  }

  let parsed;
  try {
    parsed = parseController(src);
  } catch (err) {
    console.error(`error: parse failed for ${CONTROLLER}`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }

  const missing = findMissing(parsed);
  if (missing.length === 0) {
    console.log(
      `✓ agent-smoke endpoints: all ${REQUIRED_ROUTES.length} required routes present in ${parsed.prefix}`,
    );
    process.exit(0);
  }

  console.error(
    `\n✗ agent-smoke endpoint drift — the following routes are missing from ${parsed.prefix}:`,
  );
  for (const m of missing) console.error(`  · ${m}`);
  console.error(
    `\nThis breaks scripts/agent-smoke.sh — operators won't catch it until`,
  );
  console.error(`first prod run. Either restore the route or update both:`);
  console.error(`  1. scripts/agent-smoke.sh`);
  console.error(
    `  2. backend-node/scripts/verify-agent-smoke-endpoints.mjs (REQUIRED_ROUTES)`,
  );
  console.error(`  3. docs/ops/AGENT_SMOKE.md (the endpoint table)`);
  process.exit(1);
}

if (SELF_TEST) {
  selfTest();
} else {
  liveScan();
}
