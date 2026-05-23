import type { ReactNode } from "react";
import type { Metadata } from "next";

import "@/styles/apex-theme.css";

// Apex absorption — Phase 1.0 scaffold (2026-05-17).
//
// Per the directive "this must fully swallow all apex functionalities and
// take on and preserve original form", the /apex/* route family is the
// preserved Apex surface within cerniq's frontend. This sub-app layout:
//
//   1. Imports `styles/apex-theme.css` (which scopes Apex's CSS vars +
//      font stack to `.apex-shell` — does NOT pollute cerniq globals).
//   2. Wraps every /apex/* route with the `apex-shell` className so
//      Apex-style components inherit the matte-black aesthetic.
//   3. Sets distinct metadata so /apex pages identify visually as Apex,
//      while remaining part of the cerniq app surface.
//
// Future phases will extend this layout with Apex's top-nav, workspace
// gate, sovereign role detection, and the workspace-hub routing logic
// (originally in apex/app/apex-entry-page.tsx). For Phase 1.0 the
// layout is intentionally minimal — just the shell + theme.

export const metadata: Metadata = {
  title: "APEX — Trading Command Center",
  description:
    "KLYTICS APEX command center. Autonomous FX execution, real-time risk telemetry, and operator-grade trade journaling — embedded within the CERNIQ platform.",
};

export default function ApexSubAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="apex-shell">{children}</div>;
}
