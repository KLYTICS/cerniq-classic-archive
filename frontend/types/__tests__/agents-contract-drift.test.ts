/**
 * Contract drift guard — asserts that the frontend type surface in
 * types/agents.ts matches the backend Prisma schema's enum values.
 *
 * When the backend adds/removes an enum variant, this test fails,
 * forcing the frontend to be updated in lockstep. Prevents the class
 * of bug where the UI renders "unknown" for a new agent type or silently
 * drops a new status.
 *
 * Reads the Prisma schema file directly — no @prisma/client import needed.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import type {
  AgentId,
  AgentRunStatus,
  AgentTriggerKind,
  AgentAuditStepKind,
  Severity,
  AlertStatus,
} from '../agents';
import { AGENT_LABEL } from '../agents';

const SCHEMA_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'backend-node',
  'prisma',
  'schema.prisma',
);

function parsePrismaEnum(enumName: string): string[] {
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  const regex = new RegExp(`enum ${enumName}\\s*\\{([^}]+)\\}`, 's');
  const match = schema.match(regex);
  if (!match) throw new Error(`Enum ${enumName} not found in schema.prisma`);
  return match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//'));
}

const FRONTEND_AGENT_IDS: AgentId[] = [
  'ALM_DECISION', 'COMMITTEE_REPORT', 'RISK_MONITOR', 'CFO_COPILOT',
  'STRESS_TESTING', 'CAPITAL_OPTIMIZER', 'REGULATORY_COMPLIANCE', 'EXAM_PREP',
  'LOAN_PRICING', 'DEPOSIT_STRATEGY', 'PEER_INTELLIGENCE', 'BOARD_NARRATIVE',
];

const FRONTEND_RUN_STATUSES: AgentRunStatus[] = [
  'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT',
];

const FRONTEND_TRIGGER_KINDS: AgentTriggerKind[] = [
  'UPLOAD', 'SCHEDULE', 'USER_QUERY', 'API', 'CHAIN',
];

const FRONTEND_AUDIT_STEP_KINDS: AgentAuditStepKind[] = [
  'RUN_STARTED', 'TOOL_CALL', 'TOOL_RESULT', 'LLM_TURN',
  'CONTRACT_VALIDATION', 'RUN_COMPLETED', 'RUN_FAILED',
];

const FRONTEND_ALERT_SEVERITIES: Severity[] = [
  'CRITICAL', 'HIGH', 'MEDIUM', 'LOW',
];

const FRONTEND_ALERT_STATUSES: AlertStatus[] = [
  'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED',
];

describe('Contract drift guard: types/agents.ts ↔ schema.prisma', () => {
  it('AgentId matches Prisma enum exactly', () => {
    const prisma = parsePrismaEnum('AgentId');
    expect(FRONTEND_AGENT_IDS.sort()).toEqual(prisma.sort());
  });

  it('AgentRunStatus matches Prisma enum exactly', () => {
    const prisma = parsePrismaEnum('AgentRunStatus');
    expect(FRONTEND_RUN_STATUSES.sort()).toEqual(prisma.sort());
  });

  it('AgentTriggerKind matches Prisma enum exactly', () => {
    const prisma = parsePrismaEnum('AgentTriggerKind');
    expect(FRONTEND_TRIGGER_KINDS.sort()).toEqual(prisma.sort());
  });

  it('AgentAuditStepKind matches Prisma enum exactly', () => {
    const prisma = parsePrismaEnum('AgentAuditStepKind');
    expect(FRONTEND_AUDIT_STEP_KINDS.sort()).toEqual(prisma.sort());
  });

  it('Severity matches Prisma AgentAlertSeverity enum exactly', () => {
    const prisma = parsePrismaEnum('AgentAlertSeverity');
    expect(FRONTEND_ALERT_SEVERITIES.sort()).toEqual(prisma.sort());
  });

  it('AlertStatus matches Prisma AgentAlertStatus enum exactly', () => {
    const prisma = parsePrismaEnum('AgentAlertStatus');
    expect(FRONTEND_ALERT_STATUSES.sort()).toEqual(prisma.sort());
  });

  it('AGENT_LABEL has an entry for every AgentId', () => {
    const prisma = parsePrismaEnum('AgentId');
    for (const id of prisma) {
      expect(AGENT_LABEL).toHaveProperty(id);
      expect(typeof (AGENT_LABEL as Record<string, string>)[id]).toBe('string');
    }
  });

  it('AGENT_LABEL has no extra keys beyond AgentId', () => {
    const prisma = new Set(parsePrismaEnum('AgentId'));
    for (const key of Object.keys(AGENT_LABEL)) {
      expect(prisma.has(key)).toBe(true);
    }
  });
});
