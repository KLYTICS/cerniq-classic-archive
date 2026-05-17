// Apex absorption — Phase 5a trade-journal contract shim (2026-05-16).
//
// The original `apex/lib/server/overnight-types.ts` exports
// TradeJournalRecord with 13 nested types reaching into the full
// trading/decision/review schema (TradeThesisSummary,
// AlternativeCandidateSummary, AllocationDecision,
// OvernightEligibilityDecision, OvernightDecisionSnapshot,
// TradeJournalReview, DecisionReviewRecord, etc.) — ~600 lines of
// interconnected contracts.
//
// For Phase 5a (display-only journal port with mocked data), we
// narrow to *only the fields the TradeJournalPanel reads*. Phase 6
// will replace this shim with the full overnight-types port (or a
// proxy through cerniq backend per the coexistence decision).

export type JournalReviewState =
  | "unreviewed"
  | "reviewed"
  | "action_required"
  | "promoted_learning"
  | "false_positive"
  | "false_negative"
  | "execution_anomaly"
  | "thesis_confirmed"
  | "thesis_rejected";

export type TradeJournalOutcome =
  | "executed"
  | "blocked"
  | "suppressed"
  | "closed_win"
  | "closed_loss";

export interface TradeJournalNote {
  noteId: string;
  reviewState: JournalReviewState;
  note: string;
  createdAt: string;
}

export interface TradeThesisSummary {
  headline: string;
  chain: string[];
  allocatorSummary: string | null;
  executionSummary: string;
}

export interface TradeJournalReview {
  reviewState: JournalReviewState;
  notes: TradeJournalNote[];
}

export interface TradeJournalRealizedOutcome {
  realizedPnl: string | number | null;
  closedAt: string | null;
}

export interface TradeJournalRecord {
  journalId: string;
  pair: string | null;
  direction: "LONG" | "SHORT" | null;
  outcome: TradeJournalOutcome;
  createdAt: string;
  thesis: TradeThesisSummary;
  realizedOutcome: TradeJournalRealizedOutcome;
  review: TradeJournalReview;
}

export interface TradeJournalSummary {
  unreviewedCount: number;
  latestExecuted: TradeJournalRecord | null;
  latestBlockedOrSuppressed: TradeJournalRecord | null;
}
