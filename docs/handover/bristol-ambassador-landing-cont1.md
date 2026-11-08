# Handover: bristol-ambassador-landing cont1 (JoinGetPaidNext red check)

Branch claude/bristol-ambassador-landing, PR #1455. Base head 66995c7; merged origin/main (5e300d3).

## Cause (JoinGetPaidNext fix)
NOT reproduced; no branch code is at fault. `git diff origin/main...HEAD --stat` touches only
AnimatedRoutes, catchallClientPaths, siteIa, src/modules/ambassador/link/*. Nothing under
src/modules/admin-organisers/join, src/pages or the invite route changed, so this branch cannot move the
`/invite/<token>?step=code&email=...&next=...` link. The test passes with TZ=Europe/London on 66995c7 (45/45),
on the merged head (45/45), and the whole `src/modules` suite passes (505 files, 17959 tests). Conclusion: the CI
failure was a flaky/load-dependent run (waitFor timing under the full run), not a stale expectation or a branch regression.
No src change made. Re-running CI on the merged head is the fix; if it recurs on main it is a main flake to triage separately.

## Verified
- JoinGetPaidNext.test.tsx 45/45 on 66995c7 and merged head, TZ=Europe/London.
- vitest src/modules: 505 files passed.
- tsc run on merged head: see commit message / 0 errors reported in branch files.

## Not verified
- Full `unit (Europe/London, full)` CI job (not run in whole locally; src/modules only). Per-job CI table: pending, filled by CI on this push.
