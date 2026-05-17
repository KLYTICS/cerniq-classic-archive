# Backend runtime consolidation roadmap

Companion to [`system_map.md`](system_map.md). Goal: shrink public attack surface and reduce operational divergence.

## Current state

| Runtime | Role | Target |
|---------|------|--------|
| `backend-node/` (NestJS) | Canonical ALM, portal, billing, agents, commerce | Retain as primary HTTP API |
| `backend/` (Rust, Axum) | Legacy/adjacent market and risk APIs | Freeze new features; deprecate overlapping routes |
| `crates/compute-core/` | Rust quant primitives | Expose via Nest worker/queue or library boundary only |
| `apps/api/` (Bun) | CapexCycle scaffold | Archive or redirect to Nest |

## Phases

1. **Inventory** — List externally reachable origins (Railway/Vercel rewrites, Fly if any); document canonical hostnames (`api.cerniq.io`).
2. **Dedupe APIs** — For each Rust route duplicated in Nest, migrate traffic and sunset Rust handler.
3. **Compute boundary** — Long term: WASM or RPC from Nest to Rust for heavy quant only (no redundant auth layers).
4. **Pen test alignment** — One primary API simplifies annual pen test and SOC evidence.

## Completion criteria

- Single customer-facing authenticated API tier (Nest) + narrowly scoped webhook/cron entrypoints documented in middleware.
