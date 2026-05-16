#!/usr/bin/env node
/**
 * verify-institution-scope-guard.mjs — CI guard against cross-tenant IDOR
 * regressions on NestJS controllers.
 *
 * Locks the floor restored in commit 8f69c148 (2026-05-15): every
 * `:institutionId` route must live in a controller with
 * `InstitutionScopeGuard` mounted at class level OR at method level.
 *
 * The audit that surfaced 8f69c148's 106-route gap was manual `grep`.
 * Without a CI guard, the next controller addition that forgets the guard
 * reintroduces the same vulnerability class silently. This script makes
 * the invariant tested, not trusted.
 *
 * Two rules, both fail-closed:
 *
 *   (R1) **Canonical param name.** Any path-param that names an institution
 *        must be exactly `:institutionId`. Variants (`:instId`,
 *        `:institution`, `:institution_id`, `:institutionID`) are errors —
 *        they bypass `InstitutionScopeGuard` (which reads
 *        `req.params.institutionId` literally) and create silent
 *        cross-tenant access. Rename to the canonical form.
 *
 *   (R2) **Guard required.** Every route whose effective path
 *        (`@Controller(base)` + route decorator path) contains
 *        `:institutionId` must be guarded by `InstitutionScopeGuard`,
 *        either via:
 *          - class-level `@UseGuards(..., InstitutionScopeGuard, ...)`
 *            anywhere in the decorator stack above `export class X { ... }`, or
 *          - method-level `@UseGuards(..., InstitutionScopeGuard, ...)`
 *            on the route handler itself, or
 *          - a `// verify:institution-scope-skip — <reason>` comment in
 *            the immediate decorator block above the route handler. The
 *            skip is an explicit, reviewable opt-out for legitimate
 *            cross-tenant cases (e.g. CPA firm acting on a client
 *            institution where the tenant relationship is mediated
 *            elsewhere). The reason MUST be non-empty so reviewers can
 *            audit the carve-out.
 *
 * Wired into `npm run lint` as `verify:institution-scope`. Standalone via
 * `node scripts/verify-institution-scope-guard.mjs`.
 *
 * Flags:
 *   (none)        scan + report; exit 1 on any violation
 *   --quiet       suppress per-violation detail; final summary only
 *   --self-test   exercise the rules against in-memory fixture cases
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_ROOT = join(ROOT, 'src');

const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');
const SELF_TEST = argv.includes('--self-test');

const CONTROLLER_RE = /\.controller\.ts$/;
const VARIANT_NAMES = ['instId', 'institution', 'institution_id', 'institutionID'];

// ─── Parser ─────────────────────────────────────────────────────────────────
//
// Decorator-aware line walker. NestJS controllers follow a tight syntactic
// shape that we don't need a TS parser for:
//
//   @Controller('api/foo')
//   @UseGuards(AuthGuard, InstitutionScopeGuard)
//   export class FooController {
//     @UseGuards(InstitutionScopeGuard)   // optional method-level
//     @Get(':institutionId/bar')
//     async bar(...) { ... }
//   }
//
// The walker tracks the most-recent run of class-level decorators (between
// the first decorator and `export class X`) and the most-recent run of
// method-level decorators (between the previous handler and the current
// `@(Get|Post|...)`).

const ROUTE_DECORATOR_RE = /^\s*@(Get|Post|Put|Delete|Patch|Sse|All|Head|Options)\s*\(\s*['"`]([^'"`]*)['"`]/;
const USE_GUARDS_RE = /@UseGuards\s*\(([^)]*)\)/;
const CONTROLLER_RE_DECO = /^\s*@Controller\s*\(\s*['"`]([^'"`]*)['"`]/;
const EXPORT_CLASS_RE = /^\s*export\s+(?:abstract\s+)?class\s+\w+/;
const SKIP_COMMENT_RE = /\/\/\s*verify:institution-scope-skip(?:\s*[—\-:]\s*(.+?))?\s*$/;

/**
 * Parse a controller's source text into the routes-and-guards summary the
 * checker needs. Pure function over the file text.
 */
