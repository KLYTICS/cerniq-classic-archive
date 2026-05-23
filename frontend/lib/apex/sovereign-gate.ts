// ═════════════════════════════════════════════════════════════════════════════
// APEX ABSORPTION · PHASE 4 · SOVEREIGN PAGE GATE
//
// Stricter stealth posture than Apex source: every non-sovereign caller —
// authenticated or not — gets a notFound() in protected mode. Cerniq has
// no GitHub-OIDC signin flow today (Phase 6 work), so a redirect-to-signin
// path wouldn't help an unauthenticated visitor become sovereign anyway,
// and would leak the route's existence to probes.
//
// In DEMO mode (the default — NEXT_PUBLIC_DEMO_MODE !== "false") the gate
// is a no-op: the page renders normally with mocked data. Operators flip
// NEXT_PUBLIC_DEMO_MODE="false" + APEX_SOVEREIGN_GITHUB_LOGINS="<login>"
// in deploy env to activate the gate without any code change.
//
// The audit-chain write Apex performs on denied access (writeSovereignAudit)
// is deferred to Phase 6 — it requires the absorbed audit pipeline which
// lives alongside the 262 API handlers. Until then, denial is silent on the
// wire and silent in cerniq's audit_logs. This is acceptable for a stealth
// route that returns no information regardless.
// ═════════════════════════════════════════════════════════════════════════════

import {
  isApexProtectedMode,
  loadApexSessionFromCookies,
  type ApexSession,
} from "./auth-bridge";

export class ApexSovereignNotFoundError extends Error {
  constructor() {
    super("apex_sovereign_not_found");
    this.name = "ApexSovereignNotFoundError";
  }
}

// Owner-only page gate. Call from a server component before rendering any
// sovereign-scoped content; convert the thrown error to notFound() at the
// call site so the page module's type stays narrow.
//
// Returns:
//   - null   in DEMO mode (gate disabled — page renders mocked data)
//   - null   in protected mode if the caller chooses to opt out of session
//            wiring (sovereign data fetches will independently 404 server-side)
//   - ApexSession when the cookie resolves to a sovereign-allowlist match
//   - throws ApexSovereignNotFoundError otherwise
export async function requireApexSovereignAccess(): Promise<ApexSession | null> {
  if (!isApexProtectedMode()) {
    return null;
  }

  const session = await loadApexSessionFromCookies();

  if (session?.user.role === "sovereign") {
    return session;
  }

  throw new ApexSovereignNotFoundError();
}
