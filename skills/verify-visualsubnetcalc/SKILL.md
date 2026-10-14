---
name: verify-visualsubnetcalc
description: Build Visual Subnet Calculator and serve dist/ on 127.0.0.1:8280, then drive it in headless Chromium, Firefox and WebKit. It enters a base network, splits rows by their accessible names, switches cloud modes (Standard/AWS/Azure/OCI), round-trips a design through Import/Export into a fresh page, and restores with browser Back. It captures row data and the exported JSON. Use when you need to prove a calculation, split/join, mode or state change in the real page.
---

# Verify Visual Subnet Calculator

The user surface is a single static page. You set a network with `#network`
and `#netsize`, then press `#btn_go`. Each row (`tr[aria-label="<cidr>"]`)
has range, usable range and host counts. The Split and Join cells have
accessible labels. The Tools menu holds the mode switches (`#dropdown_*`)
and Import / Export.

Helper: `skills/verify-visualsubnetcalc/scripts/control.sh`. The examples
below use this wrapper; `--execute` is required to run anything:

```bash
C() { /bin/bash skills/verify-visualsubnetcalc/scripts/control.sh --execute "$@"; }
```

Without `--execute` (or with `--dry-run`) the script only prints an
`INFO dry-run:` plan and changes nothing. Run `control.sh --help` for usage.

## Verify

```bash
make verify            # launch, doctor, drive recipes in each browser with assertions, cleanup
VERIFY_BROWSERS=firefox make verify   # narrow to one engine while iterating (default: chromium firefox webkit)
make verify-dry-run    # print the plan only
make verify-test       # shellcheck, then BATS: contract and app tests, Bash 3.2
```

This skill is built on verify-kit. The shared library
(`scripts/verify-lib.sh`), the contract tests (`tests/contract.bats`) and the
make targets (`verify.mk`) are vendored from
`harnesses-private/nickromney/verify-kit` and pinned by `verify-kit.lock`.
Do not edit those three files here. `vendor.sh --check` reports drift, and the
contract test fails if they differ from the lock. App-specific behaviour, the
driver's no-clipboard rule included, is tested in `tests/visualsubnetcalc.bats`.

The recipes run once per browser in `VERIFY_BROWSERS` (space or comma
separated; default `chromium firefox webkit`; unknown names exit 2). A web
page is proven in all three engines, so narrow the list only to iterate.

`verify` exits non-zero, without `VERIFY PASS`, on the first failed
assertion. It always runs cleanup. Its assertions are: mode azure gives 251
hosts from 10.0.0.4; mode standard gives 254 from 10.0.0.1; split leaves
rows 10.0.0.0/18, 10.0.64.0/18 and 10.0.128.0/17; share has
`matchesExportingPage: true`; history has `restoredByBack: true`.

## Launch

```bash
C launch           # VERIFY_PORT=8281 C launch if 8280 is taken
```

`launch` snapshots current source under
`$TMPDIR/verify-visualsubnetcalc/<run>/state/source`, excluding generated
`dist/`, installed dependencies, VCS data, local secret/config files and local
certificates. It links the existing `node_modules`, runs `npm run build` in
that owned snapshot, records the SHA-256 of its `dist/js/main.js`, and serves
that isolated `dist/` with the repo's `http-server` on 127.0.0.1:8280. The
project's existing `dist/` is left untouched. Cleanup removes only state with
this run's ownership marker and stops only this run's server. That leaves
`npm start` (8080) and the Playwright web server (8443) free.

## Doctor

```bash
C doctor
```

Read-only. It checks that our pid owns the port and that the served
`main.js` hash still matches this run's isolated build. A change to that
output makes doctor fail rather than letting you prove the wrong code.

## Drive

```bash
C drive split 10.0.0.0 16 10.0.0.0/16 10.0.0.0/17   # base row, then split each listed row
C drive mode azure 10.0.0.0 24                      # 251 hosts, usable from .4
C drive mode standard 10.0.0.0 24                   # 254 hosts, usable from .1
C drive share 10.0.0.0 16 10.0.0.0/16               # export, fresh page, import, compare rows
C drive history 10.0.0.0 16 10.0.0.0/16 10.0.0.0/17 # second split, Back, compare to first split
```

The driver uses the repo's `playwright-core` and Playwright's own engine
for `VERIFY_BROWSER` (chromium, firefox or webkit; default chromium). No
installed Google Chrome is needed. Install the engines with
`npx playwright install chromium firefox webkit`; `doctor` fails naming any
missing one. For a single drive, `VERIFY_BROWSER=webkit C drive ...`. It
never presses "Copy Shareable URL" or "Copy table", because those write
to the system clipboard.

## Evidence

Everything goes under `.verify/<run>/evidence/`, which is git-ignored:
`revision.txt`, `build.log` and `server.log`, plus one `<HHMMSS-NNN>-<cmd>-<browser>/`
per drive and browser. Each drive holds full-page `NN-<step>.png`, `NN-<step>.rows.json`
(subnet, range, usable and hosts per row), `export.json` (the Import/Export
content, where used) and `steps.jsonl`, whose first line logs the browser name
and `browserVersion`.

Proof standards:

- Calculation claims cite `rows.json`, never a screenshot alone.
- Mode claims compare two modes on the same network.
- State claims use a second view: an import into a fresh page, or Back.

## Cleanup

```bash
C cleanup
```

Stops our server, removes the owned source snapshot and state, and keeps
evidence. The project's `dist/` is never modified.

## Gotchas

- A plain reload resets the design. State lives in browser history and in
  share links (`?c=`), not in the clean URL. That is intended, not a bug.
- Mode changes apply to the next Go. Switch the mode first, then set the
  network.
