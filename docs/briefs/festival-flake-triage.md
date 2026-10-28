# Brief: triage the festivalClientState flake (Website, normal lane, Opus builder)

Branch `claude/festival-flake-triage` from current `main`. Context cap 30%: push early. Tests-only plus at most a test-harness change; NO product code unless the test proves a real product race (then stop and report, do not fix product code).

## The failure (owner rule: fix the class, add the check)
`tests/client/festivalClientState.test.tsx` > "client: a festival-to-festival navigation, through the REAL route" > "shows no frame carrying the previous festival day" (line ~735) fails intermittently in the CI job `unit (Europe/London, full)` with `AssertionError: expected +0 to be 2` (openDay after `user.click(dayTabs(container)[2])`). Seen FOUR times on 2026-10-28: twice on PR 1107, once on 1098, once on main 6bf9275. It passes when the file is run alone (laptop, 8/8), and passes on a re-run of the failed job. Last green runs were 06:44-07:10Z, first fail 07:33Z, so a change landed between (main commits around 06:44-07:33Z: c17277b W-T fix 3 is the suspect list; read `git log` for tests/client, app/routes/festival.tsx and the harness).

## Do
1. Reproduce: run the file under load the way CI does (`npx vitest run` of the whole unit set is ~7 min; try the file plus its neighbours with `--pool`/threads like `package.json` test:unit, and with CPU contention). Use the side laptop (`node ~/.claude/bin/remote-test.mjs website <sha> -- <cmd>`) not this sandbox's limits, if reachable; otherwise run in your sandbox.
2. Find the cause. Hypotheses to test, not assume: (a) `userEvent` pointer sequence uses real timers while only `Date` is faked, and the click lands before the lazy route/day tabs have committed; (b) a lazy chunk or `import()` in the route resolves late under load so `openDay` reads 0; (c) a recent main change altered render timing of the festival route or of the shared harness.
3. Fix the TEST (not the production code): wait on the observable (`await waitFor`/`findBy`) instead of reading state right after the click, keep the test's purpose (it must still fail if `key={params.id}` is deleted from `app/routes/festival.tsx`: mutate that and show the test goes red, per the file's own comment). Check the other cases in this file for the same pattern.
4. Prove: run the file 20 times in a loop under load on the branch (report n and failures); the mutation still red.

## Stopping rule
One independent review (different model), one fix round. A finding proved by mutation = revert and queue.

Standing header lines:
- Prove the data source first: tests-only, no DB; state that.
- Zero bytes to the /app first load: do not touch `perf-budgets.json` or `vite.config.ts`.
- Append-only in shared files; do not touch another session's branches or P3 files.
Run every CI job step that applies, per-job table in the PR body with `## Verified on real data` (use the exact literal `- Shapes surveyed:` / `- Checks run:` / `- NOT verified:` lines; Shapes surveyed may say "none: tests only") and `## Phone QA` (sizes: none, tests only). Final commit subject ends `[worker-done dt_<ticket>]`.
