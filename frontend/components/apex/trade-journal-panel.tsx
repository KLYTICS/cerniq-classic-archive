"use client";

// Apex absorption — Phase 5a TradeJournalPanel (2026-05-16).
//
// Port of `apex/components/trade-journal-panel.tsx` adapted for the
// Phase 5 display-only pattern. The original 261-line panel binds
// directly to `useTradeJournal()` + `useSessionDraft()` (a hook duo
// that performs API fetches, local-storage draft state, and review
// mutations). For Phase 5 we narrow that to a *single view-model
// prop* — the panel becomes pure rendering with internal state for
// the selected record + the in-flight review-state toggle.
//
// "Preserve original form" per absorption directive:
//   - Layout, styling, color constants preserved verbatim
//     (#4FC3F7 label, #c8dff0 text, #ff8a80 critical, #00FFB2
//     success, etc.)
//   - The REVIEW_ACTIONS palette is identical to Apex's
//   - Search input, review buttons, textarea, and Save Journal
//     Review button remain in the visual surface — they're wired
//     to *no-op* handlers that update local state only. The button
//     copy says "READ-ONLY DEMO" instead of saving.
//
// Phase 6 will replace the prop-driven view-model with the real
// useTradeJournal() hook (after the data-hook is implemented over
// the coexistence path from Phase 3).

import { useMemo, useState, type ChangeEvent } from "react";
import type {
  JournalReviewState,
  TradeJournalOutcome,
  TradeJournalRecord,
  TradeJournalSummary,
} from "@/lib/apex/trade-journal-contracts";

const REVIEW_ACTIONS: Array<{
  state: JournalReviewState;
  label: string;
}> = [
  { state: "reviewed", label: "Reviewed" },
  { state: "thesis_confirmed", label: "Thesis Confirmed" },
  { state: "thesis_rejected", label: "Thesis Rejected" },
  { state: "action_required", label: "Needs Action" },
  { state: "execution_anomaly", label: "Execution Anomaly" },
  { state: "false_positive", label: "False Positive" },
  { state: "false_negative", label: "False Negative" },
  { state: "promoted_learning", label: "Promote Learning" },
];

function colorForOutcome(outcome: TradeJournalOutcome) {
  if (outcome === "closed_win") return "#00FFB2";
  if (outcome === "closed_loss") return "#FF4757";
  if (outcome === "executed") return "#4FC3F7";
  if (outcome === "suppressed") return "#FFD166";
  return "#FF8A80";
}

function colorForReviewState(reviewState: JournalReviewState) {
  if (
    reviewState === "reviewed" ||
    reviewState === "thesis_confirmed" ||
    reviewState === "promoted_learning"
  ) {
    return "#00FFB2";
  }
  if (
    reviewState === "action_required" ||
    reviewState === "false_negative" ||
    reviewState === "execution_anomaly"
  ) {
    return "#FFD166";
  }
  if (reviewState === "false_positive" || reviewState === "thesis_rejected") {
    return "#FF8A80";
  }
  return "#4FC3F7";
}

function compactSummary(record: TradeJournalRecord | null, fallback: string) {
  if (!record) return fallback;
  return `${record.pair ?? "No pair"} · ${record.outcome.replaceAll("_", " ")} · ${record.thesis.headline}`;
}

export interface TradeJournalPanelProps {
  records: TradeJournalRecord[];
  summary: TradeJournalSummary;
  compact?: boolean;
}

