#!/usr/bin/env bats
# App-specific tests for the Visual Subnet Calculator verification skill (the shared contract is in contract.bats).
# Runs under macOS /bin/bash 3.2 and never builds, starts a server or touches real state.

setup() {
  SKILL_DIR="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  SCRIPT="$SKILL_DIR/scripts/control.sh"
  DRIVE="$SKILL_DIR/scripts/drive.mjs"
  BASH32="${VERIFY_TEST_BASH:-/bin/bash}"
  export VERIFY_BASE_DIR="$BATS_TEST_TMPDIR/base"
  export VERIFY_EVIDENCE_ROOT="$BATS_TEST_TMPDIR/evidence"
  export VERIFY_RUN_ID="app-run"
}

@test "drive refuses to run without a live server and writes nothing" {
  run "$BASH32" "$SCRIPT" --execute drive mode azure 10.0.0.0 24
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL: no live server for run app-run; launch first"* ]]
  [ ! -e "$VERIFY_BASE_DIR" ]
  [ ! -e "$VERIFY_EVIDENCE_ROOT" ]
}

@test "doctor names the missing server when nothing was launched" {
  run "$BASH32" "$SCRIPT" --execute doctor
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL: no server for run app-run; launch first"* ]]
}

@test "verify refusal preserves a pre-existing owned run state" {
  mkdir -p "$VERIFY_BASE_DIR/app-run/state/source/dist"
  printf 'visualsubnetcalc:app-run\n' > "$VERIFY_BASE_DIR/app-run/state/.verify-output-owner"
  printf 'keep\n' > "$VERIFY_BASE_DIR/app-run/state/user-data"
  run "$BASH32" "$SCRIPT" --execute verify
  [ "$status" -eq 1 ]
  [[ "$output" == *"run directory is not empty; refusing to overwrite"* ]]
  [ "$(cat "$VERIFY_BASE_DIR/app-run/state/user-data")" = keep ]
  [ "$(cat "$VERIFY_BASE_DIR/app-run/state/.verify-output-owner")" = "visualsubnetcalc:app-run" ]
}

@test "verify plan names the drive recipes and the default .verify evidence root" {
  unset VERIFY_EVIDENCE_ROOT
  run "$BASH32" "$SCRIPT" --dry-run verify
  [ "$status" -eq 0 ]
  [[ "$output" == *"drive mode azure and standard, split, share, history"* ]]
  [[ "$output" == *"isolated"* ]]
  [[ "$output" == *"/.verify/app-run/evidence"* ]]
}

@test "launch plan serves only on 127.0.0.1 at the default port" {
  unset VERIFY_PORT
  run "$BASH32" "$SCRIPT" --dry-run launch
  [ "$status" -eq 0 ]
  [[ "$output" == *"127.0.0.1:8280"* ]]
  [[ "$output" == *"npm run build"* ]]
}

@test "drive plan names the headless driver and the served URL" {
  run "$BASH32" "$SCRIPT" --dry-run drive split 10.0.0.0 16 10.0.0.0/16
  [ "$status" -eq 0 ]
  [[ "$output" == *"node drive.mjs split 10.0.0.0 16 10.0.0.0/16 against http://127.0.0.1:8280"* ]]
}

@test "drive plan carries VERIFY_BROWSER into the driver and the evidence path" {
  run env VERIFY_BROWSER=firefox "$BASH32" "$SCRIPT" --dry-run drive mode azure 10.0.0.0 24
  [ "$status" -eq 0 ]
  [[ "$output" == *"VERIFY_BROWSER=firefox"* ]]
  [[ "$output" == *"<stamp>-<cmd>-firefox"* ]]
}

@test "the driver launches Playwright's own engines, not a Chrome channel, and logs the version" {
  run grep -n "channel" "$DRIVE"
  [ "$status" -eq 1 ] || { echo "$output"; return 1; }
  grep -q "VERIFY_BROWSER" "$DRIVE"
  grep -q "browser.version()" "$DRIVE"
}

@test "the driver never presses copy or clipboard controls" {
  run grep -inE 'copy|clipboard' "$DRIVE"
  [ "$status" -eq 1 ] || { echo "$output"; return 1; }
}

# ---- doctor, cleanup and the rows helper; lsof and curl are stubbed on PATH, no server is started ----

teardown() {
  # Stop only the group this test started (cleanup may already have stopped it).
  if [ -n "${SERVER_PID:-}" ]; then kill -TERM -- "-$SERVER_PID" 2>/dev/null || true; fi
}

stub_tools() {
  mkdir -p "$BATS_TEST_TMPDIR/bin"
  cat > "$BATS_TEST_TMPDIR/bin/lsof" <<'STUB'
#!/bin/bash
[ -n "${STUB_LISTENER:-}" ] && echo "$STUB_LISTENER"
exit 0
STUB
  cat > "$BATS_TEST_TMPDIR/bin/curl" <<'STUB'
#!/bin/bash
[ "${STUB_CURL_FAIL:-0}" = 1 ] && exit 7
printf '%s' "${STUB_JS:-}"
exit 0
STUB
  cat > "$BATS_TEST_TMPDIR/bin/node" <<'STUB'
#!/bin/bash
# Stands in for the Playwright installed-browser probe: node -e <script> <browser>.
[ "${STUB_NODE_MISSING:-}" = "${3:-}" ] && [ -n "${3:-}" ] && exit 1
exit 0
STUB
  chmod +x "$BATS_TEST_TMPDIR/bin/lsof" "$BATS_TEST_TMPDIR/bin/curl" "$BATS_TEST_TMPDIR/bin/node"
}

