# W1 finishing pass (Website, Opus): review fixes + full gates + phone QA for PR #893

Repo: Website (123constante/bachata-website). Branch: `claude/w1-people-surfaces` (PR #893; it EXISTS, work on it, do not recreate). This is the ONE fix pass after the independent review. Handover: `docs/handover/w1-finish.md`.

## Read first
- The review: `git fetch origin claude/w1-review` then `git show FETCH_HEAD:docs/reviews/w1-people-surfaces-review.md`. Its section "For the fix pass (ranked; execute top-down)" is your work list, items 1-19, plus item 20 (process) as far as a sandbox can.
- The 5 slice handovers on the branch: `docs/handover/w1-s{0,1,2,3,4}-*.md`.
- The approved look: branch `claude/s12-mockups`, `docs/mockups/s12/*-final.png`.

## Orchestrator decisions on the review's "owner to confirm" items (binding; logged for the owner's review pack)
- 7b: YES, strip a leading `DJ ` (case-insensitive, `/^dj\s+/i`) from the stage name in the `roleTagsFor` DJ tag label only: "DJ · El Rugido". Tile names and the DJ page keep the full stage name. `badges.ts` is no longer frozen for this one change; update the S0 table test.
- 7d: YES, show the organiser-authored team title when one is set (no `'Team'` default), next to the tags.
- 7e: KEEP the genre chips off the /djs tiles (they stay on the DJ page). No change.
- 7f: YES, a current-year start shows as "New this year"; null stays hidden.
- 7a: do item 19 (hide the spindle dot when initials show, and the label text must not spin unreadably). The S1 slice owned `DjTiles.tsx`; you own it now.

## Also required (missing from the slices)
- S1 never did its phone QA. For /dancers and /djs: before (`origin/main`) / after PNGs at 390x844, and measures at 390x844 and 360x640: no horizontal scroll, names not cut, label row height, "Playing soon" contrast ratio, `elementFromPoint` on tiles. S2 and S3 did theirs; their shots stay valid unless your change touches the surface (then re-shoot it).
- C1 proof in a browser: /dancers with the badges RPC blocked (route intercept) shows tiles, not "No dancers yet".
- 7h: footer strip colour on a default-palette page after a CLIENT navigation, and on `/event/<legacy id>` (Pura Nights Ealing `/event/4ec7a3d5...`; find the full id read-only), measured.
- Serve the production build with the react-router server build as S2 did (`docs/handover/w1-s2-rolepages.md`), never a SPA fallback that shows another page; assert `location.pathname` and the h1 on every shot.
- Every fix: a test shown RED on the pre-fix code, then GREEN (commands + results in the handover).

## Gates (run ALL; per-job table, command + exit code, in the handover AND the PR body)
Read `.github/workflows/*.yml` and run every job step your sandbox can run: full `npm run lint` chain (if `check:integrity` exits 126 for the not-executable script, run it with `bash bin/check-integrity.sh` and report both), typecheck (compare the count to `origin/main`'s baseline), the full unit suite (attribute each failure vs `origin/main`), production build, bundle budget, any phone e2e. A GitHub "payments have failed / spending limit" annotation is billing, not code; your table is the evidence. Docker / local Supabase / real phone: NOT RUN with the reason.

## PR body
Replace the PR #893 body with: what changed (per surface), the orchestrator decisions above, the per-job gate table, a `## Phone QA` section with measured numbers, and Verified / Not verified. Keep the line "Do not merge" (the orchestrator removes it after its own walk). You may update the body with `gh pr edit 893 --body-file <file>` (plain `gh pr edit`, NOT `gh api`); if `gh` is unavailable, put it all in the handover instead and say so.

## Rules
- Plain git only for reading and pushing (`git fetch`, `git show`, `git push`); NEVER `gh api`. Commands without variables, loops or `$(...)` where a plain command works.
- Supabase READ-ONLY (SELECT only). Never touch `.github/workflows`, `.env*`, secrets.
- Push ONCE at the end (Vercel deploy cap; one preview build). Last commit subject ends `[worker-done <ticket>]`.
- 30% context rule: at 25% start nothing new; by 30% push + handover with the exact list of review items left, last subject ending `PARTIAL [worker-done <ticket>]`. A continuation worker on this branch then reads `docs/handover/w1-finish.md`; that is planned and normal.
- Never merge or approve. Stop after the push.