export function parseController(text) {
  const lines = text.split('\n');
  const routes = [];
  const errors = [];

  let basePath = '';
  let classGuardLine = null;       // line number of class-level @UseGuards (1-based)
  let classGuardHasIsg = false;
  let seenClass = false;

  // Method decorator block accumulator. NestJS decorators stack on the
  // same method in either order — `@UseGuards()` may come BEFORE the
  // route decorator (`@Get`) or AFTER. The check must treat the whole
  // block as one unit, evaluating guards and routes together when the
  // block closes (on a non-decorator, non-comment, non-blank line — i.e.
  // the method signature itself).
  let block = freshBlock();

  function freshBlock() {
    return {
      routeDecorators: [],         // [{ line, decorator, routePath }]
      hasGuardIsg: false,
      hasGuardLine: null,
      skip: null,                   // { reason, line } from a // verify:institution-scope-skip comment
    };
  }

  function flushBlock() {
    if (block.routeDecorators.length === 0) {
      block = freshBlock();
      return;
    }
    for (const rd of block.routeDecorators) {
      routes.push({
        line: rd.line,
        decorator: rd.decorator,
        routePath: rd.routePath,
        effectivePath: joinPath(basePath, rd.routePath),
        hasMethodGuard: block.hasGuardIsg,
        skip: block.skip,
      });
    }
    block = freshBlock();
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const lineNo = i + 1;

    // @Controller('path') — capture the base path (only the first one,
    // controllers never have two).
    if (!basePath) {
      const m = CONTROLLER_RE_DECO.exec(raw);
      if (m) basePath = m[1];
    }

    // Class boundary. `@UseGuards` between the first decorator and this
    // line counted as class-level.
    if (!seenClass && EXPORT_CLASS_RE.test(line)) {
      seenClass = true;
      continue;
    }

    if (!seenClass) {
      // Class-level @UseGuards detection (between top-of-file decorators
      // and `export class X`).
      const useGuardsMatch = USE_GUARDS_RE.exec(raw);
      if (useGuardsMatch) {
        const guardsList = useGuardsMatch[1];
        const hasIsg = /\bInstitutionScopeGuard\b/.test(guardsList);
        classGuardLine = lineNo;
        classGuardHasIsg = classGuardHasIsg || hasIsg;
      }
      continue;
    }

    // Inside class body. Three line categories matter for block accounting:
    //
    //   (a) Method-level `@UseGuards(...)` → tag the current block.
    //   (b) Route decorator `@(Get|Post|...)('path')` → add to the block.
    //   (c) `// verify:institution-scope-skip — reason` → stage skip.
    //   (d) Blank line, `// comment`, `/** ... */` line, JSDoc continuation,
    //       or `@OtherDecorator(...)` → block stays alive (we don't know
    //       yet whether this is a multi-decorator stack or a property).
    //   (e) Anything else (method signature `async foo(`, property
    //       declaration, etc.) → CLOSE the block. Flush its routes
    //       carrying the accumulated guard state.

    const useGuardsMatch = USE_GUARDS_RE.exec(raw);
    if (useGuardsMatch) {
      const guardsList = useGuardsMatch[1];
      const hasIsg = /\bInstitutionScopeGuard\b/.test(guardsList);
      block.hasGuardIsg = block.hasGuardIsg || hasIsg;
      block.hasGuardLine = lineNo;
      continue;
    }

    const skipMatch = SKIP_COMMENT_RE.exec(raw);
    if (skipMatch) {
      const reason = (skipMatch[1] ?? '').trim();
      block.skip = { reason, line: lineNo };
      continue;
    }

    const routeMatch = ROUTE_DECORATOR_RE.exec(raw);
    if (routeMatch) {
      block.routeDecorators.push({
        line: lineNo,
        decorator: routeMatch[1],
        routePath: routeMatch[2],
      });
      continue;
    }

    // Block-keeping lines (stay in block).
    if (!line) continue;
    if (line.startsWith('//')) continue;
    if (line.startsWith('*') || line.startsWith('/*')) continue;
    if (line.startsWith('@')) continue;       // other decorator (@ApiOperation, @Roles, etc.)

    // Anything else closes the block. The method signature ends here.
    flushBlock();
  }

  // EOF — flush any trailing block (e.g. last route in the file).
  flushBlock();

  // R1: scan for variant param names in the entire file's decorator strings.
  // We re-walk the lines so we can carry an accurate line number.
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // Only look at lines that contain a @Controller or route decorator.
    if (!CONTROLLER_RE_DECO.test(raw) && !ROUTE_DECORATOR_RE.test(raw)) continue;
    for (const variant of VARIANT_NAMES) {
      // Match `:variant` followed by `/`, end-of-string, or quote.
      const variantRe = new RegExp(`:${variant}(?=[/'"\`?]|$)`);
      if (variantRe.test(raw)) {
        errors.push({
          rule: 'R1',
          line: i + 1,
          message:
            `non-canonical path param ":${variant}" — use ":institutionId" so InstitutionScopeGuard ` +
            `(which reads req.params.institutionId literally) can scope the route. Rename and update handler @Param.`,
        });
      }
    }
  }

  // R2: every :institutionId route must be guarded OR explicitly skipped.
  for (const r of routes) {
    if (!r.effectivePath.includes(':institutionId')) continue;
    if (classGuardHasIsg || r.hasMethodGuard) continue;
    if (r.skip) {
      if (!r.skip.reason) {
        errors.push({
          rule: 'R2',
          line: r.line,
          message:
            `@${r.decorator}('${r.routePath}') has a verify:institution-scope-skip comment ` +
            `but no reason. Format: "// verify:institution-scope-skip — <why this is safe>". ` +
            `Skip without rationale is not allowed.`,
        });
      }
      continue;
    }
    errors.push({
      rule: 'R2',
      line: r.line,
      message:
        `@${r.decorator}('${r.routePath}') resolves to effective path "${r.effectivePath}" ` +
        `which contains ":institutionId" but the controller has no InstitutionScopeGuard ` +
        `(neither class-level above "export class" nor method-level above this route). ` +
        `Add @UseGuards(AuthTenantGuard, InstitutionScopeGuard) at the class level, or ` +
        `if the route is cross-tenant by design, add a "// verify:institution-scope-skip — <reason>" comment.`,
    });
  }

  return { basePath, routes, errors, classGuardLine };
}

