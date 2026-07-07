#!/usr/bin/env bash
set -euo pipefail

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC2034 # Sourced hook scripts consume this shared root.
HOOKS_REPO_ROOT="$(cd "${HOOKS_DIR}/../.." && pwd)"

hook_skip_requested() {
  [[ "${VISUALSUBNETCALC_SKIP_HOOKS:-}" == "1" ]]
}

hook_print_skip_and_exit() {
  echo "WARN VISUALSUBNETCALC_SKIP_HOOKS=1; skipping ${0##*/}"
  exit 0
}

hook_ok() {
  echo "OK   $*"
}

hook_warn() {
  echo "WARN $*"
}

hook_fail() {
  echo "FAIL $*" >&2
}

hook_strip_execute_flag() {
  if [[ "${1:-}" == "--execute" ]]; then
    shift
  fi
  printf '%s\0' "$@"
}
