# Visual Subnet Calculator verification map

This directory is the maintained source for verifying the calculator page. Read this index, then use the matching feature file.

## Baseline preconditions

- `control.sh --execute launch` printed `ready` and `doctor` prints `OK`. The page is at `http://127.0.0.1:8280/`.

## Driving conventions

- Address rows by CIDR (`tr[aria-label]` / `getByLabel(cidr, {exact: true})`), never by index.
- Never use the copy buttons. They write to the clipboard.

## Proof and skip reporting

- Cite `rows.json`, `export.json` and the `steps.jsonl` comparison flags.
- Auto-allocation, colours, notes, mirroring and print styles are covered by `src/tests/*.spec.ts`. They are not yet driven here, so name them as skipped.

## Feature entry contract

Each feature file has an H1, one paragraph, and then `Sub-features`, `How to get to it (user POV)`, `Driving it with control.sh` and `Gotchas`.

## Features

- [Split and join](./split.md): subdividing a network. **Split driven 2026-10-10.**
- [Cloud modes](./modes.md): reserved addresses per provider. **Azure and Standard driven 2026-10-10.**
- [Design state](./state.md): Import/Export round trip and history Back. **Driven 2026-10-10.**
