#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  exec npx playwright test
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image='mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27'

set +e
npx playwright test --project=chromium
chromium_status=$?

docker run --rm --init --ipc=host \
  --env CI \
  --env VISUALSUBNETCALC_LOCAL_CI_IN_PROGRESS \
  --volume "${repo_root}:/workspace" \
  --workdir /workspace \
  --entrypoint bash \
  "${image}" -euc '
    case "$(uname -m)" in
      aarch64|arm64)
        node_arch=arm64
        node_sha256=33c37be234ba8bee041961047b19160f4d7d0f164e8e246f78bdd10feff148b3
        ;;
      x86_64|amd64)
        node_arch=x64
        node_sha256=eb6728e77c576a35162c122c45ccadf224d89ff00abc8dae46cc2897c6002d7c
        ;;
      *)
        echo "Unsupported container architecture: $(uname -m)" >&2
        exit 2
        ;;
    esac

    node_version=24.22.1
    node_archive="node-v${node_version}-linux-${node_arch}.tar.gz"
    node_tmp="$(mktemp -d)"
    trap '\''rm -rf "${node_tmp}"'\'' EXIT
    curl --fail --silent --show-error --location \
      "https://nodejs.org/dist/v${node_version}/${node_archive}" \
      --output "${node_tmp}/${node_archive}"
    printf "%s  %s\n" "${node_sha256}" "${node_tmp}/${node_archive}" | sha256sum --check --status
    tar -xzf "${node_tmp}/${node_archive}" -C "${node_tmp}"
    export PATH="${node_tmp}/node-v${node_version}-linux-${node_arch}/bin:${PATH}"
    test "$(node --version)" = "v${node_version}"
    printf "Firefox container uses Node %s and npm %s\n" "$(node --version)" "$(npm --version)"
    test "$(npm config get engine-strict)" = "true"
    node_modules/.bin/playwright test --project=firefox
  '
firefox_status=$?
set -e

if [[ "${chromium_status}" -ne 0 || "${firefox_status}" -ne 0 ]]; then
  printf 'Browser tests failed (chromium=%s, firefox=%s)\n' "${chromium_status}" "${firefox_status}" >&2
  exit 1
fi
