# Design state

A design survives through Import/Export JSON, `?c=` share links and browser history. A clean reload starts over.

## Sub-features

- `state-export-import`: exporting and then importing into another page gives identical rows.
- `state-history-back`: Back undoes the last split.
- `state-share-link`: a `?c=` link loads a design (covered by `src/tests/bug-fixes.spec.ts`, not driven here).

## How to get to it (user POV)

- Tools, Import / Export. Or the browser Back button.

## Driving it with control.sh

Preconditions:

- `doctor` prints `OK`.

- **Round trip.** `control.sh --execute drive share 10.0.0.0 16 10.0.0.0/16` gives `imported-fresh-page` rows `10.0.0.0/17` and `10.0.128.0/17`, and `matchesExportingPage: true`.
- **Back.** `control.sh --execute drive history 10.0.0.0 16 10.0.0.0/16 10.0.0.0/17` gives `restoredByBack: true`.

## Gotchas

- A reload with a clean URL calls `reset()`. Don't treat that as lost state.
