// ═════════════════════════════════════════════════════════════════════════════
// APEX ABSORPTION · PHASE 4 · AUTH BRIDGE
//
// Translates cerniq's cookie + /api/auth/profile session model → the Apex
// session shape consumed by absorbed Apex pages/components. Single source
// of truth for sovereign-role gating inside cerniq.
//
// Three primitives ported verbatim from APEX/lib/server/identity-policy.ts
// to preserve the security contract exactly:
//   - normalizeStringSet()           — comma-split + trim + lower-case
//   - resolveSovereignFromGithubLogin() — sole grant path for sovereign
//   - isApexProtectedMode()          — DEMO ↔ PAPER/LIVE switch
//
// Two cerniq-specific additions:
//   - deriveApexSession()             — cerniqUser → ApexSession adapter
//   - loadApexSessionFromCookies()    — server-side session loader
//
// The sovereign role's unforgeability property survives the absorption:
// `APEX_SOVEREIGN_GITHUB_LOGINS` is server-only (no NEXT_PUBLIC_ prefix);
// cerniq users without a linked GitHub login can never resolve as sovereign
// regardless of role/email/group state. Linking a GitHub login to a cerniq
// session is Phase 6 backend work — until then, sovereign mode is reachable
// only via env injection at deploy time, exactly mirroring Apex's posture.
// ═════════════════════════════════════════════════════════════════════════════

import { headers } from "next/headers";
import { getConfiguredApiOrigin } from "@/lib/api-base";
import { unwrapApiData } from "@/lib/api-response";

export type ApexRole = "viewer" | "trader" | "admin" | "sovereign";

export type ApexRoleSource =
  | "role_claim"
  | "group_mapping"
  | "email_allowlist"
  | "github_login_allowlist"
  | "sovereign_github_allowlist"
  | "default";

export interface ApexSessionUser {
  id: string;
  email: string | null;
  providerSubject: string | null;
  groups: string[];
  githubLogin: string | null;
  role: ApexRole;
  roleSource: ApexRoleSource;
}

export interface ApexSession {
  user: ApexSessionUser;
}

export interface CerniqSessionUser {
  id: string;
  email: string;
  name?: string;
  githubLogin?: string | null;
}

// Verbatim port of APEX/lib/server/identity-policy.ts normalizeStringSet.
// Comma-delimited, trimmed, lower-cased. Empty entries dropped. The lower-case
// normalization is what makes the sovereign-login allowlist case-insensitive
// (sovereign.test.ts:87-89 documents the property).
export function normalizeStringSet(raw: string | undefined): Set<string> {
  if (typeof raw !== "string") return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

// Verbatim port. Single source of truth for the sovereign grant. Reads
// APEX_SOVEREIGN_GITHUB_LOGINS (server-only; no NEXT_PUBLIC_ prefix on
// purpose — sovereign list must never reach the browser bundle).
export function resolveSovereignFromGithubLogin(
  login: string | null | undefined,
): boolean {
  if (typeof login !== "string") return false;
  const normalized = login.trim().toLowerCase();
  if (!normalized) return false;
  return normalizeStringSet(process.env.APEX_SOVEREIGN_GITHUB_LOGINS).has(
    normalized,
  );
}

// Verbatim port of getEffectiveExecutionMode !== "DEMO". cerniq defaults
// to DEMO (NEXT_PUBLIC_DEMO_MODE unset or "true") so absorbed Apex routes
// render mocked data without gating. Setting NEXT_PUBLIC_DEMO_MODE="false"
// activates the gate.
export function isApexProtectedMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "false";
}

// Translate a cerniq session user → Apex session shape. cerniq's session
// today carries id/email/name; githubLogin is optional (Phase 6 backend
// will wire it via account linking). Role defaults to "viewer" — the only
// path to elevate is APEX_SOVEREIGN_GITHUB_LOGINS via deriveApexSession's
// sovereign-upgrade step below.
export function deriveApexSession(
  cerniqUser: CerniqSessionUser | null,
): ApexSession | null {
  if (!cerniqUser) return null;

  const githubLogin = cerniqUser.githubLogin ?? null;
  const isSovereign =
    isApexProtectedMode() && resolveSovereignFromGithubLogin(githubLogin);

  return {
    user: {
      id: cerniqUser.id,
      email: cerniqUser.email || null,
      providerSubject: cerniqUser.id,
      groups: [],
      githubLogin,
      role: isSovereign ? "sovereign" : "viewer",
      roleSource: isSovereign ? "sovereign_github_allowlist" : "default",
    },
  };
}

interface CerniqProfileResponse {
  id?: unknown;
  email?: unknown;
  name?: unknown;
  githubLogin?: unknown;
}

// Server-side session loader for cerniq's apex absorption. Reads the
// inbound request's cookies, calls cerniq's backend /api/auth/profile,
// and returns the derived Apex session — or null when unauthenticated /
// API unreachable. Errors are swallowed and returned as null so a 500 on
// the auth backend never crashes an apex page (it falls through to the
// unauthenticated branch, which under stealth-404 posture means notFound).
export async function loadApexSessionFromCookies(): Promise<ApexSession | null> {
  const apiOrigin = getConfiguredApiOrigin();
  if (!apiOrigin) return null;

  try {
    const headerBag = await headers();
    const cookie = headerBag.get("cookie") || "";
    if (!cookie) return null;

    const response = await fetch(`${apiOrigin}/api/auth/profile`, {
      headers: { cookie },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const body = (await response.json().catch(() => null)) as unknown;
    const user = unwrapApiData<CerniqProfileResponse | null>(body);
    if (!user) return null;

    const id = typeof user.id === "string" ? user.id : null;
    const email = typeof user.email === "string" ? user.email : null;
    if (!id || !email) return null;

    return deriveApexSession({
      id,
      email,
      name: typeof user.name === "string" ? user.name : undefined,
      githubLogin:
        typeof user.githubLogin === "string" ? user.githubLogin : null,
    });
  } catch {
    return null;
  }
}
