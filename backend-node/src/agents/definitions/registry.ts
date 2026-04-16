import type { AgentId } from '@prisma/client';
import { AlmDecisionAgent } from './alm-decision.definition';
import { CommitteeReportAgent } from './committee-report.definition';
import { RiskMonitorAgent } from './risk-monitor.definition';
import { CFOCopilotAgent } from './cfo-copilot.definition';
import type { AgentDefinition } from './agent.definition';

export const AGENT_DEFINITIONS: Partial<Record<AgentId, AgentDefinition>> = {
  ALM_DECISION: AlmDecisionAgent,
  COMMITTEE_REPORT: CommitteeReportAgent,
  RISK_MONITOR: RiskMonitorAgent,
  CFO_COPILOT: CFOCopilotAgent,
};

export function resolveAgentDefinition(
  id: AgentId,
): AgentDefinition | undefined {
  return AGENT_DEFINITIONS[id];
}
