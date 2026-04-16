#!/usr/bin/env node
// scripts/swarm/scope-check.mjs
// Validates that staged files fall within a CLI's swarm scope boundary.
// Advisory by default (warns). STRICT_SCOPE=1 to block.
//
// Usage:
//   npm run scope:check -- <cli-id>           # check staged files
//   npm run scope:check -- <cli-id> <file...> # check specific files

import { loadRegistry, resolveCli, c, REPO_ROOT } from './_lib.mjs';
import { execSync } from 'node:child_process';

const [cliId, ...explicitFiles] = process.argv.slice(2);

if (!cliId) {
  console.error(c('red', 'scope:check') + ' — requires <cli-id>');
  console.error('  example: ' + c('cyan', 'npm run scope:check -- E-01'));
  process.exit(1);
}

const reg = loadRegistry();
const resolved = resolveCli(reg, cliId);

if (!resolved) {
  console.error(c('red', 'scope:check') + ` — unknown CLI: ${cliId}`);
  process.exit(1);
}

const swarm = resolved.swarm;
const scopePaths = swarm?.scope_paths || [];

if (scopePaths.length === 0) {
  console.log(c('yellow', '⚠ no scope_paths defined') + ` for swarm ${resolved.cli.swarm} — skipping`);
  process.exit(0);
}

const alwaysAllowed = [
  '.omx/state/',
  'docs/',
];

function isInScope(file) {
  const allPaths = [...scopePaths, ...alwaysAllowed];
  return allPaths.some((sp) => file.startsWith(sp) || file === sp.replace(/\/$/, ''));
}

let files = explicitFiles;
if (files.length === 0) {
  try {
    const staged = execSync('git diff --cached --name-only', { cwd: REPO_ROOT, encoding: 'utf8' });
    files = staged.trim().split('\n').filter(Boolean);
  } catch {
    console.error(c('red', 'scope:check') + ' — failed to read staged files');
    process.exit(1);
  }
}

if (files.length === 0) {
  console.log(c('grey', '  No files to check.'));
  process.exit(0);
}

const violations = files.filter((f) => !isInScope(f));
const strict = process.env.STRICT_SCOPE === '1';

console.log(
  c('bold', `\n  Scope Check: ${c('cyan', cliId.toUpperCase())}`) +
  ` (${resolved.cli.swarm})\n`
);
console.log(c('grey', `  Allowed: ${scopePaths.join(', ')}`));
console.log(c('grey', `  Files:   ${files.length} checked\n`));

if (violations.length === 0) {
  console.log(c('green', `  ✓ All ${files.length} files within scope\n`));
  process.exit(0);
}

const label = strict ? c('red', '✗ SCOPE VIOLATION') : c('yellow', '⚠ scope warning');
console.log(`  ${label} — ${violations.length} file(s) outside scope:\n`);

for (const v of violations) {
  console.log(`    ${strict ? c('red', '✗') : c('yellow', '●')} ${v}`);
}

console.log('');
if (strict) {
  console.log(c('red', '  Blocked. Request cross-scope access via approval queue.'));
  console.log(c('grey', `  npm run approval -- request ${cliId} 2 "cross-scope edit" "${violations[0]}"`));
  process.exit(1);
} else {
  console.log(c('yellow', '  Advisory only. Set STRICT_SCOPE=1 to enforce.'));
  process.exit(0);
}
