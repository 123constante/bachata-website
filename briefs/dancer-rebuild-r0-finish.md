# Brief: Dancer Rebuild R0-finish (finish the regression baseline: mutants + CI gates) -- PR B1a sub-branch

Repo `123constante/bachata-website` (PUBLIC: no secret or email in any commit). Model Sonnet 5.5.
NEVER run `gh api` in this repo; read other branches with `git fetch origin <branch>` +
`git show FETCH_HEAD:<path>`. Read `briefs/dancer-rebuild-COMMON.md` and
`briefs/dancer-rebuild-r0-regression.md` on `arc/briefs-dancer-rebuild` FIRST.
BRANCH: `arc/dancer-app-r0` ALREADY EXISTS (head `262a352f`, pushed by the previous R0 worker, which stopped
at its context gate). Check it out and CONTINUE on it; never recreate it; push only this branch. Do NOT
open a PR. The previous worker's handover is `docs/handover/dancer-rebuild-r0.md` on that branch: read it in
full first. Its "What is left" section is your whole job:

1. Red-first mutants (apply locally, run, REVERT; never commit a mutant; assert with `git status` that the
   tree is clean afterwards): (a) one word of copy in `src/pages/FinishProfile.tsx`; (b) the organiser
   redirect target in `src/pages/Account.tsx` (`legacyAccountPath("home", ...)`); (c) drop
   `isAccountPath(pathname)` from `BANNER_HIDDEN_ON` in `src/lib/profileCompletion.ts`. For each: the
   failing test NAMES and one quoted assertion line, written into the handover's "Red-first proof". A
   mutant that does NOT make the suite red is a finding: say so, add the missing assertion to
   `tests/regression/today/**`, and re-run.
2. Gates with the new files present: `npm run test:unit` (Node 22), `npm run lint` (the chain), `npm run
   typecheck`, `npm run build`; then read every `.github/workflows/*.yml` and run each applicable job step
   (unit-tests incl. the new `dancer-area-isolation` job's two steps, typecheck, architecture-guard,
   ci-budget-guard, perf-budget, workflow-lint, the integrity job with `AUDIT_STRICT=1`). Per-job table
   (command, exit code) in the handover. Known environment reds on bare main (not yours; list them as
   such): the three live-DB `*.contract.test.ts` files and `tests/integrityCouldNotRun.test.ts`.
3. If a gate finds a real problem in R0's files, fix it on this branch (same brief rules). Do not touch any
   seam or protected file (the isolation check you inherit will tell you).
4. Update `docs/handover/dancer-rebuild-r0.md` in place: fill "Red-first proof", the CI table, Verified /
   Not verified; change Status from PARTIAL to COMPLETE (or say exactly what is still missing).

Done means: mutants quoted, gates tabled, handover updated. Commit, push ONCE with
`[worker-done <ticket>]`, report head SHA. Stop after the push.
