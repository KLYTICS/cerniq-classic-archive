#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APPLE_DIR="$ROOT_DIR/apple"
WORKSPACE_FILE="$APPLE_DIR/CerniqApple/CerniqApple.xcodeproj/project.xcworkspace"
HOST_ARCH="$(uname -m)"
MACOS_DESTINATION="platform=macOS,arch=${HOST_ARCH}"
DERIVED_DATA_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cerniq-apple-verify.XXXXXX")"

cleanup() {
  rm -rf "$DERIVED_DATA_DIR"
}

trap cleanup EXIT

# Discover an iOS Simulator destination. Two reasons this needs care:
#   (1) Xcode 16 dropped the `arch:` field from `xcodebuild -showdestinations`
#       output. The destination format went from
#         { platform:iOS Simulator, arch:arm64, id:UDID, OS:17.0, ... }
#       to
#         { platform:iOS Simulator, id:UDID, OS:18.0, ... }
#       The arch-specific regex that worked on Xcode 15 silently fails on
#       Xcode 16 — exactly what was happening on the macos-14-arm64 GitHub
#       Actions runner after the image was updated. The fix below tolerates
#       both formats by making `arch:[^,]+, ` optional.
#   (2) When Xcode is absent (CommandLineTools only), `xcodebuild -showdestinations`
#       fails. Prior version of this script ran the discovery unconditionally
#       at script top, BEFORE the `if xcodebuild -version` guard further down
#       — which meant `set -euo pipefail` aborted the entire verification
#       lane before swift build even ran. Discovery is now scoped inside the
#       Xcode branch where it belongs.
#
# When no destination matches, we log what was actually available (visible
# in CI) and skip just the iOS test phase — mirrors the existing Xcode-
# missing fallback rather than failing the whole apple lane.

discover_ios_destination() {
  local raw_dest
  raw_dest="$(xcodebuild -showdestinations \
    -workspace "$WORKSPACE_FILE" \
    -scheme "CERNIQ iOS" 2>&1 || true)"

  # Try arch-specific match first (Xcode 15-and-earlier shape), then any
  # iOS Simulator destination (Xcode 16+ shape).
  echo "$raw_dest" | python3 -c '
import re, sys
arch = sys.argv[1]
text = sys.stdin.read()
patterns = [
  re.compile(rf"\{{ platform:iOS Simulator, arch:{re.escape(arch)}, id:([0-9A-F-]+),"),
  re.compile(r"\{ platform:iOS Simulator(?:, arch:[^,]+)?, id:([0-9A-F-]+),"),
]
for p in patterns:
  m = p.search(text)
  if m:
    print(f"platform=iOS Simulator,id={m.group(1)}")
    sys.exit(0)
sys.exit(1)
' "$HOST_ARCH"
  local rc=$?

  if [ $rc -ne 0 ] && [ -n "$raw_dest" ]; then
    echo "[apple] no iOS Simulator destination matched; xcodebuild -showdestinations returned:" >&2
    echo "$raw_dest" | head -30 >&2
  fi

  return $rc
}

echo "[apple] swift build"
(cd "$APPLE_DIR" && swift build)

if xcodebuild -version >/dev/null 2>&1; then
  echo "[apple] swift test"
  (cd "$APPLE_DIR" && swift test)

  echo "[apple] xcodebuild -list"
  xcodebuild -list \
    -workspace "$WORKSPACE_FILE"

  echo "[apple] xcodebuild test (CERNIQ macOS)"
  xcodebuild test \
    -workspace "$WORKSPACE_FILE" \
    -scheme "CERNIQ macOS" \
    -destination "$MACOS_DESTINATION" \
    -derivedDataPath "$DERIVED_DATA_DIR" \
    ONLY_ACTIVE_ARCH=YES \
    ARCHS="$HOST_ARCH"

  IOS_SIMULATOR_DESTINATION="$(discover_ios_destination || true)"
  if [ -n "${IOS_SIMULATOR_DESTINATION:-}" ]; then
    echo "[apple] xcodebuild test (CERNIQ iOS) — destination: $IOS_SIMULATOR_DESTINATION"
    xcodebuild test \
      -workspace "$WORKSPACE_FILE" \
      -scheme "CERNIQ iOS" \
      -destination "$IOS_SIMULATOR_DESTINATION" \
      -derivedDataPath "$DERIVED_DATA_DIR" \
      ONLY_ACTIVE_ARCH=YES \
      ARCHS="$HOST_ARCH"
  else
    echo "[apple] xcodebuild test (CERNIQ iOS) skipped: no iOS Simulator destination found." >&2
    echo "[apple] (see destination dump above; if expected on this runner, install a simulator via 'xcrun simctl create' or update Xcode)." >&2
  fi
else
  echo "[apple] swift test skipped: full Xcode is not active; CommandLineTools does not expose XCTest in this environment." >&2
  echo "[apple] xcodebuild -list skipped: full Xcode is not active." >&2
  echo "[apple] xcodebuild test (CERNIQ macOS) skipped: full Xcode is not active." >&2
  echo "[apple] xcodebuild test (CERNIQ iOS) skipped: full Xcode is not active." >&2
fi

echo "[apple] swift run CerniqContractsCheck"
(cd "$APPLE_DIR" && swift run CerniqContractsCheck)
