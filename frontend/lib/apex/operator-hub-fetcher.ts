// Apex absorption — Phase 3 operator-hub fetcher (2026-05-16).
//
// Defines the *interface* the /apex/hub page consumes to obtain a
// first-paint snapshot. Implementation strategy is gated by the
// Phase 3 coexistence decision (locked 2026-05-16):
//
//   1. If `NEXT_PUBLIC_APEX_SUPABASE_URL` + `NEXT_PUBLIC_APEX_SUPABASE_ANON_KEY`
//      are set, the fetcher will eventually query Apex Supabase
//      directly (or proxy through the cerniq backend per Phase 6).
//   2. If not configured, the fetcher returns null — the page
//      gracefully falls back to a mocked snapshot.
//
// Why a stub today: composing OperatorHubFirstPaintSummary requires
// porting 524 lines of aggregation logic from `apex/lib/operator-hub/
// first-paint.ts` (which itself depends on 6+ input contracts:
// ShiftStartSnapshot, DeskCommandSnapshot, CollaborationBootstrap-
// Snapshot, OperatorTrustSnapshot, LiveRolloutDeskSnapshot, Research-
// HubSummary). That aggregation belongs in the backend (Phase 6)
// alongside the 262 API handlers being ported. Until then, this
// fetcher establishes the contract surface so the page rendering
// path stays stable.
//
// Phase 6 will replace `null` with one of:
//   - Direct Supabase REST: fetch(`${url}/rest/v1/operator_hub_first_paint?...`)
//   - Cerniq backend proxy: fetch(`${cerniq_api}/apex/operator-hub/first-paint`)
//
// The choice between direct vs. proxy is Phase 6's call; Phase 3
// only commits to "the data source is namespaced and read-only-anon".

import type { OperatorHubFirstPaintSummary } from "@/lib/apex/operator-hub-contracts";
import {
  isApexSupabaseConfigured,
  readApexSupabaseConfig,
} from "@/lib/apex/supabase-config";

export interface OperatorHubFetchResult {
  // The first-paint snapshot, or null if no live data is available.
  // The /apex/hub page MUST gracefully render with a fallback when
  // this is null — the page never breaks just because Apex Supabase
  // isn't configured.
  snapshot: OperatorHubFirstPaintSummary | null;

  // Reason for absence, for debug overlay + observability. Never
  // surfaced to end users; written to the page's data-* attributes
  // so dev tools / e2e tests can distinguish "configured but failed"
  // from "intentionally unconfigured".
  reason:
    | "configured"
    | "not_configured"
    | "deferred_to_phase_6"
    | "fetch_failed";
}

export async function fetchOperatorHubFirstPaint(): Promise<OperatorHubFetchResult> {
  if (!isApexSupabaseConfigured()) {
    return { snapshot: null, reason: "not_configured" };
  }

  // Phase 6 will replace this branch with the real fetch path.
  // Until then: env is wired, contract is established, page falls
  // back to mock with the correct debug reason.
  const config = readApexSupabaseConfig();
  void config;
  return { snapshot: null, reason: "deferred_to_phase_6" };
}
