#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPLE_DIR="$ROOT_DIR/apple"

build_product() {
  (cd "$APPLE_DIR" && swift build --product CerniqMacApp)
}

binary_path() {
  (cd "$APPLE_DIR" && swift build --show-bin-path)/CerniqMacApp
}

open_app() {
  "$(binary_path)" &
}

case "$MODE" in
  run)
    build_product
    open_app
    ;;
  --debug|debug)
    build_product
    lldb -- "$(binary_path)"
    ;;
  --logs|logs)
    build_product
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"CerniqMacApp\""
    ;;
  --telemetry|telemetry)
    build_product
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"CerniqMacApp\""
    ;;
  --verify|verify)
    "$ROOT_DIR/scripts/apple/verify.sh"
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
