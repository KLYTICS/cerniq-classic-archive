# CERNIQ Apple Apps

Native Apple scaffold for CERNIQ with:

- `CerniqiOS`: iPhone and iPad shell
- `CerniqmacOS`: desktop shell
- `CerniqApple.xcodeproj`: Xcode project for native Apple builds

The native apps intentionally reuse the existing CERNIQ web product instead of
forking business logic. The first release focuses on:

- native navigation and app chrome
- environment switching for production, local, or custom URLs
- embedded CERNIQ portal, submit, reports, billing, and status flows
- a macOS-first local run loop via `./script/build_and_run.sh`

Local defaults:

- Production web origin: `https://cerniq.io`
- Local web origin: `http://localhost:3001`

Notes:

- The Swift package in `../Package.swift` is the source of truth for app state,
  WebKit wrappers, auth/session logic, and native overview flows.
- This Xcode project is intentionally thin: entry points, plists, assets,
  entitlements, signing settings, and packaging metadata.
- The Apple apps do not introduce new backend dependencies. They point at the
  same CERNIQ web experience and environments already used by the monorepo.

## Thin-Shell Contract

- Keep runtime logic in `../Sources/`, not inside the Xcode project folder.
- `CerniqiOSApp.swift` and `CerniqmacOSApp.swift` may compose package views and
  respond to lifecycle events such as `onOpenURL`, but they must not redefine
  session containers, API types, or browser state locally.
- Assets, privacy manifests, entitlements, bundle identifiers, schemes, and
  future signing/distribution metadata belong here.
