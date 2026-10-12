#!/usr/bin/env bash
# Verification harness for Visual Subnet Calculator: built static site served on 127.0.0.1, headless Chromium, Firefox and WebKit.
# Built on verify-kit (scripts/verify-lib.sh). Bash 3.2 compatible. Run with --help for usage.
# shellcheck disable=SC2034 # VK_* settings are read by the sourced verify-lib.sh
set -euo pipefail

VK_SCRIPT="$0"
VK_APP="visualsubnetcalc"
VK_BROWSER_SKILL=1
VK_DESCRIPTION="Verification harness for Visual Subnet Calculator: built dist/ served on 127.0.0.1:8280, driven in headless Chromium, Firefox and WebKit (Playwright engines)."
VK_DEFAULT_BASE_DIR="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/.verify"
# shellcheck source=verify-lib.sh disable=SC1091
. "$(cd "$(dirname "$0")" && pwd)/verify-lib.sh"

vk_commands_help() {
  cat <<'HELP'
  launch                                      npm run build (dist/ is git-ignored), serve dist with http-server, record main.js hash
  doctor                                      read-only: our process group owns the port and the served main.js is this run's build
  drive split <net> <prefix> [cidr...]        enter network, split each listed row, export config
  drive mode <standard|aws|azure|oci> <net> <prefix>
                                              switch mode, then show the base network row
  drive share <net> <prefix> <cidr>           split, export, import into a fresh page, compare rows
  drive history <net> <prefix> <cidr> <cidr>  split twice, browser Back, compare with the first split
  cleanup                                     stop our server; evidence is kept
HELP
}

vk_sample_commands() {
  printf '%s\n' verify launch doctor \
    "drive split 10.0.0.0 16 10.0.0.0/16 10.0.0.0/17" \
    "drive mode azure 10.0.0.0 24" \
    "drive share 10.0.0.0 16 10.0.0.0/16" \
    "drive history 10.0.0.0 16 10.0.0.0/16 10.0.0.0/17" \
    cleanup
}

vk_paths() {
  STATE="$VK_BASE_DIR/$VK_RUN_ID/state"
  EVIDENCE="$VK_EVIDENCE_ROOT/$VK_RUN_ID/evidence"
  PORT="$(cat "$STATE/port" 2>/dev/null || echo "${VERIFY_PORT:-8280}")"
  URL="http://127.0.0.1:$PORT"
  LAST_DRIVE_DIR=""
}

vk_plan() {
  case "$1" in
    verify)
      local bs
      bs="$(vk_browsers | tr '\n' ' ')"
      vk_plan_line "launch, doctor, then in each of: ${bs}drive mode azure and standard, split, share, history, doctor, cleanup; assertions on rows.json and steps.jsonl; evidence in $EVIDENCE" ;;
    launch) vk_plan_line "npm run build (writes dist/); http-server dist on 127.0.0.1:$PORT; record main.js sha in $STATE; create $STATE and $EVIDENCE" ;;
    doctor) vk_plan_line "read-only: the process group of $STATE/server.pid must own $PORT and serve the main.js recorded at launch" ;;
    drive) shift; vk_plan_line "headless Playwright engine VERIFY_BROWSER=${VERIFY_BROWSER:-chromium}: node drive.mjs ${*:-<split|mode|share|history>} against $URL; evidence under $EVIDENCE/<stamp>-<cmd>-${VERIFY_BROWSER:-chromium}" ;;
    cleanup) vk_plan_line "stop our server process group; rm -rf $STATE; keep $EVIDENCE" ;;
    *) vk_unknown_command ;;
  esac
}

cmd_launch() {
  if vk_port_busy "$PORT"; then vk_fail "port $PORT in use; set VERIFY_PORT"; return 1; fi
  mkdir -p "$STATE" "$EVIDENCE"
  vk_mark_current
  echo "$PORT" > "$STATE/port"
  vk_record_revision "$EVIDENCE/revision.txt"
  (cd "$VK_ROOT" && npm run build) > "$EVIDENCE/build.log" 2>&1 \
    || { vk_fail "build failed; see $EVIDENCE/build.log"; return 1; }
  shasum -a 256 "$VK_ROOT/dist/js/main.js" | awk '{print $1}' > "$STATE/main.sha"
  vk_spawn_group "$STATE/server.pid" "$EVIDENCE/server.log" \
    node "$VK_ROOT/node_modules/http-server/bin/http-server" "$VK_ROOT/dist" -c-1 -a 127.0.0.1 -p "$PORT"
  if ! vk_wait_for 30 curl -fsS -o /dev/null "$URL/index.html"; then
    vk_stop_group "$STATE/server.pid"
    vk_fail "not ready; see $EVIDENCE/server.log"; return 1
  fi
  vk_say "ready run=$VK_RUN_ID url=$URL/ pid=$(cat "$STATE/server.pid")"
}

