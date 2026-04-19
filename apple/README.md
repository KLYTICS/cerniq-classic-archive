# CERNIQ Apple

This package is the canonical Apple implementation surface inside the monorepo.

## What is implemented now

- Shared Apple-platform domain models for auth, workspace, institution, report jobs, and export manifests.
- A protocol-first API layer aligned to the current live backend contracts, including cookie-backed auth and paginated institutions decoding.
- Native auth/session management with pluggable credential storage.
- Shared SwiftUI shell state and root views for iOS and macOS.
- A package-driven macOS executable shell target.
- Fixture-driven contract checks for request construction, auth/session behavior, overview loading, portal jobs, and offline fallback.
- Swift package test targets intended for full-Xcode/macOS-runner execution.

## Architecture

- `Sources/CerniqDomain`: shared value types.
- `Sources/CerniqAPI`: endpoint and HTTP client layer.
- `Sources/CerniqAuth`: credential storage and session orchestration.
- `Sources/CerniqFeatures`: shared SwiftUI shell, overview flows, and app session container.
- `Sources/CerniqMacApp`: package-first macOS shell executable.
- `Fixtures`: captured JSON contracts used by contract verification.
- `Tests`: Swift package unit tests for domain, API, auth, and feature state.

The Xcode project under `apple/CerniqApple/` is now intended to be a thin shell over this package rather than a second implementation tree.

## Ownership Rules

- `Sources/` owns all business logic: domain types, API/auth/session code, WebKit wrappers, deep-link handling, native feature flows, and contract verification helpers.
- `CerniqApple/` owns packaging-only concerns: app entrypoints, plists, assets, entitlements, signing settings, and future distribution metadata.
- Do not add duplicate models, API clients, session stores, or WebKit wrappers under `CerniqApple/`.
- If an Apple-consumed backend response changes, update the matching fixture in `Fixtures/` and the assertions in `CerniqContractsCheck` in the same change.

## Merge Gates

- Apple-path changes must pass `bash scripts/apple/verify.sh`.
- Backend/frontend changes that affect Apple-consumed contracts must also keep `CerniqContractsCheck` green.
- Clean-worktree verification is mandatory after Apple checks so generated Swift artifacts or fixture drift do not merge silently.

## Verification

Repo-level Apple verification:

```bash
bash scripts/apple/verify.sh
```

That script always runs:

```bash
swift build
swift run CerniqContractsCheck
```

When full Xcode is active, it also runs:

```bash
swift test
```

In the current Command Line Tools-only environment, `swift test` is still blocked because Apple test frameworks are not exposed without full Xcode.
