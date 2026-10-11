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

@test "verify plan names the drive recipes and the default .verify evidence root" {
  unset VERIFY_EVIDENCE_ROOT
  run "$BASH32" "$SCRIPT" --dry-run verify
  [ "$status" -eq 0 ]
  [[ "$output" == *"drive mode azure and standard, split, share, history"* ]]
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

@test "the driver never presses copy or clipboard controls" {
  run grep -inE 'copy|clipboard' "$DRIVE"
  [ "$status" -eq 1 ] || { echo "$output"; return 1; }
}
