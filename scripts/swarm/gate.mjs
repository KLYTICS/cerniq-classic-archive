#!/usr/bin/env node
// scripts/swarm/gate.mjs
// Quality gate runner per swarm. Runs the defined gates and reports pass/fail.
// Designed to run before any PR or handoff.
//
// Usage:
//   npm run swarm:gate -- <swarm-name|CLI-ID>
//   npm run swarm:gate -- engineering-backend
//   npm run swarm:gate -- E-01
//   npm run swarm:gate -- --all              # run ALL swarm gates (slow)

import { loadRegistry, resolveCli, resolveSwarm, c, REPO_ROOT } from './_lib.mjs';
import { execSync } from 'node:child_process';

const reg = loadRegistry();
const args = process.argv.slice(2);

function runGates(swarmKey, gates) {
  const results = [];
  for (const [name, cmd] of Object.entries(gates)) {
    const label = `${swarmKey}:${name}`;
    process.stdout.write(`  ${c('cyan', '▶')} ${label.padEnd(35)}`);
    try {
      execSync(cmd, { cwd: REPO_ROOT, stdio: 'pipe', timeout: 300_000 });
      console.log(c('green', 'PASS'));
      results.push({ name, status: 'pass' });
    } catch (e) {
      console.log(c('red', 'FAIL'));
      const stderr = e.stderr?.toString().split('\n').slice(0, 5).join('\n') || '';
      if (stderr) console.log(c('grey', `      ${stderr.replace(/\n/g, '\n      ')}`));
      results.push({ name, status: 'fail', error: stderr });
    }
  }
  return results;
}

if (args.includes('--all')) {
  console.log(c('bold', '\n  CERNIQ · Quality Gates · ALL SWARMS\n'));
  let totalPass = 0;
  let totalFail = 0;
  for (const [key, swarm] of Object.entries(reg.swarms)) {
    if (!swarm.quality_gates || Object.keys(swarm.quality_gates).length === 0) continue;
    console.log(`\n  ${c('bold', key)} (${swarm.terminal})`);
    const results = runGates(key, swarm.quality_gates);
    totalPass += results.filter((r) => r.status === 'pass').length;
    totalFail += results.filter((r) => r.status === 'fail').length;
  }
  console.log(`\n  ${c('bold', 'Summary:')} ${c('green', `${totalPass} passed`)}  ${totalFail > 0 ? c('red', `${totalFail} failed`) : c('green', '0 failed')}\n`);
  process.exit(totalFail > 0 ? 1 : 0);
}

const target = args[0];
if (!target) {
  console.error(c('red', 'swarm:gate') + ' — target required (swarm name or CLI ID)');
  console.error('  usage: ' + c('cyan', 'npm run swarm:gate -- engineering-backend'));
  console.error('  usage: ' + c('cyan', 'npm run swarm:gate -- E-01'));
  console.error('  all:   ' + c('cyan', 'npm run swarm:gate -- --all'));
  process.exit(1);
}

let swarmKey = null;
let gates = {};

const swarmResolved = resolveSwarm(reg, target);
if (swarmResolved) {
  swarmKey = swarmResolved.key;
  gates = swarmResolved.swarm.quality_gates || {};
} else {
  const cliResolved = resolveCli(reg, target);
  if (cliResolved && cliResolved.swarm) {
    swarmKey = cliResolved.cli.swarm;
    gates = cliResolved.swarm.quality_gates || {};
  } else {
    console.error(c('red', `swarm:gate — unknown target: ${target}`));
    process.exit(1);
  }
}

if (Object.keys(gates).length === 0) {
  console.log(c('grey', `\n  No quality gates defined for ${swarmKey}\n`));
  process.exit(0);
}

console.log(c('bold', `\n  CERNIQ · Quality Gates · ${swarmKey}\n`));
const results = runGates(swarmKey, gates);
const failed = results.filter((r) => r.status === 'fail');

console.log('');
if (failed.length === 0) {
  console.log(c('green', `  ✓ All ${results.length} gates passed\n`));
} else {
  console.log(c('red', `  ✗ ${failed.length}/${results.length} gates failed\n`));
  process.exit(1);
}
