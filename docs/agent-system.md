# visualsubnetcalc: agent operating model

Adopted 6 October 2026 from local source and command inspection.
Browser subnet design, allocation and URL-share state.

## Read by intent

Start with the local agent guide and build manifest. For domain or behavior
changes, follow the owners below, then the relevant contract/test. These
documents retain product detail and historical evidence:

- [README.md](../README.md)

## System ownership

| Owner | Responsibility |
| --- | --- |
| [src/js/main.js](../src/js/main.js) | Editable domain/UI/style source. |
| [src/index.html](../src/index.html) | Editable domain/UI/style source. |
| [src/scss](../src/scss) | Editable domain/UI/style source. |
| [package.json](../package.json) | Root build/test command owner. |
| [playwright.config.ts](../playwright.config.ts) | Root build/test command owner. |
| [dist](../dist) | Generated output only; may be absent until build. |

Intent selects the owning policy; that policy produces decisions or artifacts;
adapters perform effects; verification establishes the result. Change the
owner once and keep alternate surfaces on that same contract.

## Invariants

- Edit src, never generated dist.
- Shared compressed URL is captured browser design state, not deployed cloud networking.

## Existing action interfaces

These are inspected command surfaces, not a report that they ran. Read current
help and recipes for arguments, dependencies and lifecycle hooks before use.
Examples containing placeholder paths or bracketed options are grammar.

| Command | Effects and evidence |
| --- | --- |
| `npm run build` | Root build compiles SCSS and populates dist. |
| `npm test` | Root Playwright suite. |
| `npm run setup:certs` | Creates local TLS certificates; no global CA trust installation in script. |
| `npm run local-secure-start` | Serves generated dist over HTTPS at 8443. |

## Observe, verify and retain

Establish source revision, dirty state and relevant input identity before
choosing an action. Keep intended settings, cached artifacts and observed
runtime state distinct. An existing artifact is not a freshness or readiness
claim. Use the smallest deterministic fixture at the changed seam first;
expand to process, browser, device or deployment checks only when that
claim needs them. Record unavailable evidence explicitly.

Retain the command/configuration, source and input identity, result, limitation
and next discriminating check. Reuse evidence only while its relevant inputs
remain applicable. Promote a reproducible failure to a regression fixture,
a design decision to its owning document, and a repeated operator correction
to one concise guide rule. Keep private observations in private artifacts.

## Implemented plan for this pass

- [x] Map current source ownership and existing interfaces.
- [x] Make command effects and evidence limits discoverable.
- [x] Route agent work here and retain detailed product plans at their owners.

Acceptance: owner paths and document links resolve; current instructions
match inspected source; catalog hashes bind this context to the reviewed
bytes. This is documentation/control navigation acceptance. Product runtime
checks retain their own scope and are not certified by this pass.

## Project decisions

Run npm commands from the repository root: package.json and playwright.config.ts are root-owned. Edit src/js/main.js, src/index.html and src/scss/custom.scss, then npm run build derives dist. The core subnet hierarchy/constraints drive allocation, split/join, mirror and URL sharing; rendered table and compressed URL are views of that same browser model. Test a changed invariant with focused Playwright scenarios before running both configured browser projects. HTTPS/clipboard acceptance requires local certificate setup and browser support; no subnet design output establishes actual cloud deployment. Keep source-to-generated output rules explicit and record confirmed share-format regressions as compatibility fixtures.