export function TradeJournalPanel({
  records,
  summary,
  compact = false,
}: TradeJournalPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    records[0]?.journalId ?? null,
  );
  const [pendingState, setPendingState] =
    useState<JournalReviewState>("reviewed");
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selected = useMemo(
    () => records.find((r) => r.journalId === selectedId) ?? null,
    [records, selectedId],
  );

  const visibleRecords = useMemo(
    () => records.slice(0, compact ? 4 : 8),
    [compact, records],
  );

  return (
    <section
      style={{
        background: compact ? "#07111b" : "#08131f",
        border: "1px solid #123046",
        borderRadius: 4,
        padding: compact ? 12 : 16,
        color: "#c8dff0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ color: "#4FC3F7", fontSize: 10, letterSpacing: 2 }}>
            {compact ? "TRADE JOURNAL" : "DESK TRADE JOURNAL"}
          </div>
          <div
            style={{
              color: "#F5F7FA",
              fontSize: compact ? 13 : 15,
              fontWeight: 700,
            }}
          >
            {summary.unreviewedCount} unreviewed journal item
            {summary.unreviewedCount === 1 ? "" : "s"}
          </div>
        </div>
        <button
          type="button"
          disabled
          style={{
            border: "1px solid #1d425c",
            background: "transparent",
            color: "#7aa6c2",
            padding: "6px 10px",
            cursor: "not-allowed",
          }}
        >
          READ-ONLY DEMO
        </button>
      </div>

      {!compact ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              border: "1px solid #102638",
              padding: 10,
              background: "#050d16",
            }}
          >
            <div style={{ fontSize: 11, color: "#7aa6c2", marginBottom: 6 }}>
              LATEST EXECUTED
            </div>
            <div style={{ fontSize: 12 }}>
              {compactSummary(
                summary.latestExecuted,
                "No executed trade is journaled yet.",
              )}
            </div>
          </div>
          <div
            style={{
              border: "1px solid #102638",
              padding: 10,
              background: "#050d16",
            }}
          >
            <div style={{ fontSize: 11, color: "#7aa6c2", marginBottom: 6 }}>
              LATEST BLOCKED / SUPPRESSED
            </div>
            <div style={{ fontSize: 12 }}>
              {compactSummary(
                summary.latestBlockedOrSuppressed,
                "No blocked or suppressed idea is journaled yet.",
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {!compact ? (
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search pair, thesis, review notes, or reason code (demo)"
            style={{
              background: "#050b12",
              border: "1px solid #16384f",
              color: "#d8ecfa",
              padding: "10px 12px",
            }}
          />
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr" : "0.9fr 1.1fr",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            {visibleRecords.map((record) => (
              <button
                key={record.journalId}
                type="button"
                onClick={() => setSelectedId(record.journalId)}
                style={{
                  textAlign: "left",
                  border:
                    selected?.journalId === record.journalId
                      ? "1px solid #4FC3F7"
                      : "1px solid #0f2738",
                  background: "#050d16",
                  padding: 10,
                  cursor: "pointer",
                  color: "#d8ecfa",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    {record.pair ?? "NO PAIR"}{" "}
                    {record.direction ? `· ${record.direction}` : ""}
                  </span>
                  <span
                    style={{
                      color: colorForOutcome(record.outcome),
                      fontSize: 11,
                    }}
                  >
                    {record.outcome.replaceAll("_", " ").toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  {record.thesis.headline}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 11,
                    color: "#9ecae1",
                  }}
                >
                  <span
                    style={{
                      color: colorForReviewState(record.review.reviewState),
                    }}
                  >
                    {record.review.reviewState.replaceAll("_", " ")}
                  </span>
                  <span>{record.createdAt}</span>
                </div>
              </button>
            ))}
          </div>

          {selected ? (
            <div
              style={{
                border: "1px solid #102638",
                padding: 12,
                background: "#050d16",
                display: "grid",
                gap: 10,
              }}
            >
              <div>
                <div
                  style={{ color: "#7aa6c2", fontSize: 11, marginBottom: 4 }}
                >
                  SELECTED THESIS
                </div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {selected.thesis.headline}
                </div>
                <div style={{ fontSize: 12, color: "#9ecae1", marginTop: 4 }}>
                  {selected.pair ?? "No pair"}{" "}
                  {selected.direction ? `· ${selected.direction}` : ""} ·{" "}
                  {selected.outcome.replaceAll("_", " ")}
                </div>
              </div>

              <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                {selected.thesis.chain.map((entry) => (
                  <div key={entry}>{entry}</div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: compact ? "1fr" : "repeat(2, 1fr)",
                  gap: 10,
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ color: "#7aa6c2", fontSize: 11 }}>
                    ALLOCATOR
                  </div>
                  <div>
                    {selected.thesis.allocatorSummary ??
                      "No allocator summary recorded."}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#7aa6c2", fontSize: 11 }}>
                    EXECUTION / OUTCOME
                  </div>
                  <div>{selected.thesis.executionSummary}</div>
                  <div style={{ color: "#9ecae1", marginTop: 4 }}>
                    Realized PnL:{" "}
                    {selected.realizedOutcome.realizedPnl ?? "pending"}
                    {selected.realizedOutcome.closedAt
                      ? ` · Closed ${selected.realizedOutcome.closedAt}`
                      : ""}
                  </div>
                </div>
              </div>

              {!compact ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {REVIEW_ACTIONS.map((action) => (
                      <button
                        key={action.state}
                        type="button"
                        onClick={() => setPendingState(action.state)}
                        style={{
                          border:
                            pendingState === action.state
                              ? "1px solid #4FC3F7"
                              : "1px solid #1d425c",
                          background: "transparent",
                          color:
                            pendingState === action.state
                              ? "#4FC3F7"
                              : "#9ecae1",
                          padding: "6px 8px",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={draft}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                      setDraft(event.target.value)
                    }
                    placeholder="Append desk learning, blocked-trade review, or execution anomaly notes (demo: not persisted)"
                    style={{
                      minHeight: 84,
                      background: "#050b12",
                      border: "1px solid #16384f",
                      color: "#d8ecfa",
                      padding: 10,
                    }}
                  />

                  <button
                    type="button"
                    disabled
                    style={{
                      border: "1px solid #1d425c40",
                      background: "rgba(122,166,194,0.06)",
                      color: "#7aa6c2",
                      padding: "10px 12px",
                      cursor: "not-allowed",
                      fontWeight: 700,
                    }}
                  >
                    SAVE JOURNAL REVIEW · READ-ONLY DEMO
                  </button>
                </>
              ) : null}

              <div
                style={{
                  borderTop: "1px solid #102638",
                  paddingTop: 10,
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ color: "#7aa6c2", fontSize: 11 }}>
                  THESIS MEMORY
                </div>
                {(selected.review.notes.length > 0 ? selected.review.notes : [])
                  .slice(-4)
                  .reverse()
                  .map((entry) => (
                    <div
                      key={entry.noteId}
                      style={{ fontSize: 12, color: "#d5e7f5" }}
                    >
                      {entry.createdAt} ·{" "}
                      {entry.reviewState.replaceAll("_", " ")} · {entry.note}
                    </div>
                  ))}
                {selected.review.notes.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#9ecae1" }}>
                    No journal notes have been captured for this item yet.
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              style={{
                border: "1px solid #102638",
                padding: 12,
                background: "#050d16",
                color: "#7aa6c2",
                fontSize: 13,
              }}
            >
              Select a journal item to inspect the thesis chain and capture desk
              learning.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
