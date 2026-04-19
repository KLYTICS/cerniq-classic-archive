# Apple Release Readiness

This runbook covers the distribution-oriented Apple scaffold under `apple/`.

## Current State

- Swift package is the canonical Apple implementation surface.
- Xcode apps are intended to be thin shells over the package.
- Full Xcode is active on the current machine.
- The macOS scheme is validated through the workspace path with a native Xcode XCTest bundle plus the package test targets.
- The iOS scheme is validated through the workspace path against an iOS 26.4 simulator with a native Xcode XCTest bundle.
- Local archive, signing, notarization, and App Store submission remain blocked until Apple team credentials and export options are finalized.

## Verification Entry Points

- Canonical repo wrapper: `npm run verify:apple`
- Local foundation verification: `bash scripts/apple/verify.sh`
- Archive/export entrypoint: `bash scripts/apple/archive.sh`

`scripts/apple/archive.sh` supports:
- archiving `CERNIQ macOS` by default
- optional export via `--export`
- dry-run inspection via `--dry-run`
- templated team-id substitution for `apple/CerniqApple/export-options/ExportOptions.plist.template`

Example:

```bash
APPLE_DEVELOPMENT_TEAM=ABCDE12345 npm run archive:apple -- --dry-run --export
```

`scripts/apple/verify.sh` always runs:
- `swift build`
- `swift run CerniqContractsCheck`

When full Xcode is active, it also runs:
- `swift test`
- `xcodebuild -list -workspace apple/CerniqApple/CerniqApple.xcodeproj/project.xcworkspace`
- `xcodebuild test -workspace apple/CerniqApple/CerniqApple.xcodeproj/project.xcworkspace -scheme "CERNIQ macOS" -destination "platform=macOS,arch=$(uname -m)" ONLY_ACTIVE_ARCH=YES ARCHS=$(uname -m)`
- `xcodebuild test -workspace apple/CerniqApple/CerniqApple.xcodeproj/project.xcworkspace -scheme "CERNIQ iOS" -destination "<auto-detected iOS simulator>" -derivedDataPath "<temp>" ONLY_ACTIVE_ARCH=YES ARCHS=$(uname -m)`

Under the current Command Line Tools-only setup, those Xcode-backed steps are intentionally skipped because `XCTest` and `xcodebuild` project execution are not available without full Xcode.

## TestFlight / App Store Prerequisites

- Full Xcode installed and selected via `xcode-select`
- Apple Developer team configured in `APPLE_DEVELOPMENT_TEAM`
- App identifiers finalized for:
  - `io.cerniq.ios`
  - `io.cerniq.macos`
- App Store Connect records created for iOS and macOS apps
- Export options plist prepared for release signing
- Real app icons and screenshots added to the asset catalog
- Privacy manifest reviewed against actual SDK and tracking behavior
- Versioning and build numbering strategy finalized

## macOS Signing / Notarization Prerequisites

- Developer ID Application certificate installed
- Developer ID Installer certificate if DMG/PKG distribution is added later
- Hardened runtime reviewed and enabled for the final release lane
- Notary credentials configured for CI or local export
- Stapling and Gatekeeper verification steps added after first successful archive

## Remaining Release Tasks

- Replace placeholder app icons with production art
- Finalize entitlements after deciding deep links, associated domains, and any sandbox posture
- Add export options plist and App Store Connect submission automation
- Add notarization automation for macOS release artifacts
- Verify archive/export on a full-Xcode machine before enabling release promotion
