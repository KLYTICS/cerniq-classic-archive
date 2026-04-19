# Latest Session Handoff

Date: 2026-04-18
Workspace: `/Users/money/Desktop/Cerniq`
Focus: Apple enterprise scaffold validation
Session nickname: `apple-validation`

## Current Apple State

- The Apple scaffold is package-first under `apple/Package.swift`.
- The Xcode shell lives under `apple/CerniqApple/`.
- The canonical verification entrypoint is `npm run verify:apple`.
- Full Xcode is active on this machine and both workspace schemes are now testable locally.

## Local Apple Validation Completed

- `xcodebuild -list -workspace apple/CerniqApple/CerniqApple.xcodeproj/project.xcworkspace`: pass
- `swift build`: pass
- `swift run CerniqContractsCheck`: pass
- `swift test`: available through the full-Xcode path
- `xcodebuild test -workspace apple/CerniqApple/CerniqApple.xcodeproj/project.xcworkspace -scheme "CERNIQ macOS" -destination "platform=macOS,arch=arm64" ONLY_ACTIVE_ARCH=YES ARCHS=arm64`: pass
- `xcodebuild test -workspace apple/CerniqApple/CerniqApple.xcodeproj/project.xcworkspace -scheme "CERNIQ iOS" -destination "platform=iOS Simulator,id=10A0FFF0-C75E-4450-A808-E7CACBCAC77A" ONLY_ACTIVE_ARCH=YES`: pass
- `npm run verify:apple`: pass end to end, including the iOS simulator test bundle

## Remaining Apple Gaps

- Archive/export now has a real entrypoint at `bash scripts/apple/archive.sh`, but live release execution still depends on `APPLE_DEVELOPMENT_TEAM` plus final signing/export credentials.
- Placeholder release assets remain intentionally provisional.

## Reserved Paths

- `apple/`
- `scripts/apple/`
- Apple verification wiring in `package.json`
- Apple CI wiring in `.github/workflows/ci.yml` and `.github/workflows/ci-cd.yml`

## Best Next Actions

1. Run `APPLE_DEVELOPMENT_TEAM=... npm run archive:apple -- --dry-run` to confirm the release lane inputs, then execute the real archive/export flow once credentials are available.
2. Decide whether to grow the iOS test bundle beyond the current smoke assertion into UI or session-flow coverage.
3. Keep Apple changes isolated to the reserved paths until the scaffold is committed or handed off.
