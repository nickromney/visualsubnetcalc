# Verification update, 14 October 2026

The existing verification skill now vendors verify-kit 1.2.1. The shared cycle preserves failure on Bash nounset errors even when cleanup succeeds, rejects unsafe run IDs before dispatch or writes, and rejects invalid browser scopes before state/evidence writes. The root-approved canonical suite passed 36/36, including these regressions.

The verification launch now snapshots source under its owned run state, links the project's existing `node_modules`, builds and serves that snapshot's `dist/`, and leaves the checkout's `dist/` untouched. Snapshots exclude installed modules, generated output, VCS state, local secret/config files and local certificates. Cleanup stops only the run's server and removes state carrying its ownership marker, while retaining evidence. App tests cover output/config exclusion, dependency linking, and refusal to overwrite or clean unowned state.

The source-isolation change passed `make verify-dry-run`, `make verify-test` (42 BATS tests), and the serialized full journey in run `262-visual-owned-final`. Chromium, Firefox and WebKit each passed the Azure and standard modes, subnet splitting, share/import and history-back flows, with no console errors. Root's before/after comparison found all 26 checkout `dist/` files byte-identical. The run stopped its owned server and removed owned state while retaining evidence. The existing product verification scope remains documented in the project-local skill.

Where this project declares active Playwright dependencies, their manifests and native locks are exact 1.63.0. Installed packages were checked where an installation exists. Uninstalled workspaces were resolved without installing large dependency trees. Browser packages use Chromium revision 1243, Firefox revision 1543 and WebKit revision 2359 via `PLAYWRIGHT_BROWSERS_PATH`.

Historical reports and upstream source snapshots retain their original versions. Browser binaries, local evidence, caches and credentials are excluded from this change.

Final relaunch-ownership correction: `266-owned-relaunch-fix` passed dry-run, all contract checks, and live verification. A refused verify launch preserves existing owned state; explicit cleanup remains available.
