"use client";

// Apex absorption — Phase 5b IntradayPnL panel (2026-05-17).
//
// Verbatim port of `apex/components/intraday-pnl.tsx` (53 lines).
// Only adjustment: the `getSession()` helper from apex/lib/utils.ts
// is inlined here since it's a 7-line UTC-hour → FX-session classifier
// and we don't want to drag the full lib/utils surface in for two
// callers. The session classification logic is byte-identical to
// the original.
//
// "Preserve original form" — same SVG mini-sparkline (180×24),
// same color constants (#00FFB2 green / #FF4757 red / session-color
// pulse), same monospace font, same "INTRADAY" eyebrow.
//
// Hydration note: `new Date()` inside `getSession()` is non-
// deterministic between SSR and client hydration. The original
// Apex component is "use client" so this is a known pattern; we
// preserve it. If hydration mismatch warnings appear, the fix is
// to delay the session render to a useEffect-driven `mounted`
// state — but we don't introduce that change here; we preserve.

import { useState, useEffect, useRef } from "react";

function getSession(): { name: string; col: string } {
  const h = new Date().getUTCHours();
  if (h >= 8 && h < 13) return { name: "LONDON", col: "#4FC3F7" };
  if (h >= 13 && h < 17) return { name: "OVERLAP", col: "#00FFB2" };
  if (h >= 17 && h < 21) return { name: "NEW YORK", col: "#FF6D3B" };
  if (h >= 0 && h < 9) return { name: "TOKYO", col: "#A78BFA" };
  return { name: "OFF-HOURS", col: "#FF4757" };
}

export function IntradayPnL({ totalPnl }: { totalPnl: number }) {
  const [history, setHistory] = useState<Array<{ pnl: number; t: number }>>([]);
  const prevPnl = useRef(totalPnl);
  const session = getSession();

  useEffect(() => {
    setHistory((prev) => {
      if (Math.abs(totalPnl - prevPnl.current) <= 0.01 && prev.length > 0) {
        return prev;
      }
      prevPnl.current = totalPnl;
      return [...prev.slice(-100), { pnl: totalPnl, t: Date.now() }];
    });
  }, [totalPnl]);

  const w = 180;
  const h = 24;
  if (history.length < 2) return null;

  const vals = history.map((h) => h.pnl);
  const mn = Math.min(...vals, 0);
  const mx = Math.max(...vals, 0);
  const rng = mx - mn || 1;

  const pts = vals
    .map(
      (v, i) =>
        `${(i / (vals.length - 1)) * w},${h - ((v - mn) / rng) * (h - 2) - 1}`,
    )
    .join(" ");

  const zeroY = h - ((0 - mn) / rng) * (h - 2) - 1;
  const col = totalPnl >= 0 ? "#00FFB2" : "#FF4757";

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        padding: "0 4px",
      }}
    >
      <div>
        <div style={{ color: "#0d1f2e", fontSize: 6 }}>INTRADAY</div>
        <div
          style={{
            color: col,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "monospace",
          }}
        >
          {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
        </div>
      </div>
      <svg
        width={w}
        height={h}
        style={{ display: "block", overflow: "visible" }}
      >
        <line
          x1={0}
          x2={w}
          y1={zeroY}
          y2={zeroY}
          stroke="#1a3040"
          strokeWidth={0.3}
        />
        <polyline
          points={pts}
          fill="none"
          stroke={col}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <circle
          cx={w}
          cy={h - ((totalPnl - mn) / rng) * (h - 2) - 1}
          r={2}
          fill={col}
        />
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <div
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: session.col,
          }}
          className="pulse"
        />
        <span style={{ color: session.col, fontSize: 7 }}>{session.name}</span>
      </div>
    </div>
  );
}
