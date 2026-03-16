# Codex Operating Guide

This guide defines how repo-aware agents should work inside CERNIQ.

## Mission

Produce implementation-grounded technical analysis, planning, and documentation without inventing product scope or smoothing over architectural drift.

## Rules of Evidence

### Confirmed

Only supported directly by:

- routes and controllers
- module wiring
- frontend pages and data calls
- DTOs, schemas, models, and validators
- migrations
- deployment files
- tests

### Inferred

Reasonable conclusion based on structure, naming, imports, and composition, but not directly proven by runtime paths.

### Claimed by Docs

Stated in docs or readmes but not clearly evidenced in implementation.

### Missing / Unverifiable

Cannot be established from repository evidence.

## Runtime Classification

Every subsystem should be classified as one of:

- scaffold only
- partial build
- functioning core
- production-leaning
- production-ready

## Product Narrative Discipline

CERNIQ may currently express multiple narratives, including:

- quant analytics
- ALM and institutional reporting
- SpendCheck workflows
- multi-product platform behavior

Agents must report narrative drift rather than unify it prematurely.

## Default Deliverables

Agents should be capable of generating:

- repo intelligence briefs
- architecture docs
- API contract references
- drift reports
- change plans
- execution-readiness briefs
- stakeholder translations

## Security Rules

Never output:

- `.env` contents
- API keys
- secret tokens
- credentials
- signing material

Describe sensitive configuration by role only.
