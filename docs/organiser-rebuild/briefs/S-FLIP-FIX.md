# Brief S-FLIP-FIX -- one failing e2e-smoke spec on PR #869 (continuation of S-FLIP)

Repo `123constante/bachata-website`, branch `claude/org-r1-flip-gates` (PR #869, head dae60282; you push this same branch, ONE push at the end). Plain git, never `gh api`; shell commands without variables, loops or `$(...)`. Nothing on the owner's PC. 30% context limit. HTML entities in source. Read `docs/organiser-rebuild/handovers/S-FLIP.md` first.

## The failure (GitHub e2e-smoke, the real check)
`tests/e2e/organiser-events.spec.ts:30` "New event: a weekly night walks what, name, venue, date and time..." fails at line 66: expected "Choose a photo first." received "Choose a photo to go live." (testid `org-new-live-reason`). Cause: S-FLIP turned A1_APPLIED on, so the new-event screen now shows the gate-ON wording. The other 156 e2e tests pass; auth-magic-link-returnto is a known flake.

## Do
1. Fix the spec expectation to the gate-ON wording (the string comes from the shared model; import or read it from there rather than a third copy if the spec can). Check EVERY other file in the `test:e2e` list (package.json, by name) and `tests/e2e/**organiser*` for strings that only exist when a gate is false ("next platform update", "Choose a photo first", "Before then") and update them the same way; list each one in the handover.
2. Run the whole `test:e2e` spec list in your sandbox against a production build (the way e2e-smoke.yml does: read the workflow) and paste the pass/fail counts. The check that would have caught this: the worker's earlier run only ran vitest and one throwaway spec, not the gated e2e list.
3. Do not change product copy or gates. ONE push; last commit subject ends `[worker-done <ticket>]`; no `[skip preview]`.

## Report
Append a "FIX round" section to the S-FLIP handover: files changed, e2e counts before and after, per-job table.