function joinPath(basePath, routePath) {
  // Strip leading/trailing slashes and re-join with a single slash.
  const a = basePath.replace(/^\/+|\/+$/g, '');
  const b = routePath.replace(/^\/+|\/+$/g, '');
  if (!a) return `/${b}`;
  if (!b) return `/${a}`;
  return `/${a}/${b}`;
}

// ─── Self-test ──────────────────────────────────────────────────────────────

function runSelfTest() {
  const fixtures = [
    {
      name: 'class-level guard on method-path :institutionId route — OK',
      text: `
@Controller('api/alm')
@UseGuards(AuthTenantGuard, InstitutionScopeGuard)
export class AlmController {
  @Get(':institutionId/summary')
  getSummary() {}
}`,
      expectedErrors: 0,
    },
    {
      name: 'method-level guard on a route with no class guard — OK',
      text: `
@Controller('api/foo')
export class FooController {
  @UseGuards(AuthGuard, InstitutionScopeGuard)
  @Get(':institutionId/bar')
  bar() {}
}`,
      expectedErrors: 0,
    },
    {
      name: 'base-path :institutionId with class guard — OK',
      text: `
@Controller('api/v1/agents/:institutionId')
@UseGuards(AuthGuard, InstitutionScopeGuard)
export class AgentRunsController {
  @Get('runs')
  list() {}
}`,
      expectedErrors: 0,
    },
    {
      name: 'method-path :institutionId with NO guard — R2 violation',
      text: `
@Controller('api/foo')
export class FooController {
  @Get(':institutionId/bar')
  bar() {}
}`,
      expectedErrors: 1,
      expectedRule: 'R2',
    },
    {
      name: 'base-path :institutionId with NO guard — R2 violation',
      text: `
@Controller('api/v2/widgets/:institutionId')
export class WidgetsController {
  @Get('list')
  list() {}
}`,
      expectedErrors: 1,
      expectedRule: 'R2',
    },
    {
      name: 'variant param name :instId — R1 violation',
      text: `
@Controller('api/foo')
@UseGuards(AuthGuard, InstitutionScopeGuard)
export class FooController {
  @Get(':instId/bar')
  bar() {}
}`,
      expectedErrors: 1,
      expectedRule: 'R1',
    },
    {
      name: 'variant param name :institution_id — R1 violation',
      text: `
@Controller('api/foo')
export class FooController {
  @Get(':institution_id/bar')
  bar() {}
}`,
      expectedErrors: 1,
      expectedRule: 'R1',
    },
    {
      name: 'route with no :institutionId — no rule fires',
      text: `
@Controller('api/alm')
export class AlmController {
  @Get('treasury/rates')
  treasury() {}
}`,
      expectedErrors: 0,
    },
    {
      name: 'skip comment with reason exempts an unguarded :institutionId route',
      text: `
@Controller('api/cpa/firms/:firmId')
@UseGuards(AuthGuard, RolesGuard)
export class CpaClientController {
  // verify:institution-scope-skip — CPA firms intentionally cross tenants via CpaClientRelationship
  @Delete('clients/:institutionId')
  removeClient() {}
}`,
      expectedErrors: 0,
    },
    {
      name: 'skip comment WITHOUT reason still fails — no silent opt-out',
      text: `
@Controller('api/foo')
export class FooController {
  // verify:institution-scope-skip
  @Get(':institutionId/bar')
  bar() {}
}`,
      expectedErrors: 1,
      expectedRule: 'R2',
    },
    {
      name: 'skip comment is one-shot — does not leak to the next route',
      text: `
@Controller('api/foo')
export class FooController {
  // verify:institution-scope-skip — first route is cross-tenant by design
  @Get(':institutionId/skipped')
  skipped() {}

  @Get(':institutionId/not-skipped')
  notSkipped() {}
}`,
      expectedErrors: 1,
      expectedRule: 'R2',
    },
  ];

  const failures = [];
  for (const fx of fixtures) {
    const { errors } = parseController(fx.text);
    const ok = errors.length === fx.expectedErrors &&
      (fx.expectedRule == null || errors.every(e => e.rule === fx.expectedRule));
    if (!ok) {
      failures.push(
        `self-test FAIL: ${fx.name}\n` +
        `  expected: ${fx.expectedErrors} error(s)` +
        (fx.expectedRule ? ` of rule ${fx.expectedRule}` : '') + `\n` +
        `  got:      ${errors.length} error(s)\n` +
        errors.map(e => `    - ${e.rule} L${e.line}: ${e.message}`).join('\n'),
      );
    }
  }

  if (failures.length > 0) {
    for (const f of failures) console.error(f);
    console.error(`\nverify-institution-scope-guard --self-test: ${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log(`verify-institution-scope-guard --self-test: ${fixtures.length} case(s) pass`);
  process.exit(0);
}

if (SELF_TEST) runSelfTest();

// ─── Walk + check ───────────────────────────────────────────────────────────

function* walkControllers(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkControllers(full);
    else if (entry.isFile() && CONTROLLER_RE.test(entry.name)) yield full;
  }
}

const violations = [];
let scanned = 0;
let routesWithInstId = 0;
let routesGuarded = 0;
let controllersWithClassGuard = 0;

for (const file of walkControllers(SRC_ROOT)) {
  scanned += 1;
  const text = readFileSync(file, 'utf8');
  const { routes, errors, classGuardLine } = parseController(text);
  const relPath = relative(ROOT, file);

  for (const r of routes) {
    if (!r.effectivePath.includes(':institutionId')) continue;
    routesWithInstId += 1;
    if (errors.find(e => e.rule === 'R2' && e.line === r.line)) continue;
    routesGuarded += 1;
  }

  // Heuristic count (informational): controllers with class-level guard
  // we successfully attached to ISG.
  if (classGuardLine && routes.some(r => r.effectivePath.includes(':institutionId'))) {
    // Class guard exists and the controller has :institutionId routes —
    // count it as "actively defended" iff we didn't surface an R2 above.
    const r2HereCount = errors.filter(e => e.rule === 'R2').length;
    if (r2HereCount === 0) controllersWithClassGuard += 1;
  }

  for (const e of errors) {
    violations.push({ file: relPath, ...e });
  }
}

const summary =
  `verify-institution-scope-guard: ${scanned} controller(s) scanned, ` +
  `${routesWithInstId} :institutionId route(s) found, ` +
  `${routesGuarded} guarded, ` +
  `${violations.length} violation(s).`;

if (violations.length > 0) {
  if (!QUIET) {
    for (const v of violations) {
      console.error(`error [${v.rule}] ${v.file}:${v.line}`);
      console.error(`  ${v.message}`);
    }
    console.error('');
    console.error('Each violation must be one of:');
    console.error('  (R1) rename non-canonical path param to ":institutionId" (and update @Param)');
    console.error('  (R2) add @UseGuards(AuthTenantGuard, InstitutionScopeGuard) at class level');
    console.error('       (or @UseGuards(..., InstitutionScopeGuard, ...) on the specific route)');
    console.error('');
    console.error('See commit 8f69c148 + docs/SESSION_HANDOFF.md for the canonical pattern.');
  }
  console.error(summary);
  process.exit(1);
}

console.log(summary);
process.exit(0);
