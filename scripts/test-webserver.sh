#!/usr/bin/env bash
# Test-only HTTPS server; never creates or trusts a host certificate authority.
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
certificate_dir="$(mktemp -d "${TMPDIR:-/tmp}/visualsubnetcalc-test.XXXXXX")"
server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi
  rm -rf "$certificate_dir"
}
trap cleanup EXIT
trap 'exit 0' INT TERM
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$certificate_dir/key.pem" \
  -out "$certificate_dir/cert.pem" -days 1 -subj '/CN=localhost' >/dev/null 2>&1
cd "$repo_root"
node node_modules/http-server/bin/http-server dist -c-1 -p 8443 -a 127.0.0.1 \
  -C "$certificate_dir/cert.pem" -K "$certificate_dir/key.pem" -S &
server_pid=$!
wait "$server_pid"
