# #1577 merge of main after #1576 (dancer dashboard slice 1) -- handover

Ticket dt_962c5658fbf0. Branch `claude/profile-dash-dancer-build`; origin/main merged in (merge commit, reviewed
commits kept). Base: main cc27461.

## What conflicted and how it was resolved
| Area | Conflict | Resolution |
|---|---|---|
| Home (`HomeScreen.tsx`, `homeModel.ts` add/add, `homeAudit.test.tsx`) | both PRs rebuilt Home | #1576 (main) taken whole: Option A Home, claim card, trimmed tiles |
| #1577 Home-only files `HomeMainCard.tsx`, `ClaimYourPage.tsx`, `homeComponents.test.tsx`, `homeModel.test.ts` | superseded by #1576's Home; imported #1577's homeModel | deleted |
| `shell/SwitcherGate.tsx` | main: one profile = `header-account` Link to settings; #1577: Account/Switch strip opening the sheet with Add a profile | #1577's strip kept. Gate now renders once sides load, even with 0 sides (no dancer profile yet, e.g. unclaimed), so Account stays reachable as on main |
| `emberRestyle.test.tsx` | Home + D129 strip tests | main's Home tests; D129 block rewritten for the strip (Account sheet keeps `/account/settings?from=app`), plus a 0-sides test and #1577's Add-a-profile test |
| `tests/e2e/dancer-app/profile-dash-home.spec.ts` (main) | expected `header-account` | now `profile-account-button` |
| `tests/e2e/dancer-app/profile-dash-walk.spec.ts` (#1577) | walked #1577's Home | Home tests removed (covered by profile-dash-home.spec); strip, sheets, untouched Save kept |
| other test files (`b1bAppScreens`, `b1bFinishFixes`, `homeFixPass`, `tests/client/dancerApp*`, `home-nights.spec`) | both edited for their Home | main's versions |
| `package.json` test:e2e | each added a spec | union (both specs) |
| `perf-budgets.json` | dancer-app chunk ratchet 48 vs 46 | main's 46 (holds: 46 of 46) |
| `docs/handover/dancer-rebuild-w2b/*.png` | binary | main's |

Old #1577 walk PNGs for removed Home tests (d1/d2/d3/d4/welcome/linked-line) remain in docs/handover/profile-dash/walk/ as history.

## Local results (merged head)
| Check | Result |
|---|---|
| vitest dancer-app + account/profiles + tests/client/dancerApp* | 72 files, 1984 pass |
| check-dancer-area-isolation | OK |
| check:bundle-budget (after build) | all budgets respected; dancer-app 46/46 |
| check:first-load-requests | 6/6 match |
| typecheck (tsconfig.app.json) | 0 errors in branch files (128 total, all in files this PR does not touch) |
| npm run lint chain | 34 of 34 links green |
| check:mojibake | clean |
| test:e2e (full gate) | 207 pass, 1 fail `dancer-home.spec.ts:169` under load; re-run alone 2/2 pass (flake, untouched file) |
| profile-dash-walk + profile-dash-home + home-nights e2e | 18 pass |

## Not verified
- CI at the final head (pushed at the end; orchestrator to read checks). contract-check was red on main before.
- Real prod data in a browser (stubbed RPCs only); no new prod survey (no shape changed); real phone.
- /code-review not run on the merge resolution.

## Next steps
Read CI on the PR head; if green except contract-check (main-red), ready for owner review.
