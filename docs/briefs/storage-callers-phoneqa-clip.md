# Brief: clip the /auth orb overflow that keeps failing phone-qa on PR #744 (Website)

Repo 123constante/bachata-website. Read CLAUDE.md, the previous worker's `docs/briefs/storage-callers-phoneqa-fix-handover.md` on branch claude/storage-callers, and `tests/e2e-phone/overlap.phone.spec.ts`. Never merge, never --no-verify, push once. Push ONLY to `claude/storage-callers` (PR #744, head a8bfac0); you are the only worker on it.

## CI rule (owner decision 2026-10-13)
GitHub Actions billed runners may refuse to start ("payments have failed"); that is not a code failure and the owner will not pay. YOU run every CI job step (read .github/workflows) in your sandbox and put a per-job table (command, exit code) in the PR body and handover. No local-machine runs by anyone else.

## Problem and owner decision
CI job `phone-qa` fails on #744 repeatedly (3 of 4 CI runs, including both attempts of the last run): `overlap /auth: no sideways scroll` -> `Error: horizontal page scroll @top`, detail `scrollWidth 421 > viewport 390` (earlier `390 > 360`), `widest: div.absolute.rounded-full`. The previous worker could not reproduce it in its sandbox (1 in 12 under parallel load, 0 in 190 isolated) and found the orbs from src/components/FloatingElements.tsx (mounted by GlobalLayout inside a `fixed ... overflow-hidden` wrapper) but did not capture the failing frame. Owner decision: FIX IT AT THE SOURCE by clipping horizontal overflow; do not accept it as a flake.

## Task
1. Reproduce with CI conditions: `CI=1`, parallel workers like the workflow (read .github/workflows/phone-qa.yml and playwright.phone.config.ts), `--repeat-each` high enough to fail, or throttle CPU (CDP `Emulation.setCPUThrottlingRate`) to mimic the slow runner. In the failing frame capture `getBoundingClientRect()` and computed `position`, `overflow`, `contain`, `transform` of the offending `div.absolute.rounded-full` and EVERY ancestor up to `html`, and which ancestor is its containing block. Put the measurement in the handover.
2. Fix: make the correct ancestor clip (`overflow-x: clip` or `overflow: hidden` plus `contain: paint` on the orb layer), or if the orb layer is not the containing block, make it one (`relative`/`fixed` + `inset-0`). Prefer a change in FloatingElements/GlobalLayout over a global `html { overflow-x: hidden }` (that hides real bugs and breaks position: sticky). Do not change visuals.
3. Add a regression test at 360x640 and 390x844 that fails red on the unfixed code under the same throttled/parallel conditions you used to reproduce, and passes after (run it 30+ times green).
4. Run the full phone-qa job and the unit job as the workflows do; unit failures that also fail on main (integrityCouldNotRun etc., sandbox) are reported separately, not fixed.
5. Keep the PR body sections intact; append a short "Phone QA fix" note with the per-job table and the measurement.

## Output
New head SHA, per-job table, honest Verified / Not verified. Stop after the push.
