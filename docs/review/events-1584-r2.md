# Review r2: PR #1584 (organiser Events tab core) at head a89f61c

**Verdict: FIX** (one defect). F1, F2 and F4 hold. F3 is fixed in code, but its walk evidence is stale and no test covers it.

Reviewer: independent cloud worker, one round, read-only on the PR branch. Ticket dt_b5e790b932dd.

## What was checked
- `npx vitest run src/modules/organiser/p3/events` at a89f61c: 4 files, 55/55 green.
- Red-first check: I put back `DashEvents.tsx` from 78f5094 (before fix round 3) and ran it against the new `dashEvents.test.tsx`. 4 tests fail: the F1 key test, plus the F4 rows `viewer`, `""` and `undefined`. All 4 pass on a89f61c.
- I read the walk shots (all 7 are 390x844) and the fix-round-3 diff (78f5094..a89f61c).

## The four claims
| # | Claim | Result |
|---|---|---|
| F1 | Reload gives a fresh idempotency key | PASS. `src/modules/organiser/p3/events/DashEvents.tsx:69` and `:73` rotate the key when the reload succeeds and when it fails. Test `dashEvents.test.tsx:150` checks that the second send has a new key and version 9, and it fails on the unfixed code. |
| F2 | Conflict-after-reload shot re-taken | PASS. `organiser-events-walk-conflict-after-reload.png` shows "Cancel all 11 nights?", which differs from `every-night-confirm.png` ("12 nights"). The md5 hashes differ. |
| F3 | Single Close in the conflict Sheet | Code PASS, evidence FAIL. See D1. |
| F4 | Unknown role is view-only | PASS. `DashEvents.tsx:202` maps any role other than owner or manager to contributor. Test `dashEvents.test.tsx:234` covers 6 roles and fails on the unfixed code. |

## Defects
**D1: `docs/design/profile-dash/shots/organiser-events-walk-conflict.png` is stale and contradicts F3.**
- The shot still shows two Close controls: the Sheet's header link and the full-width "Close" button that fix round 3 removed at `DashEvents.tsx:79-86`.
- Fix round 3 did not re-take this file: `git diff --stat 78f5094 a89f61c` lists only `conflict-after-reload.png`.
- No unit test or walk assertion checks that there is only one Close (`tests/e2e/walk-p3-organiser-events.spec.ts:49-69`, `dashEvents.test.tsx`). If the button comes back, nothing goes red.
- The brief requires walk shots that "show what the tests claim".
- Fix:
  1. Re-take `organiser-events-walk-conflict.png`.
  2. Add an assertion that the conflict Sheet has exactly one Close, either `getAllByRole('button', { name: 'Close' }).length === 1` in `dashEvents.test.tsx` or the same check in the walk spec.

## Contract re-check (no new defects)
- **Contributor is view-only:** `eventsModel.ts:122,124,157,193-217` gates cancel, edit, delete and New event behind the contributor reason, and shows the view-only banner.
- **Flag off means no change:** `EventsScreen.tsx:44` adds a branch only under `flags.organiserDash && scope.selected`. The old path below it is unchanged. The `DateSheet.tsx`/`parts.tsx` changes are additive optional props (`start`, `onReload`), with existing defaults kept.
- **Loading, error and empty states:** all have a next action (Retry, or copy saying what the person can do) at `EventsScreen.tsx:31-36`, `DashEvents.tsx:110-138` and `eventsModel.ts:216-217`.
- **Disabled controls give a reason:** Cancel, Duplicate and New event use `aria-describedby` reasons (`EventsView.tsx:58,137-141`), and Delete-draft does when the load fails (`DashEvents.tsx:185`).
- **Nit, not blocking:** an unknown role sees "You are a contributor…" (`eventsModel.ts:27`), which is acceptable for a fallback.

Not treated as findings, per the brief: the red contract-check (inherited P5 drift) and the cancelled `decide` job.
Not verified: tsc or pre-ship, CI per job, prod-shaped walk.