# Start a process in its own group, as cmd_launch does, and record it in the run's pidfile.
start_run_group() {
  mkdir -p "$VERIFY_BASE_DIR/app-run/state/source/dist"
  printf 'visualsubnetcalc:app-run\n' > "$VERIFY_BASE_DIR/app-run/state/.verify-output-owner"
  perl -e 'setpgrp(0,0); exec @ARGV' sleep 300 >/dev/null 2>&1 </dev/null &
  SERVER_PID=$!
  printf '%s\n' "$SERVER_PID" > "$VERIFY_BASE_DIR/app-run/state/server.pid"
  local i=0
  while [ "$(ps -o pgid= -p "$SERVER_PID" | tr -d ' ')" != "$SERVER_PID" ] && [ "$i" -lt 40 ]; do
    sleep 0.1
    i=$((i + 1))
  done
}

# Load control.sh's helpers without dispatching a command, then call the requested helper.
# shellcheck disable=SC2016 # the single-quoted script is passed to bash -c, where $0 and $@ must expand
helper() {
  "$BASH32" -c '. "$0" --help >/dev/null && vk_paths && "$@"' "$SCRIPT" "$@"
}

@test "build source snapshot omits project dist and links installed dependencies" {
  local source="$BATS_TEST_TMPDIR/source" destination="$BATS_TEST_TMPDIR/build-source"
  mkdir -p "$source/src" "$source/dist" "$source/node_modules/pkg" "$source/certs" "$source/.venv/bin"
  printf 'source\n' > "$source/src/index.js"
  printf 'keep me\n' > "$source/dist/user-output.txt"
  printf 'secret\n' > "$source/.env.local"
  printf 'private key\n' > "$source/certs/cert.key"
  printf 'local env\n' > "$source/.venv/bin/python"
  run helper copy_build_source "$source" "$destination"
  [ "$status" -eq 0 ]
  [ -f "$destination/src/index.js" ]
  [ ! -e "$destination/dist" ]
  [ ! -e "$destination/.env.local" ]
  [ ! -e "$destination/certs" ]
  [ ! -e "$destination/.venv" ]
  [ -L "$destination/node_modules" ]
  [ "$(readlink "$destination/node_modules")" = "$source/node_modules" ]
  [ "$(cat "$source/dist/user-output.txt")" = "keep me" ]
}

@test "launch refuses pre-existing run state and preserves its files" {
  stub_tools
  mkdir -p "$VERIFY_BASE_DIR/app-run/state"
  printf 'keep\n' > "$VERIFY_BASE_DIR/app-run/state/user-data"
  run env PATH="$BATS_TEST_TMPDIR/bin:$PATH" "$BASH32" "$SCRIPT" --execute launch
  [ "$status" -eq 1 ]
  [[ "$output" == *"run directory is not empty; refusing to overwrite"* ]]
  [ "$(cat "$VERIFY_BASE_DIR/app-run/state/user-data")" = keep ]
}

@test "launch refuses a run-directory symlink and preserves its target" {
  stub_tools
  mkdir -p "$BATS_TEST_TMPDIR/outside/state" "$VERIFY_BASE_DIR"
  printf 'keep\n' > "$BATS_TEST_TMPDIR/outside/state/user-data"
  ln -s "$BATS_TEST_TMPDIR/outside" "$VERIFY_BASE_DIR/app-run"
  run env PATH="$BATS_TEST_TMPDIR/bin:$PATH" "$BASH32" "$SCRIPT" --execute launch
  [ "$status" -eq 1 ]
  [[ "$output" == *"run state contains a symlink"* ]]
  [ -L "$VERIFY_BASE_DIR/app-run" ]
  [ "$(cat "$BATS_TEST_TMPDIR/outside/state/user-data")" = keep ]
}

@test "cleanup refuses unowned state and preserves its files" {
  mkdir -p "$VERIFY_BASE_DIR/app-run/state"
  printf 'keep\n' > "$VERIFY_BASE_DIR/app-run/state/user-data"
  run "$BASH32" "$SCRIPT" --execute cleanup
  [ "$status" -eq 1 ]
  [[ "$output" == *"refusing to remove unowned state"* ]]
  [ "$(cat "$VERIFY_BASE_DIR/app-run/state/user-data")" = keep ]
}

# Record the sha256 of the given JS as this run's build, as cmd_launch does for dist/js/main.js.
record_build() {
  printf '%s' "$1" | shasum -a 256 | awk '{print $1}' > "$VERIFY_BASE_DIR/app-run/state/main.sha"
}

