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
  hook_warn "VISUALSUBNETCALC_LOCAL_CI_IN_PROGRESS=1; skipping run-local-ci.sh to avoid recursive local CI"
  exit 0
fi

cd "${HOOKS_REPO_ROOT}/src"

cat <<'EOF'
Visual Subnet Calculator pre-push local CI gate

Running:
  npm run build --if-present
  npm test

Skip only when you have a reason:
  LEFTHOOK=0 git push
  VISUALSUBNETCALC_SKIP_HOOKS=1 git push
  git push --no-verify
EOF

export VISUALSUBNETCALC_LOCAL_CI_IN_PROGRESS=1
failed_gate=""

if ! npm run build --if-present; then
  failed_gate="npm run build --if-present"
elif ! npm test; then
  failed_gate="npm test"
fi

if [[ -n "${failed_gate}" ]]; then
  hook_fail "pre-push gate failed: ${failed_gate}"
  exit 1
fi

hook_ok "pre-push gate passed: npm run build --if-present && npm test"
