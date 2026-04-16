#!/usr/bin/env node
// scripts/swarm/orient.mjs
// Unified session orientation. Run this at the start of every CLI session.
// Replaces the manual 5-step boot protocol with a single command that shows
// everything a new CLI needs to know before starting work.
//
// Usage:
//   npm run swarm:orient
//   npm run swarm:orient -- --json

import {
  c, REPO_ROOT, OMX_STATE, MISSIONS_DIR, HEALTH_DIR, EMERGENCIES_DIR,
  listJsonFiles, loadRegistry, allClisBySwarm,
} from './_lib.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const jsonMode = process.argv.includes('--json');

function gitBranch() {
  try { return execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

function gitDirty() {
  try {
    const out = execSync('git status --porcelain', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    return out.split('\n').filter(Boolean).length;
  } catch { return -1; }
}

function latestHandoff() {
  const path = join(REPO_ROOT, 'docs', 'SESSION_HANDOFF.md');
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf8');
  const dateMatch = content.match(/Last updated:\s*(.+)/);
  const phases = [];
  const phaseRe = /^### (Phase \d+.*)$/gm;
  let m;
  while ((m = phaseRe.exec(content)) !== null) {
    const phaseTitle = m[1];
    const start = m.index;
    const nextPhase = content.indexOf('\n### ', start + 1);
    const block = content.slice(start, nextPhase > 0 ? nextPhase : undefined);
    const done = (block.match(/- \[x\]/gi) || []).length;
    const total = (block.match(/- \[[ x]\]/gi) || []).length;
    phases.push({ title: phaseTitle, done, total });
  }
  return {
    lastUpdated: dateMatch ? dateMatch[1].trim() : 'unknown',
    phases,
  };
}

function latestHealth() {
  if (!existsSync(HEALTH_DIR)) return null;
  const files = readdirSync(HEALTH_DIR).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) return null;
  try { return JSON.parse(readFileSync(join(HEALTH_DIR, files[files.length - 1]), 'utf8')); }
  catch { return null; }
}

function activeMissions() {
  return listJsonFiles(MISSIONS_DIR).filter((m) => m.status === 'active');
}

function openIncidents() {
  return listJsonFiles(EMERGENCIES_DIR).filter((i) => i.status === 'open');
}

function liveSessions() {
  const dir = join(OMX_STATE, 'team', 'sessions');
  if (!existsSync(dir)) return [];
  const staleMs = 30 * 60 * 1000;
  const now = Date.now();
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); }
      catch { return null; }
    })
    .filter((s) => {
      if (!s) return false;
      const hb = new Date(s.heartbeat_at || s.started_at || 0).getTime();
      return (now - hb) < staleMs;
    });
}

function vol3Progress() {
  const path = join(REPO_ROOT, '.cerniq', 'terminals.json');
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const counts = { shipped: 0, in_progress: 0, claimed: 0, not_started: 0 };
    for (const t of data.terminals) counts[t.status] = (counts[t.status] || 0) + 1;
    return { total: data.terminals.length, ...counts };
  } catch { return null; }
}

// ── Gather ──────────────────────────────────────────────────────────────

const branch = gitBranch();
const dirty = gitDirty();
const handoff = latestHandoff();
const health = latestHealth();
const missions = activeMissions();
const incidents = openIncidents();
const sessions = liveSessions();
const vol3 = vol3Progress();
const reg = loadRegistry();

if (jsonMode) {
  console.log(JSON.stringify({
    branch, dirty, handoff, health: health?.summary,
    missions: missions.length, incidents: incidents.length,
    sessions: sessions.length, vol3,
    clis: reg.clis.length, swarms: Object.keys(reg.swarms).length,
  }, null, 2));
  process.exit(0);
}

// ── Render ──────────────────────────────────────────────────────────────

console.log(c('bold', '\n  ╔═══════════════════════════════════════════════════════════╗'));
console.log(c('bold', '  ║           CERNIQ · SESSION ORIENTATION                   ║'));
console.log(c('bold', '  ╚═══════════════════════════════════════════════════════════╝'));

// ── Incidents (top, can't miss) ─────────────────────────────────────────

if (incidents.length > 0) {
  console.log(c('red', `\n  ⚠⚠⚠  ${incidents.length} OPEN P0 INCIDENT(S) — READ BEFORE ANY WORK  ⚠⚠⚠`));
  for (const i of incidents) {
    console.log(`    ${c('red', '●')} ${c('bold', i.id)}  ${i.description.slice(0, 55)}`);
    console.log(`      ${c('grey', `systems: ${i.affected_systems?.join(', ') || '?'}  |  ${i.timestamp?.slice(0, 16)}`)}`);
  }
}

