# Brief: P3 W2a CONTINUATION (verification only) -- Website, lane normal

Branch `claude/p3-w2a-event-page`, PR #1057 (already open, bot-authored). Do NOT change the screens' behaviour unless a check below proves a bug (then red test first). Do NOT touch `/account/o`, admin, or DB. Read FIRST: `docs/session-handover-2026-10-26-p3-w2a.md` and `docs/design/1057.md` on the branch, and the original brief `briefs/p3-w2a-event-page.md` on `brief/p3-w2a-event-page`. Use `NODE_PATH=` for hooks and vitest (the sandbox global NODE_PATH breaks `tests/integrityCouldNotRun.test.ts`).

## Do, in order (the handover "Open / next" list)
1. Re-run the 3 red e2e specs (auth-magic-link-returnto, organiser-home "load failure ... Retry", organiser-onboarding "Sign in link returns") on `origin/main` in a separate worktree. Red there too = say so in the PR body (pre-existing, with the run output). Green on main = they are caused by this diff: fix with a red-first test.
2. Run the phone suite (`playwright.phone.config.ts`) and the build smoke (`playwright.build.config.ts`); report per-job results.
3. Walk: follow handover step 3 (copy `docs/handover/p3-w2a-walk/walk.phone.spec.ts.txt` to `tests/e2e-phone/zz-walk.phone.spec.ts`, export `SHAPES` from `p3/screens/__tests__/wsFixtures.ts` to JSON, run with `VITE_ENABLE_ORGANISER_P3=true`, delete the spec after). Commit 8+ PNGs at 390x844, light + dark, covering: weekly live, one-off live, course, festival, draft, paused, ended, 131-date series ("100 of N"), no sessions, Status sheet open (live one-off not yet run: greyed End it with reason + greyed Cancel the event slot), End it sheet with the tonight question, Stop repeating keep list. Then update design record stage 4 with measured contrast / tap / clip / sideways-scroll numbers.
4. Fill the PR #1057 body: template sections "Verified on real data" (the prod shape survey is in the design record; copy the counts) and "Phone QA", plus a per-CI-job table read from the GitHub checks and the workflow files. Honest Verified / Not verified. Remove `[skip preview]` handling per the dispatch prompt (final push must NOT carry it).
5. Known gaps (documented, leave): stored role `mc` not shown; per-date session changes (W2b); broken cover URL leaves an empty 16:9 box. If cheap and safe, fix the cover box with a test; otherwise leave.

## Done =
Pushed to `claude/p3-w2a-event-page`, last commit subject ending `[worker-done dt_<ticket>]`, PR body complete, report: head SHA, each check result, the walk file list, Verified / Not verified. Stop at 50% context with a PARTIAL marker.
