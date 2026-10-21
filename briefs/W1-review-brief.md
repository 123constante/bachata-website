# W1 independent review (Website, Opus, READ-ONLY on code)

Repo: Website (123constante/bachata-website). Review PR #893, branch `claude/w1-people-surfaces` (merge of sub-branches `claude/w1-s0-badges`, `-s4-graphite`, `-s1-lists`, `-s2-rolepages`, `-s3-strips`). You are NOT one of its authors. Do not change product code. Write ONE file `docs/reviews/w1-people-surfaces-review.md` on your own branch `claude/w1-review` (created from `origin/claude/w1-people-surfaces`) and push it. Never push any other branch, never merge or approve, never comment on the PR.

Read first: the 5 handovers `docs/handover/w1-s{0,1,2,3,4}-*.md` on the branch, the plan below, and the approved look `claude/s12-mockups` `docs/handover/s12-mockups.md` + `docs/mockups/s12/*-final.png`, and S13 `claude/s13-site-background` `docs/handover/s13-site-background.md` (owner picked option B).

## Owner decisions the code must implement (binding)
Separate role pages (dancer / DJ, each with its own Share), joined by an "Also" bar. Vocabulary Dancer / DJ / Teacher from ONE mapping (`src/modules/person-page/badges.ts`, reusing `ROLE_LABEL` in `src/lib/searchEntities.ts`). The stage name leads on DJ things only. Teacher pages OFF (`flags.teacherDetail`): the Teacher tag shows as plain text and nothing links to `/teachers/`. Never a dead-end link. Thin pages (no empty boxes, no defaults shown as facts). /dancers = dancers only + labels; /djs = upcoming first + "Playing soon", DJ label always shown (owner choice A, even on "DJ ..." names). Favourite songs back inside the dancer card. Role grounds: dancer teal #06191F, DJ near-black #0A080B; all `default`-palette pages calm graphite #0E1215, static, no floating icons, no black band. Labels at least 12px.

## Review for
1. Correctness bugs and regressions vs `origin/main` on every changed surface (diff `origin/main...origin/claude/w1-people-surfaces`). Each finding: file:line, concrete failure scenario, severity BLOCKING / SHOULD / NIT, and a verdict CONFIRMED (you reproduced it: test, script or read-only prod query) or PLAUSIBLE.
2. ONE mapping: any surface that writes role labels, role hrefs or the name rule itself instead of `badges.ts`. Any two screens that can show the same person differently.
3. Dead ends: every href a surface can produce resolves on prod (public row exists for that id in the matching list/detail RPC). Use read-only Supabase SELECTs and the S0 survey shapes (incl. 5 people with an empty role list, 62 teacher-only).
4. Privacy: no contact/private field newly exposed; the badges RPC adds nothing private.
5. Performance: number of badges RPC calls per page load (event page, /dancers with ~160 ids, search), cache keys, request waterfalls, first-load bundle (S3 says `/event` now pulls `badges.ts` + `searchEntities.ts`).
6. Flags: which surfaces only show behind flags (`VITE_ENABLE_SEARCH_V7`, `VITE_ENABLE_ORGANISER_DETAIL`, teacher flags). State plainly, for prod as deployed today, which changed surfaces a visitor will actually see (read `src/lib/featureFlags.ts` and any env defaults in the repo; if prod values cannot be read, say so and how to find out).
7. Give a verdict (agree / disagree + why) on each open point the authors raised:
   a. DJ hero vinyl label text clipped (`DjHero` in `src/components/dj/DjTiles.tsx`).
   b. Chip reads "DJ · DJ El Rugido" when the stage name starts with "DJ" (5 people). The orchestrator's reading: owner choice A ("DJ label always shows") means keep it. Agree or not.
   c. Header search overlay (`HeaderSearch` / `searchRpc.mapPersonV7`) still links people to `/people/:id` (no route) and hides Teacher while the flag is off.
   d. Organiser team strip no longer shows the member's free-text team role ("Founder").
   e. DJ tiles on /djs lost their genre chips (3 columns).
   f. Chi-Wei: `dance_started_year` = this year is treated as unanswered (hidden).
   g. Merge conflict with open PR #850 on `SearchResults.tsx`.
   h. S4's own shots all showed the /parties shell, so the footer strip and icon-over-text were not measured.
8. Tests: do the new table tests actually bite (spot-check one mutant per slice and say the result), and were the changed old fixtures/snapshots updated for a right reason rather than rubber-stamped?

Run the full unit suite and `npm run build` once on the merged branch and report failures vs `origin/main` (attribute each).

## End
The review file ends with a ranked list "for the fix pass" (BLOCKING first) that a fresh worker can execute without reading anything else. Then push. Last commit subject ends `[worker-done <ticket>]`.

## Rules
- Plain git only (`git fetch`, `git show`, `git push`); NEVER `gh api`. Commands without variables, loops or `$(...)` where a plain command works.
- Supabase READ-ONLY (SELECT only). Never touch `.github/workflows`, `.env*`, secrets.
- Push ONCE. 30% context rule: at 25% start nothing new; by 30% push what you have, last subject ending `PARTIAL [worker-done <ticket>]`.
- Never merge, approve, or open a PR. Stop after the push.
