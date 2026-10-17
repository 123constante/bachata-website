# Review brief R-INT-A -- whole-diff review of PR #809: correctness and data

Branch `claude/org-r1-review-INTA` (create from `claude/org-r1-integrate`).

## Shared facts
Repo `123constante/bachata-website`. You are the REVIEWER, not an author. PR #809 = branch `claude/org-r1-integrate` (head 8dffd70c), all slices S1-S9 merged. Review the WHOLE diff vs `origin/main` (`git diff origin/main...origin/claude/org-r1-integrate`, 256 files; focus `src/modules/organiser/**`). Briefs: fetch `origin arc/briefs-organiser-r1` (`00-COMMON.md`, `R1-PLAN.md`, the S*.md briefs). Handovers: `docs/organiser-rebuild/handovers/` on the integrate branch (S8.md, INTEGRATE2.md). Earlier reviews to copy the method from: `reviews/REVIEW-S5.md`, `REVIEW-S6.md`, `REVIEW-S7.md` on their review branches. You change NO source file; you commit ONLY your review file.

## Rules
Opus, xhigh. ONE pass. BLOCKING / SHOULD / NOTE, each with file:line, why, a one-sentence fix, and evidence (command + output; mutation red where you claim a test cannot fail). Plain git only, never `gh api`. Shell commands WITHOUT variables, loops or `$(...)`. Production build (`npm run build`) not only dev. Under 30% context; at 25% start nothing new; by 30% push with a last commit subject ending `PARTIAL [worker-done <ticket>]`. ONE push; last commit subject ends `[worker-done <ticket>]`. Supabase prod `stsdtacfauprzrdebmzg` is SELECT only, counts only. CI note: GitHub Actions billing is intermittent; a red whose annotation says payments failed is not a code failure; run the CI job steps you can in your sandbox and list what could not run.

## Known context (do not re-report as new; DO check they hold)
Decisions logged: S9 perf-budgets bump (puller 4, chunks 58, 364 KB); email_differs and managed claim -> "Ask to join"; S6 manager-add needs admin A1b (migration 20261126190000); S7 Leave disabled only for the SOLE owner; "Add a page" naming; S6 URL carries user_id. Known NOT done: stale "Make owner" copy at `shared/selfServeErrors.ts:243` and `edit-in-place/teamPickerModel.ts:159`; New-flow disabled-step rows; fixtures dir + real-RPC spec. Owner decision made: edit-in-place pencils on /page become 44px (the fix worker does it, not you; you only confirm nothing else on /page is below 44).
Prod shapes (read-only survey 2026-10-17): 46 organiser pages; 50 active team rows, all role Leader; 0 pages with no active team; 4 pages with 2-5 team members, 0 with 6+; 746 series; pages by series count: 0 = 2, 1 = 17, 2-9 = 23, 10+ = 4. Walk every screen against: page with 0 series, 1 series, 10+ series, a team of 1 and of 2-5, and ended / paused / cancelled-only / festival / course events.

## Output
`docs/organiser-rebuild/reviews/REVIEW-INT-<A|B>.md` on your branch: verdict line (CLEAN / n BLOCKING / n SHOULD / n NOTE), findings, CI table, Verified / Not verified.

## Your scope (correctness + data)
1. Every WRITE path (Home, New, My events/one event/Details, pause/end/repeats/put back, Team add/remove/hand over/leave, Door claim/Ask to join/create, My page edit-in-place, Cover fix, More/sign-out): exactly ONE pinned command with keys + `expected_version` where the RPC takes one; untouched Save sends NOTHING; idempotency keys reused on retry; `version_conflict` ends on the one shared EventConflict view.
2. Merge-seam defects between slices: doneState `nextLabel` (S6+S7), `?o=` on /new/what, `ORG_PATHS.newEvent` users, duplicated mappings (chip text, status, error copy: one shared mapping each), dead code left by the merge, routes with no importer, `OrganiserRoutes.tsx` and `routes.test.tsx` coherence, both sign-outs on `useSignOutToHome`.
3. Auth/authz reads: which RPC each screen calls, what a non-owner / manager / removed member / signed-out person gets, user_id vs profile_id (S6).
4. Mutation proof: pick 6 tests from `consistency.matrix.test.tsx`, `consistency.render.matrix.test.tsx`, S5/S6 command tests; mutate the code under test, paste each red, revert.
5. Run the CI steps from `.github/workflows` in your sandbox (typecheck vs base count, `test:unit`, lint chain, `build`, `check:mojibake`, `lint:architecture`, `check:images`, perf-budget); compare reds against `origin/main`.