@test "doctor passes when our group owns the port and serves this run's main.js" {
  stub_tools
  start_run_group
  record_build 'console.log("built");'
  mkdir -p "$VERIFY_EVIDENCE_ROOT/app-run/evidence"
  echo "abc123" > "$VERIFY_EVIDENCE_ROOT/app-run/evidence/revision.txt"
  local sha
  sha="$(cat "$VERIFY_BASE_DIR/app-run/state/main.sha")"
  run env PATH="$BATS_TEST_TMPDIR/bin:$PATH" STUB_LISTENER="$SERVER_PID" STUB_JS='console.log("built");' \
    "$BASH32" "$SCRIPT" --execute doctor
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK pid=$SERVER_PID main.js=$sha"* ]]
}

@test "doctor names a browser that is not installed and the install command" {
  stub_tools
  start_run_group
  record_build 'console.log("built");'
  run env PATH="$BATS_TEST_TMPDIR/bin:$PATH" STUB_LISTENER="$SERVER_PID" STUB_JS='console.log("built");' \
    STUB_NODE_MISSING=webkit "$BASH32" "$SCRIPT" --execute doctor
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL: Playwright browser not installed: webkit; run: npx playwright install chromium firefox webkit"* ]]
}

@test "doctor refuses when the port listener is outside our group" {
  stub_tools
  start_run_group
  record_build 'console.log("built");'
  run env PATH="$BATS_TEST_TMPDIR/bin:$PATH" STUB_LISTENER="$$" STUB_JS='console.log("built");' \
    "$BASH32" "$SCRIPT" --execute doctor
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL: port 8280 not owned by our server process group"* ]]
}

@test "doctor refuses when the served main.js is not this run's build" {
  stub_tools
  start_run_group
  record_build 'console.log("launched");'
  run env PATH="$BATS_TEST_TMPDIR/bin:$PATH" STUB_LISTENER="$SERVER_PID" STUB_JS='console.log("rebuilt");' \
    "$BASH32" "$SCRIPT" --execute doctor
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL: served main.js differs from this run's build"* ]]
}

@test "doctor refuses with its own message when main.js cannot be fetched" {
  stub_tools
  start_run_group
  record_build 'console.log("built");'
  run env PATH="$BATS_TEST_TMPDIR/bin:$PATH" STUB_LISTENER="$SERVER_PID" STUB_CURL_FAIL=1 \
    "$BASH32" "$SCRIPT" --execute doctor
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL: served main.js differs from this run's build"* ]]
}

@test "cleanup stops the recorded group, removes run state and keeps evidence" {
  start_run_group
  mkdir -p "$VERIFY_EVIDENCE_ROOT/app-run/evidence"
  echo "kept" > "$VERIFY_EVIDENCE_ROOT/app-run/evidence/keep.txt"
  run env PATH="$BATS_TEST_TMPDIR/bin:$PATH" "$BASH32" "$SCRIPT" --execute cleanup
  [ "$status" -eq 0 ]
  [[ "$output" == *"stopped run=app-run; evidence kept at"* ]]
  [ ! -e "$VERIFY_BASE_DIR/app-run/state" ]
  [ -f "$VERIFY_EVIDENCE_ROOT/app-run/evidence/keep.txt" ]
}

# last_rows is only reached through a drive, so extract the function from control.sh and run it alone.
# The caller pattern matches vk_verify_recipes: base="$(last_rows ...)" under errexit.
@test "last_rows returns the newest rows.json and aborts the caller when there is none" {
  local helper="$BATS_TEST_TMPDIR/last_rows.sh" dir="$BATS_TEST_TMPDIR/drive"
  mkdir -p "$dir"
  { echo 'vk_fail() { echo "FAIL: $*"; return 1; }'; sed -n '/^last_rows()/,/^}/p' "$SCRIPT"; } > "$helper"
  touch "$dir/01-split.rows.json" "$dir/02-split.rows.json"
  # shellcheck disable=SC2016 # expanded by the child shell
  run "$BASH32" -c 'set -euo pipefail; . "$1"; last_rows "$2"' _ "$helper" "$dir"
  [ "$status" -eq 0 ]
  [ "$output" = "$dir/02-split.rows.json" ]

  rm -f "$dir"/*.rows.json
  # shellcheck disable=SC2016 # expanded by the child shell
  run "$BASH32" -c 'set -euo pipefail; . "$1"; base="$(last_rows "$2")"; echo "continued"' _ "$helper" "$dir"
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL: no rows.json in $dir"* ]]
  [[ "$output" != *"continued"* ]]
}

# Accepted equivalents (mutation run, 2026-10-12):
# - doctor: `return 0` after vk_fail (set -e exits with vk_fail's status 1 before the return runs), and
#   the no-pidfile branch likewise.
# - doctor: `|| false` / `&& true` on the cat of main.sha, and `|| true` on the cat itself: all three
#   give empty output on a missing file, and the status of a command substitution inside [ ] is unused.
# - cleanup: `rmdir ... && true` for `|| true`: same effects and status as before (see authexplainer).
