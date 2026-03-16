# AGENTS.md

This repository supports repo-aware engineering agents, including Codex and other codebase analysis tools.

## Primary Rule

The codebase is the source of truth.

Agents must derive conclusions primarily from:

- package manifests and lockfiles
- controller and route definitions
- DTOs, validators, schemas, models, and migrations
- frontend routes, server handlers, and API clients
- infrastructure and deployment files
- tests

Repository prose and older docs are secondary evidence and may be stale.

## Required Behavior

Agents must:

1. Separate:
   - confirmed from code
   - inferred from code structure
   - claimed only by docs
   - missing or unverifiable

2. Distinguish clearly between:
   - active systems
   - partial implementations
   - prototypes or scaffolding
   - dead or drifted paths

3. Never expose:
   - secrets
   - tokens
   - raw env values
   - private keys
   - sensitive identifiers

4. Report drift explicitly across:
   - product positioning
   - architecture docs
   - environment assumptions
   - deployment configuration
   - API contracts
   - auth flows

5. Prefer repo-ready markdown outputs using the standard section structure below unless asked otherwise.

## Repository Shape

Current major surfaces observed in the repo include:

- `frontend/` -> Next.js 16 + React 19 app
- `backend-node/` -> NestJS 11 API and business modules
- `backend/` -> Rust Axum analytics and compute service
- `apps/api/` -> Bun-based API surface that appears lightweight or experimental
- `infra/` -> deployment and infrastructure material
- `docs/` -> planning and architecture docs, which may contain stale narratives

Product positioning appears mixed across the repo. Agents must not smooth over conflicts between:

- quant analytics language
- ALM and institutional reporting flows
- SpendCheck workflows
- broader enterprise intelligence positioning

## Analysis Priority

Inspect in this order:

1. manifests and lockfiles
2. backend routes, controllers, and modules
3. frontend app routes and fetch paths
4. schemas, migrations, and models
5. infra and deployment files
6. tests
7. docs for drift analysis

## Runtime Audit Notes

When summarizing the repo, agents should explicitly classify each major subsystem as one of:

- scaffold only
- partial build
- functioning core
- production-leaning
- production-ready

## Required Output Standard

Unless otherwise requested, use this structure:

```md
# Title

## Executive Summary
## Confirmed Implementation
## Inferred Architecture
## Product/User Flows
## Data/Auth/Infra
## Risks and Drift
## Recommended Next Steps
```

## Related Agent Docs

Use the operating docs in [`docs/agent/`](/Users/money/Desktop/Cerniq/docs/agent) for the detailed checklist, output schemas, drift templates, and change-planning formats.
