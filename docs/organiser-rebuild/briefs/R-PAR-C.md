# Review brief R-PAR-C -- independent review of the F-PAR-fix pass on PR #809

Repo `123constante/bachata-website`. READ-ONLY on source. Opus, ONE pass. Different worker from the author. Branch `claude/org-r1-review-PARC` (create from `origin/claude/org-r1-integrate` head 6c33ffa); push ONCE, a single commit adding `docs/organiser-rebuild/reviews/REVIEW-PAR-C.md` (and screenshots under `docs/organiser-rebuild/walk-PARC/`), subject ending `[worker-done <ticket>]`. Plain git only, never `gh api`; shell commands without variables, loops or `$(...)`. Context: at 25% start nothing new, by 30% push PARTIAL. Prod `stsdtacfauprzrdebmzg`: SELECT only, counts only, no personal data.

## Scope
`git diff 5369379..origin/claude/org-r1-integrate` (the F-PAR fix pass). Read first: `git show origin/claude/org-r1-integrate:docs/organiser-rebuild/handovers/FIX-PAR.md`, and the two reviews it answers (`REVIEW-PAR-A.md` on `origin/claude/org-r1-review-PARA`, `REVIEW-PAR-B.md` on `origin/claude/org-r1-review-PARB`, under `docs/organiser-rebuild/reviews/`). Fixes to findings are unreviewed code: hunt for what the fixes broke.

## Check
1. Change time `endBoxShown` / `serverEndTargets` vs the prod body of `_cmd_occurrence_set_time_p5` (pg_get_functiondef): table-check class+party, two daytime, one session, equal ends, after-party past midnight. Count on prod how many coming dates fall in the guard shape vs the box shape.
2. Pick several: signed `shift_days` from Earlier/Later + unsigned days; `shiftPastProblem` vs the server rule; bulk envelope unchanged.
3. Copy half-done message and `sendAll` partial callback; version chain still advances.
4. Stop repeating curated count vs `_cmd_series_stop_repeating_p5` (`_occurrence_is_curated_v1`); NO_COMING states on every screen that offers Stop / Pick.
5. One name per action ("Put it back", one TAKE_OFF body) on every screen; `A1_APPLIED=false` still gates every Go live / Move offer (grep).
6. Any regression: unit `npx vitest run src/modules/organiser`, `npm run lint`, production `npm run build`; mutate each new rule once (revert after) and paste the red.
7. Walk 390x844 on the production build, 5 shapes (class+party night, one date, weekly 10+, festival, 0 coming): Change time, Pick several, Stop repeating. Tap targets >= 44, no horizontal scroll.

## Output
Verdict line `N BLOCKING / N SHOULD / N NOTE`, findings with file:line and a one-sentence fix, mutation table, CI table, Verified / Not verified. Fix nothing.
