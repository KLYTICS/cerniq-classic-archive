// scripts/swarm/_lib.mjs
// Core library for the Vol.4 100-CLI Swarm Dispatch Model.
// Resolves CLI IDs to swarms, terminals, quality gates, and mission scope.
// Coexists with Vol.3 50-terminal model (scripts/cerniq-terminal.mjs).

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, '..', '..');
export const REGISTRY_PATH = join(__dirname, 'registry.json');
export const OMX_STATE = join(REPO_ROOT, '.omx', 'state');
export const MISSIONS_DIR = join(OMX_STATE, 'missions');
export const HEALTH_DIR = join(OMX_STATE, 'health');
export const EMERGENCIES_DIR = join(OMX_STATE, 'emergencies');
export const ALERTS_DIR = join(OMX_STATE, 'alerts');
export const APPROVALS_PENDING = join(OMX_STATE, 'approvals', 'pending');
export const APPROVALS_APPROVED = join(OMX_STATE, 'approvals', 'approved');
export const APPROVALS_DENIED = join(OMX_STATE, 'approvals', 'denied');
export const AUDIT_DIR = join(OMX_STATE, 'audit');
export const LANDING_PATH = join(OMX_STATE, 'team', 'landing.md');

export const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m', grey: '\x1b[90m',
};
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
export const c = (color, s) => (tty ? `${C[color]}${s}${C.reset}` : s);

export function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    console.error(c('red', `swarm: registry not found at ${REGISTRY_PATH}`));
    process.exit(2);
  }
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
}

export function resolveCli(reg, cliId) {
  const normalized = cliId.toUpperCase();
  const cli = reg.clis.find((c) => c.id === normalized);
  if (!cli) return null;
  const swarm = reg.swarms[cli.swarm] || null;
  const terminal = swarm ? reg.terminals[swarm.terminal] : reg.terminals[cli.terminal] || null;
  return { cli, swarm, terminal };
}

export function resolveSwarm(reg, swarmName) {
  const key = swarmName.toLowerCase().replace(/\s+/g, '-');
  const swarm = reg.swarms[key];
  if (!swarm) return null;
  const clis = reg.clis.filter((c) => c.swarm === key);
  const terminal = reg.terminals[swarm.terminal];
  return { swarm, clis, terminal, key };
}

export function allClisBySwarm(reg) {
  const grouped = {};
  for (const cli of reg.clis) {
    (grouped[cli.swarm] ||= []).push(cli);
  }
  return grouped;
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function writeAtomic(path, data) {
  const dir = dirname(path);
  ensureDir(dir);
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n';
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

export function nowIso() {
  return new Date().toISOString();
}

export function dateStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean);
}

export function priorityWeight(p) {
  switch (p) {
    case 'P0': return 3;
    case 'P1': return 2;
    case 'P2': return 1;
    default: return 0;
  }
}

export function priorityColor(p) {
  switch (p) {
    case 'P0': return 'red';
    case 'P1': return 'yellow';
    case 'P2': return 'cyan';
    default: return 'grey';
  }
}

export function swarmGlyph(swarmKey) {
  const glyphs = {
    'engineering-backend': 'BE',
    'engineering-frontend': 'FE',
    'engineering-general': 'EG',
    'gtm-sales': 'GT',
    'monitoring': 'MO',
    'alm-quant': 'QT',
    'devops-infra': 'DV',
    'compliance': 'CO',
    'product': 'PR',
    'revops': 'RV',
    'command': 'CM',
    'dispatch': 'OP',
    'architecture': 'AR',
    'qa-testing': 'QA',
  };
  return glyphs[swarmKey] || '??';
}