// ── Git state ───────────────────────────────────────────────────────────

console.log(`\n  ${c('bold', 'Git')}            branch: ${c('cyan', branch)}  |  ${dirty > 0 ? c('yellow', `${dirty} dirty files`) : c('green', 'clean')}`);

// ── Health ──────────────────────────────────────────────────────────────

if (health) {
  const s = health.summary;
  const status = s.critical_down > 0 ? c('red', 'CRITICAL DOWN')
    : s.red > 0 ? c('red', `${s.red} RED`)
    : s.yellow > 0 ? c('yellow', `${s.yellow} YELLOW`)
    : c('green', 'ALL GREEN');
  console.log(`  ${c('bold', 'Health')}         ${status}  (${c('green', `${s.green}G`)} ${c('yellow', `${s.yellow}Y`)} ${c('red', `${s.red}R`)})  ${c('grey', `@ ${health.timestamp?.slice(11, 19) || '?'}`)}`);
} else {
  console.log(`  ${c('bold', 'Health')}         ${c('grey', 'no snapshot — run: npm run swarm:health')}`);
}

// ── Sessions & Claims ───────────────────────────────────────────────────

if (sessions.length > 0) {
  const totalClaims = sessions.reduce((sum, s) => sum + (s.claims?.length || 0), 0);
  console.log(`  ${c('bold', 'Sessions')}       ${sessions.length} live, ${totalClaims} claims`);
  for (const s of sessions) {
    const claims = (s.claims || []).map((p) => p.split('/').pop()).join(', ');
    console.log(`    ${c('cyan', '●')} ${c('bold', s.nickname.padEnd(16))} ${claims ? c('grey', claims) : c('grey', 'no claims')}`);
  }
} else {
  console.log(`  ${c('bold', 'Sessions')}       ${c('grey', 'none active')}`);
}

// ── Active Missions ─────────────────────────────────────────────────────

if (missions.length > 0) {
  console.log(`  ${c('bold', 'Missions')}       ${c('yellow', `${missions.length} active`)}`);
  for (const m of missions.slice(0, 5)) {
    const pc = m.priority === 'P0' ? 'red' : m.priority === 'P1' ? 'yellow' : 'cyan';
    console.log(`    ${c('yellow', '▶')} ${c(pc, m.priority)} ${c('bold', m.cli_id.padEnd(8))} ${m.description.slice(0, 50)}`);
  }
  if (missions.length > 5) console.log(c('grey', `    ... and ${missions.length - 5} more`));
} else {
  console.log(`  ${c('bold', 'Missions')}       ${c('grey', 'none active')}`);
}

// ── Vol.3 Progress ──────────────────────────────────────────────────────

if (vol3) {
  const pct = Math.round((vol3.shipped / vol3.total) * 100);
  console.log(`  ${c('bold', 'Agent Layer')}    ${c('green', `${vol3.shipped}`)}/${vol3.total} shipped (${pct}%)  ${c('yellow', `${vol3.in_progress} WIP`)}  ${c('grey', `${vol3.not_started} pending`)}`);
}

// ── Handoff Summary ─────────────────────────────────────────────────────

if (handoff) {
  console.log(`\n  ${c('bold', 'Last Handoff')}   ${c('grey', handoff.lastUpdated)}`);
  for (const p of handoff.phases) {
    const bar = p.total > 0
      ? `[${'█'.repeat(Math.round((p.done / p.total) * 20))}${'░'.repeat(20 - Math.round((p.done / p.total) * 20))}]`
      : '[no items]';
    const color = p.done === p.total ? 'green' : p.done > 0 ? 'yellow' : 'grey';
    console.log(`    ${c(color, bar)} ${p.done}/${p.total}  ${p.title}`);
  }
}

// ── Swarm fleet ─────────────────────────────────────────────────────────

console.log(`\n  ${c('bold', 'Fleet')}          ${reg.clis.length} CLIs across ${Object.keys(reg.swarms).length} swarms`);

// ── Next steps ──────────────────────────────────────────────────────────

console.log(c('grey', '\n  ' + '─'.repeat(55)));
console.log(c('bold', '  Quick start:'));
console.log(`    ${c('cyan', '1.')} npm run session:register -- <nickname>`);
console.log(`    ${c('cyan', '2.')} npm run session:claim -- <nickname> <paths>`);
console.log(`    ${c('cyan', '3.')} npm run swarm:dispatch -- list --active`);
console.log('');
