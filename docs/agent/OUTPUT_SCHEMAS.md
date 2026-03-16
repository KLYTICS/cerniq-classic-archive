# Output Schemas

Use these schemas when generating documentation from the CERNIQ repository.

## 1. Repo Intelligence Brief

```md
# Repo Intelligence Brief

## Executive Summary
- What the repo most likely does
- Which product narrative appears strongest
- Whether the repo appears unified or in transition

## Confirmed Implementation
- Frontend
- Backend(s)
- Data/storage
- Auth
- Jobs/workers
- Deployment evidence

## Inferred Architecture

## Major System Areas
| Area | Runtime | Status | Evidence |
|---|---|---|---|

## Product/User Flows
| Flow | Confirmed / Inferred | Notes |
|---|---|---|

## Data/Auth/Infra

## Risks and Drift
- Product positioning drift
- API/documentation drift
- Env/deployment drift
- Auth inconsistency
- Dead code / unclear surfaces

## Recommended Next Steps
1. ...
2. ...
3. ...

## Business Description Based on Implementation
```

## 2. Architecture Document

```md
# Architecture

## Executive Summary
## Product Purpose
## Active Runtimes and Boundaries
## Main Components
## Request Lifecycles
## Auth Model
## Data and Storage Model
## Jobs / Workers / Scheduled Logic
## External Integrations
## Deployment Topology
## Local Development Topology
## Configuration Model
## Observability / Operational Concerns
## Known Drift
## Missing Pieces
## Risks
```

## 3. API Contract Reference

```md
# API Contract Reference

## Executive Summary
## API Surfaces
## Auth Model

## Confirmed Endpoints

### [Runtime / Module]
| Method | Path | Purpose | Auth | Request | Response | Error Cases | Evidence |
|---|---|---|---|---|---|---|---|

## DTO / Schema Notes
## Drift and Gaps
## Recommended Documentation Fixes
```

## 4. Drift Report

```md
# Drift Report

## Summary
## Positioning Drift
## Architecture Drift
## API Drift
## Auth Drift
## Environment / Deployment Drift
## Docs That Appear Stale
## Highest-Risk Drift Items
## Recommended Remediation Order
```

## 5. Execution Readiness Brief

```md
# Execution Readiness Brief

## Requested Change
## Current State
## Affected Systems
## File-by-File Touch List
## Schema / Migration Needs
## Env / Config Roles Affected
## Tests Needed
## Rollout Plan
## Rollback Notes
## Risk Level
```

## 6. Stakeholder Brief

```md
# Stakeholder Brief

## What CERNIQ Appears to Do Today
## Who It Appears Built For
## What Is Clearly Working or Substantially Implemented
## What Is Partial or Still Under Construction
## Main Risks Before Broader Rollout
## Recommended Next Milestones
```
