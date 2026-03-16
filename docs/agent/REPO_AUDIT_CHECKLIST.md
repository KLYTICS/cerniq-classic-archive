# Repo Audit Checklist

Use this checklist before producing architecture or product claims.

## A. Manifest and Runtime Audit

- [ ] Inspect `frontend/package.json`
- [ ] Inspect `backend-node/package.json`
- [ ] Inspect `backend/Cargo.toml`
- [ ] Inspect `apps/api/package.json`
- [ ] Note frameworks, runtimes, package managers, and scripts
- [ ] Identify whether services appear active, legacy, or experimental

## B. Backend Surface Audit

- [ ] List NestJS modules
- [ ] List controllers and route prefixes
- [ ] Identify auth guards and middleware
- [ ] Identify DTOs and validation paths
- [ ] Map service boundaries
- [ ] Record background jobs, schedulers, queues, and cron usage

## C. Frontend Audit

- [ ] Inspect `frontend/app/`
- [ ] Map main routes and pages
- [ ] Identify authenticated versus public flows
- [ ] Trace API calls to backend surfaces
- [ ] Check whether UI aligns with documented product narrative

## D. Data Model Audit

- [ ] Inspect Prisma schema or ORM models
- [ ] Inspect SQL migrations
- [ ] Identify major entities
- [ ] Identify tenanting assumptions
- [ ] Identify storage integrations
- [ ] Identify data model drift versus docs

## E. Rust Service Audit

- [ ] Inspect route registration
- [ ] Identify compute and analytics responsibilities
- [ ] Identify shared data contracts
- [ ] Identify whether service is actively integrated or isolated

## F. Infra and Deployment Audit

- [ ] Inspect deployment configs
- [ ] Inspect Dockerfiles, compose files, and CI workflows
- [ ] Identify env expectations
- [ ] Identify production assumptions
- [ ] Flag missing deployment glue

## G. Documentation Drift Audit

- [ ] Compare implementation to `README.md`
- [ ] Compare implementation to architecture docs
- [ ] Compare implementation to auth-unification plans
- [ ] Compare implementation to marketing and product language

## H. Final Classification

- [ ] Active systems
- [ ] Partial systems
- [ ] Scaffolding and prototypes
- [ ] Dead or unclear paths
- [ ] Major risks
- [ ] Highest-leverage next steps