cmd_doctor() {
  vk_say "run=$VK_RUN_ID url=$URL"
  if [ ! -f "$STATE/server.pid" ]; then vk_fail "no server for run $VK_RUN_ID; launch first"; return 1; fi
  if ! vk_group_alive "$STATE/server.pid"; then vk_fail "server pid $(cat "$STATE/server.pid") not alive"; return 1; fi
  if ! vk_listener_in_group "$PORT" "$STATE/server.pid"; then vk_fail "port $PORT not owned by our server process group"; return 1; fi
  local served b browsers missing=""
  browsers="$(vk_browsers)"
  for b in $browsers; do
    if ! (cd "$VK_ROOT" && node -e 'const pw=require("playwright-core"); process.exit(require("fs").existsSync(pw[process.argv[1]].executablePath())?0:1)' "$b") 2>/dev/null; then
      missing="$missing $b"
    fi
  done
  if [ -n "$missing" ]; then vk_fail "Playwright browser not installed:$missing; run: npx playwright install chromium firefox webkit"; return 1; fi
  served="$(curl -fsS "$URL/js/main.js" 2>/dev/null | shasum -a 256 | awk '{print $1}' || true)"
  if [ -z "$served" ] || [ "$served" != "$(cat "$STATE/main.sha" 2>/dev/null || true)" ]; then
    vk_fail "served main.js differs from this run's build (dist/ rebuilt since launch?)"; return 1
  fi
  vk_say "revision $(head -1 "$EVIDENCE/revision.txt") (now $(git -C "$VK_ROOT" rev-parse HEAD))"
  vk_say "OK pid=$(cat "$STATE/server.pid") main.js=$served"
}

cmd_drive() {
  if ! vk_group_alive "$STATE/server.pid"; then vk_fail "no live server for run $VK_RUN_ID; launch first"; return 1; fi
  local sub="${1:-drive}"
  if [ $# -gt 0 ]; then shift; fi
  local browser="${VERIFY_BROWSER:-chromium}"
  LAST_DRIVE_DIR="$EVIDENCE/$(vk_stamp)-$sub-$browser"
  VERIFY_BROWSER="$browser" VERIFY_BASE_URL="$URL" VERIFY_EVIDENCE_DIR="$LAST_DRIVE_DIR" node "$VK_SCRIPT_DIR/drive.mjs" "$sub" ${@+"$@"}
  vk_say "evidence: $LAST_DRIVE_DIR"
}

cmd_cleanup() {
  vk_stop_group "$STATE/server.pid"
  rm -rf "${STATE:?}"
  rmdir "$VK_BASE_DIR/$VK_RUN_ID" 2>/dev/null || true
  vk_clear_current
  vk_say "stopped run=$VK_RUN_ID; evidence kept at $EVIDENCE"
}

# last_rows <drive dir>: the newest NN-<step>.rows.json of a drive's evidence.
last_rows() {
  local f last=""
  for f in "$1"/*.rows.json; do
    if [ -f "$f" ]; then last="$f"; fi
  done
  if [ -z "$last" ]; then vk_fail "no rows.json in $1" >&2; return 1; fi
  printf '%s\n' "$last"
}

# expect_rows <rows.json> <expected subnets, space separated>: exact rows, in order.
expect_rows() {
  local got
  got="$(sed -n 's/.*"subnet": "\([^"]*\)".*/\1/p' "$1" | tr '\n' ' ')"
  got="${got% }"
  vk_expect_equals "$(basename "$1") rows" "$got" "$2"
}

vk_verify_recipes() {
  local base rows browsers b
  browsers="$(vk_browsers)"
  for b in $browsers; do
    VERIFY_BROWSER="$b"; export VERIFY_BROWSER
    vk_say "browser: $b"
    cmd_drive mode azure 10.0.0.0 24
    base="$(last_rows "$LAST_DRIVE_DIR")"
    vk_expect_contains "$base" '"hosts": "251"'
    vk_expect_contains "$base" '"usable": "10.0.0.4 - 10.0.0.254"'

    cmd_drive mode standard 10.0.0.0 24
    base="$(last_rows "$LAST_DRIVE_DIR")"
    vk_expect_contains "$base" '"hosts": "254"'
    vk_expect_contains "$base" '"usable": "10.0.0.1 - 10.0.0.254"'

    cmd_drive split 10.0.0.0 16 10.0.0.0/16 10.0.0.0/17
    rows="$(last_rows "$LAST_DRIVE_DIR")"
    expect_rows "$rows" "10.0.0.0/18 10.0.64.0/18 10.0.128.0/17"

    cmd_drive share 10.0.0.0 16 10.0.0.0/16
    vk_expect_contains "$LAST_DRIVE_DIR/steps.jsonl" '"matchesExportingPage":true'

    cmd_drive history 10.0.0.0 16 10.0.0.0/16 10.0.0.0/17
    vk_expect_contains "$LAST_DRIVE_DIR/steps.jsonl" '"restoredByBack":true'

    cmd_doctor
  done
}

vk_dispatch() {
  local cmd="$1"
  shift
  case "$cmd" in
    launch) cmd_launch ;;
    doctor) cmd_doctor ;;
    drive) cmd_drive ${@+"$@"} ;;
    cleanup) cmd_cleanup ;;
    *) vk_unknown_command ;;
  esac
}

vk_main "$@"
