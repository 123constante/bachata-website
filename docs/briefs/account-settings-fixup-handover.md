# Account settings fix-up: handover (Phase F, Website)

Branch `claude/account-settings-screens`, PR #743. Brief: `docs/briefs/account-settings-fixup.md` on `arc/briefs-account-lifecycle`.

## What the CI log actually said (run 38391491331, head 8e2896f)
The brief had the two e2e items the wrong way round:
- `account-settings ... sole organiser owner ... hide still offered` was the HARD failure: it failed on the attempt AND the retry (`Received: 14`, then `Received: 8`). Not a one-off.
- `dancer-home ... a finished dancer gets the dancer home` was reported FLAKY (failed attempt 1, passed on retry; CI shows `1 flaky`, not failed). The step still exited 1 because of the settings failure.

## Causes
1. **Overflow 14 then 8** = the page-slide transition. `PageTransition` slides every route in from `x: 30` to `0` over 0.25s, and while it runs the document is up to 30px wider than the screen. `expectNoHorizontalScroll` measured at once; the other settings tests wait 1500ms first, this one did not. Measured with a per-frame probe: 14 frames of overflow, 30,30,28,26,...,4, then 0. Not caused by #743 (app-wide), but #743's test hit it.
2. **Dancer-home flake**: element never appeared in 15s on the first attempt, fine on retry; cold Vite dev server on the runner. #743 does add one query (`useMyProfileVisibility`) to `DancerHome`, but its mock row resolves to "visible", and the spec passes 14/14 locally, so no code or assertion change was made (the assertion is NOT weakened). Not reproduced; cause not proven, only the cold-start explanation fits. If it recurs on main, look at the trace first.
3. **RenderErrorBoundary stack traces in the e2e log**: 115 of them, every one is the React warning "useLayoutEffect does nothing on the server" from `HeaderSearch` (`src/components/search/HeaderSearch.tsx`). Not an error, no route throws, #743 does not touch that file. Pre-existing on main; left alone.

## Fix
`tests/e2e/helpers/organiserFake.ts` `expectNoHorizontalScroll`: poll until the overflow is <= 0 (the page-transition has settled), wait 300ms, measure again. A genuinely too-wide page never settles at 0 and still fails (checked with a probe that injected a 600px element: the helper rejected). Shared by every spec that uses it.

## Gates (local, branch head + this change)
- `npm run test:e2e` (the workflow step, same env vars): 99 passed, 1 skipped, 0 failed, run twice (second with `CI=true`, retries on, 0 flaky).
- Failing-first: the old measure, sampled per frame, reads 30 right after the route renders (nonzero for 14 frames); the new helper waits it out.
- `npm run lint`: 15 of 16 links pass; `check:integrity` exit 126 (script not executable here, also on a clean tree); `bash bin/check-integrity.sh` = ok.
- `npm run test:unit`: 15 failures in 4 files (eventViewCompat/occurrenceProgram/publicEventPageLineup contracts, integrityCouldNotRun); the same 15 fail on a clean `origin/main`.

## Not verified
Real backend; real device; pixels (screenshots blank here); the CI jobs that need secrets/network (perf-budget, live-qa, seo, DB-contract, og-image); the dancer-home flake cause; `/code-review` not run.
