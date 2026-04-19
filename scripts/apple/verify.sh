#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APPLE_DIR="$ROOT_DIR/apple"
WORKSPACE_FILE="$APPLE_DIR/CerniqApple/CerniqApple.xcodeproj/project.xcworkspace"
HOST_ARCH="$(uname -m)"
MACOS_DESTINATION="platform=macOS,arch=${HOST_ARCH}"
DERIVED_DATA_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cerniq-apple-verify.XXXXXX")"

IOS_SIMULATOR_DESTINATION="$(
  xcodebuild -showdestinations \
    -workspace "$WORKSPACE_FILE" \
    -scheme "CERNIQ iOS" 2>/dev/null | \
    python3 -c 'import re, sys
arch = sys.argv[1]
pattern = re.compile(rf"\{{ platform:iOS Simulator, arch:{re.escape(arch)}, id:([^,]+),")
for line in sys.stdin:
    match = pattern.search(line)
    if match:
        print(f"platform=iOS Simulator,id={match.group(1)}")
        raise SystemExit(0)
raise SystemExit(1)
' "$HOST_ARCH"
)"

cleanup() {
  rm -rf "$DERIVED_DATA_DIR"
}

trap cleanup EXIT

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

  echo "[apple] xcodebuild test (CERNIQ iOS)"
  xcodebuild test \
    -workspace "$WORKSPACE_FILE" \
    -scheme "CERNIQ iOS" \
    -destination "$IOS_SIMULATOR_DESTINATION" \
    -derivedDataPath "$DERIVED_DATA_DIR" \
    ONLY_ACTIVE_ARCH=YES \
    ARCHS="$HOST_ARCH"
else
  echo "[apple] swift test skipped: full Xcode is not active; CommandLineTools does not expose XCTest in this environment." >&2
  echo "[apple] xcodebuild -list skipped: full Xcode is not active." >&2
  echo "[apple] xcodebuild test (CERNIQ macOS) skipped: full Xcode is not active." >&2
  echo "[apple] xcodebuild test (CERNIQ iOS) skipped: full Xcode is not active." >&2
fi

echo "[apple] swift run CerniqContractsCheck"
(cd "$APPLE_DIR" && swift run CerniqContractsCheck)
