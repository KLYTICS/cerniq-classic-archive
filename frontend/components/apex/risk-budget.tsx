"use client";

// Apex absorption — Phase 5b RiskBudget panel (2026-05-17).
//
// Verbatim port of `apex/components/risk-budget.tsx` (67 lines).
// The original imports `rgb` from apex/lib/utils.ts but doesn't
// actually use it in the rendered JSX (dead import) — so we omit
// it here. Types reference the Phase 5b narrowed contracts shim.
//
// "Preserve original form" — same circular DD-gauge SVG (32×32,
// 12-radius, 75.4 arc-length, 25% offset), same color thresholds
// (green ≤50% / yellow ≤80% / red >80%), same Orbitron numerals
// on the trades-remaining + capacity counters.

import type { Trade, AutoRecommendation } from "@/lib/apex/cockpit-contracts";

export function RiskBudget({
  trades,
  totalPnl,
  rec,
  credit,
}: {
  trades: Trade[];
  totalPnl: number;
  rec: AutoRecommendation;
  credit: number;
}) {
  const account = credit > 0 ? credit : 10000;
  // 5% daily DD limit — the canonical desk-level guardrail.
  const dailyDDLimit = account * 0.05;
  const todayTrades = trades.length;

  const ddUsed = Math.abs(Math.min(totalPnl, 0));
  const ddPct = (ddUsed / dailyDDLimit) * 100;
  const ddC = ddPct > 80 ? "#FF4757" : ddPct > 50 ? "#FFD166" : "#00FFB2";

  const maxTrades = rec.maxDailyTrades;
  const tradesLeft = Math.max(0, maxTrades - todayTrades);

  const riskPerTrade = (account * parseFloat(rec.baseRisk)) / 100;
  const remainingRisk = dailyDDLimit - ddUsed;
  const tradesAtRisk = Math.floor(remainingRisk / riskPerTrade);

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "0 4px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ position: "relative", width: 32, height: 32 }}>
          <svg width={32} height={32} viewBox="0 0 32 32">
            <circle
              cx={16}
              cy={16}
              r={12}
              fill="none"
              stroke="#0a1520"
              strokeWidth={3}
            />
            <circle
              cx={16}
              cy={16}
              r={12}
              fill="none"
              stroke={ddC}
              strokeWidth={3}
              strokeDasharray={`${(ddPct / 100) * 75.4} 75.4`}
              strokeDashoffset={75.4 * 0.25}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray .5s" }}
            />
            <text
              x={16}
              y={18}
              textAnchor="middle"
              fill={ddC}
              fontSize={7}
              fontWeight={700}
            >
              {ddPct.toFixed(0)}%
            </text>
          </svg>
        </div>
        <div style={{ color: "#0d1f2e", fontSize: 5, marginTop: 1 }}>
          DD USED
        </div>
      </div>

      <div>
        <div style={{ color: "#0d1f2e", fontSize: 6 }}>TRADES</div>
        <div
          style={{
            color:
              tradesLeft > 2
                ? "#00FFB2"
                : tradesLeft > 0
                  ? "#FFD166"
                  : "#FF4757",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "Orbitron",
          }}
        >
          {tradesLeft}/{maxTrades}
        </div>
      </div>

      <div>
        <div style={{ color: "#0d1f2e", fontSize: 6 }}>CAPACITY</div>
        <div
          style={{
            color: tradesAtRisk > 2 ? "#00FFB2" : "#FFD166",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "Orbitron",
          }}
        >
          {tradesAtRisk}
        </div>
        <div style={{ color: "#0d1f2e", fontSize: 5 }}>trades left</div>
      </div>
    </div>
  );
}
