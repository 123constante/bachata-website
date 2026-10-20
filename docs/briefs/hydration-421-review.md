# Brief: independent review of the #421 fix (READ-ONLY on source; Website)

You are a DIFFERENT worker from the author. Review branch `claude/hydration-421-fix` (head a935d822) against `main`. Do not change source. Push ONE empty commit to `claude/done-<your ticket>` whose subject ends `[worker-done <ticket>]`, and put your whole report in `docs/review-hydration-421-fix.md` on that same done branch (plain git only, never gh api).

Read first: `git show origin/claude/hydration-421-fix:docs/handover-hydration-421-fix.md` and the findings `git show origin/claude/hydration-421-trace:docs/handover-hydration-421.md`. Diff: `git diff origin/main...origin/claude/hydration-421-fix`.

## Answer each, with evidence (command + output), not opinion
1. Correctness of src/modules/event-page/bento/BentoPage.tsx: are RsvpSlot / LevelSlot props really stable across a parent re-render (no new array/object/element literal sneaking in, including snapshotQueryKey and the badge)? Is behaviour unchanged for: cancelled event, ended event, event with no occurrence, user logged in vs out, derived level present vs absent? The author loosened the regex in derivedBadgeGating.test.ts: confirm the gating really still hides the badge when cancelled (write a throwaway check, do not commit it).
2. Module-scope import() warm-up: is it guarded for SSR (client only)? Any chance of an unhandled rejection or a duplicate chunk fetch? Does it change first-load requests (`npm run check:first-load-requests`, `npm run check:bundle-budget`)?
3. The e2e spec tests/e2e/event-hydration-421.spec.ts: red on unfixed main, green on the branch? Re-run it 3 times each on a production build (setup notes in the trace doc: prod Supabase URL + public anon key on the command line; NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt). Is it wired into `test:e2e` by name and does it skip cleanly where it cannot run?
4. The three unit files the author did not re-run on main (eventViewCompat, occurrenceProgram, publicEventPageLineup): run them on main AND on the branch; say whether the failures are identical.
5. Visual: on the production build at 390x844, load the ongoing and the ended event on main and on the branch (CPU 4x). Take screenshots of the RSVP block and level card at first paint and after 3 s; say whether anything flickers, jumps or differs. Put the PNGs (each under 150 KB, viewport only) in docs/review-hydration-421-fix/ on the done branch.
6. Anything else wrong. Rank findings blocker / should-fix / nit.

Rules: Supabase read-only; never merge or approve; never --no-verify; commands without variables or loops where plain works; stop at 30% context (PARTIAL push with handover). End with a Verified / Not verified block.
