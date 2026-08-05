// Apex absorption — Phase 3 (data layer coexistence, 2026-05-16).
//
// Operator decision (locked 2026-05-16): /apex/* coexists with the
// existing Apex Supabase project rather than migrating tables into
// cerniq's Prisma schema. This file owns the *namespaced env contract*
// for that coexistence.
//
// Env var naming rationale:
//   - `NEXT_PUBLIC_APEX_SUPABASE_URL` — public, browser-safe; distinct
//     from cerniq's own `SUPABASE_URL` (unified KLYTICS auth). The
//     two projects must not collide.
//   - `NEXT_PUBLIC_APEX_SUPABASE_ANON_KEY` — RLS-gated anon key. Apex's
//     own RLS rules govern read access; no service-role key needed for
//     read-only /apex/* surfaces in Phase 3.
//
// Server-side (Phase 6 backend handlers) may add an
// `APEX_SUPABASE_SERVICE_ROLE_KEY` for elevated writes, but Phase 3
// is read-only first-paint only.
//
// Graceful degradation contract:
//   - When BOTH env vars are set → `isApexSupabaseConfigured()` returns
//     true; fetchers attempt live queries.
//   - When EITHER env var is empty → returns false; fetchers return
//     null and the calling page falls back to mocked data.
//
// This decouples /apex/* rendering from Apex DB availability: cerniq
// CI, preview deploys, and local dev all work without setting up
// Apex Supabase credentials. The surfaces still render — just without
// live data.

export interface ApexSupabaseConfig {
  url: string;
  anonKey: string;
}

export function readApexSupabaseConfig(): ApexSupabaseConfig | null {
  const url = (process.env.NEXT_PUBLIC_APEX_SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_APEX_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isApexSupabaseConfigured(): boolean {
  return readApexSupabaseConfig() !== null;
}
