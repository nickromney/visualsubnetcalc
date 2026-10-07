#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/hooks/lib.sh
source "${SCRIPT_DIR}/lib.sh"

if [[ "${1:-}" == "--execute" ]]; then
  shift
fi

if hook_skip_requested; then
  hook_print_skip_and_exit
fi

if [[ "${VISUALSUBNETCALC_LOCAL_CI_IN_PROGRESS:-}" == "1" ]]; then
  hook_fail "recursive_gate: verification did not execute"
  exit 1
fi

cd "${HOOKS_REPO_ROOT}"

env -u VIRTUAL_ENV uv run --locked python -m unittest discover -s tests -p test_local_gate_policy.py -v

cat <<'EOF'
Visual Subnet Calculator pre-push local CI gate

Running:
  npm run build
  npm test

Required checks refuse skip or recursion; repair the failing owner before retrying.
EOF

export VISUALSUBNETCALC_LOCAL_CI_IN_PROGRESS=1
# Preserve hosted CI guards: no focused-test acceptance or reused/omitted server.
export CI=true
unset NO_SERVER
env -u VIRTUAL_ENV uv run --locked python tests/test_browser_ci_guards.py
failed_gate=""

if ! npm run build; then
  failed_gate="npm run build"
elif ! npm test; then
  failed_gate="npm test"
fi

if [[ -n "${failed_gate}" ]]; then
  hook_fail "pre-push gate failed: ${failed_gate}"
  exit 1
fi

hook_ok "pre-push gate passed: npm run build && npm test"
