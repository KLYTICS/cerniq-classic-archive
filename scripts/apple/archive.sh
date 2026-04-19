#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_DIR="$ROOT_DIR/apple/CerniqApple"
WORKSPACE_FILE="$PROJECT_DIR/CerniqApple.xcodeproj/project.xcworkspace"
EXPORT_TEMPLATE="$PROJECT_DIR/export-options/ExportOptions.plist.template"
HOST_ARCH="$(uname -m)"
SCHEME="CERNIQ macOS"
OUTPUT_DIR="$ROOT_DIR/output/apple"
ARCHIVE_PATH=""
EXPORT_PATH=""
EXPORT_OPTIONS_SOURCE=""
RUN_EXPORT=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: bash scripts/apple/archive.sh [options]

Options:
  --scheme <name>           Xcode scheme to archive. Default: CERNIQ macOS
  --archive-path <path>     Archive output path. Default: output/apple/<scheme>.xcarchive
  --export                  Run xcodebuild -exportArchive after archiving
  --export-path <path>      Export output path. Default: output/apple/<scheme>-export
  --export-options <path>   Export options plist. Default: apple/CerniqApple/export-options/ExportOptions.plist.template
  --dry-run                 Print commands without executing them
  --help                    Show this help

Environment:
  APPLE_DEVELOPMENT_TEAM    Required for archive/export signing
EOF
}

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

render_export_options() {
  local source_file="$1"
  local destination_file="$2"

  python3 - <<'PY' "$source_file" "$destination_file" "$APPLE_DEVELOPMENT_TEAM"
from pathlib import Path
import sys

source = Path(sys.argv[1])
destination = Path(sys.argv[2])
team_id = sys.argv[3]
destination.write_text(source.read_text().replace("APPLE_DEVELOPMENT_TEAM", team_id))
PY
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scheme)
      SCHEME="${2:?missing value for --scheme}"
      shift 2
      ;;
    --archive-path)
      ARCHIVE_PATH="${2:?missing value for --archive-path}"
      shift 2
      ;;
    --export)
      RUN_EXPORT=1
      shift
      ;;
    --export-path)
      EXPORT_PATH="${2:?missing value for --export-path}"
      shift 2
      ;;
    --export-options)
      EXPORT_OPTIONS_SOURCE="${2:?missing value for --export-options}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Full Xcode is required for archive/export. Activate Xcode and rerun." >&2
  exit 1
fi

if [[ -z "${APPLE_DEVELOPMENT_TEAM:-}" ]]; then
  echo "APPLE_DEVELOPMENT_TEAM must be set for archive/export." >&2
  exit 1
fi

SCHEME_SLUG="$(slugify "$SCHEME")"
ARCHIVE_PATH="${ARCHIVE_PATH:-$OUTPUT_DIR/${SCHEME_SLUG}.xcarchive}"
EXPORT_PATH="${EXPORT_PATH:-$OUTPUT_DIR/${SCHEME_SLUG}-export}"
EXPORT_OPTIONS_SOURCE="${EXPORT_OPTIONS_SOURCE:-$EXPORT_TEMPLATE}"

mkdir -p "$OUTPUT_DIR"

if [[ ! -f "$EXPORT_OPTIONS_SOURCE" ]]; then
  echo "Export options plist not found: $EXPORT_OPTIONS_SOURCE" >&2
  exit 1
fi

DESTINATION="platform=macOS,arch=${HOST_ARCH}"
ARCHIVE_CMD=(
  xcodebuild archive
  -workspace "$WORKSPACE_FILE"
  -scheme "$SCHEME"
  -destination "$DESTINATION"
  -archivePath "$ARCHIVE_PATH"
  DEVELOPMENT_TEAM="$APPLE_DEVELOPMENT_TEAM"
  ONLY_ACTIVE_ARCH=YES
  ARCHS="$HOST_ARCH"
)

RENDERED_EXPORT_OPTIONS=""
cleanup() {
  if [[ -n "$RENDERED_EXPORT_OPTIONS" && -f "$RENDERED_EXPORT_OPTIONS" ]]; then
    rm -f "$RENDERED_EXPORT_OPTIONS"
  fi
}
trap cleanup EXIT

if (( RUN_EXPORT )); then
  RENDERED_EXPORT_OPTIONS="$(mktemp "${TMPDIR:-/tmp}/cerniq-export-options.XXXXXX")"
  render_export_options "$EXPORT_OPTIONS_SOURCE" "$RENDERED_EXPORT_OPTIONS"

  EXPORT_CMD=(
    xcodebuild -exportArchive
    -archivePath "$ARCHIVE_PATH"
    -exportPath "$EXPORT_PATH"
    -exportOptionsPlist "$RENDERED_EXPORT_OPTIONS"
  )
fi

echo "[apple] workspace: $WORKSPACE_FILE"
echo "[apple] scheme: $SCHEME"
echo "[apple] archive path: $ARCHIVE_PATH"

if (( RUN_EXPORT )); then
  echo "[apple] export path: $EXPORT_PATH"
  echo "[apple] export options: $EXPORT_OPTIONS_SOURCE"
fi

if (( DRY_RUN )); then
  printf '[apple] archive command:'
  printf ' %q' "${ARCHIVE_CMD[@]}"
  printf '\n'

  if (( RUN_EXPORT )); then
    printf '[apple] export command:'
    printf ' %q' "${EXPORT_CMD[@]}"
    printf '\n'
  fi

  exit 0
fi

echo "[apple] xcodebuild archive"
"${ARCHIVE_CMD[@]}"

if (( RUN_EXPORT )); then
  echo "[apple] xcodebuild -exportArchive"
  "${EXPORT_CMD[@]}"
fi
