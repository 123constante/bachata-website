# Session handover 2026-11-11: gateRetry matrix flake (F-13)

Branch `fix/gateretry-matrix-flake`, PR #1543 (label automerge-ok, not merged).
Detail of the fix and proof: `docs/handovers/gateretry-matrix-flake.md`.

## Done
- Root cause: test timing, not a product bug. `useKeptEdit` drops the kept draft in a passive effect;
  the row read storage right after `findByTestId`, before React's scheduler tick on a loaded runner.
- Fix + checks in `src/modules/organiser/p3/screens/__tests__/gateRetry.matrix.test.tsx`:
  `waitFor` on the drop; slowed-tick ("loaded runner") mode with an `afterAll` proof it is used; row leak check.
  Red-first reproduced the exact CI error. tsc 0 errors, eslint clean, check:mojibake clean, /code-review 0 findings.
- CI on b53befc: `unit (Europe/London, full)` GREEN (the job that flaked). Every other non-browser check green.

## Open (none caused by this PR; two PR comments explain both)
1. Browser jobs red: `e2e-smoke`, `synthetic-preview`, `build-smoke`, `phone-qa (1-3)` all fail at
   "Install Playwright browsers": runner DNS cannot resolve azure.archive.ubuntu.com (apt), since ~14:46 UTC.
   7 rounds of re-runs failed identically. Owner fix in flight: PR #1544 (jobs in the Playwright 1.63.0
   container, green) + PR #1546 (allow-list). `synthetic-preview` is NOT in #1544's list of jobs.
2. `seo-preview` red: `/event/rogue-bachata` and `/event/rogue-bachata-wednesday` are `paused` on prod
   (since 2026-11-10), so no Event JSON-LD by design, but `scripts/check-seo.mjs` samples them from the
   sitemap and requires the node. Needs an owner decision: guard skips paused events, or sitemap drops them.

## Next
- After #1544 and #1546 merge: merge `main` into `fix/gateretry-matrix-flake` (no rebase), push, and confirm
  the container jobs go green on the new head.
- If `synthetic-preview` is still red on apt: it needs the same container treatment (separate CI PR).
- `seo-preview`: apply the owner's choice in a separate PR, then re-run it here.
