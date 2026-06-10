// Apex absorption — Phase 5d war-room contract shim (2026-05-17).
//
// Narrowed type port from apex/lib/war-room/contracts.ts. The full
// contract surface includes WarRoomMembership, WarRoomDriverIdentity,
// WarRoomCommand, WarRoomSession (the full record), and 8+ event
// payload types. Phase 5d narrows to what the lobby page reads:
// WarRoomSessionSummary + its enum dependencies.
//
// Also defines a `DemoOperator` view-model — in apex this comes from
// `useWarRoomOperator()` hook against the workspace + session
// store; here we mock it directly to render the operator MetricStrip.

export type WarRoomSessionStatus = "active" | "closed";
export type WarRoomRoute = "command" | "execute";
export type WarRoomContinuityState =
  | "active_driver"
  | "driver_stale_resume_required"
  | "resume_in_progress"
  | "observer_only";

export interface WarRoomSessionSummary {
  sessionId: string;
  name: string;
  status: WarRoomSessionStatus;
  activePair: string;
  activeRoute: WarRoomRoute;
  openTradeCount: number;
  lockState: string;
  lockOwnerDisplayName: string;
  lockTerminalLabel: string;
  driverTerminalId: string | null;
  continuityState: WarRoomContinuityState;
  staleSince: string | null;
  resumeAllowed: boolean;
  resumeReason: string | null;
  recommendedAction: string;
  lastActivityAt: string;
  updatedAt: string;
}

export type WarRoomOperatorRole = "owner" | "operator" | "viewer";

export interface DemoOperator {
  userId: string;
  displayName: string;
  role: WarRoomOperatorRole;
  terminalId: string;
  terminalLabel: string;
}
