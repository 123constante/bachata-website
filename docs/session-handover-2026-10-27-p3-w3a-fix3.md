# Session handover: P3 W3a fix round 3 (FINAL) on PR #1082 (2026-10-27, ticket dt_961964d663a9)

Brief: `brief/p3-w3a-fix3:docs/briefs/p3-w3a-fix3.md`. Review: `claude/review-1082-r3:docs/reviews/1082-r3.md`.
Base: 70b1c75 (main a5d4bb4 merged in; main had not moved at the start of this round).

## Done (each fix red-first on 70b1c75: 13 of 25 new tests red, all green after)
1. r3 #1 bundle-budget: `EditTray` no longer imports `areas/shared/useAreaLeaveBlocker`; it carries the same getBlocker hook
   (`useRouterBlocker`, key made once with useState so no setState in an effect). perf-budget.yml env, exact gzip bytes of the 49
   /app first-load files, pin 382,976 B: main a5d4bb4 382,954 B (22 under); 70b1c75 382,993 B (17 over); this head 382,964 B
   (**12 B under**). Chunk 49/49, puller 4/4, first-load requests and chunk cycles ok. `perf-budgets.json`, `vite.chunks.ts` untouched.
   Pins ruled out: `leaveGuard` is on /app's first load (DancerAppShell), so pinning the hook with it adds bytes there.
2. r3 #2: `landed(version, keys)` folds a landed step's fields into the base (`detailsLandedKeys`; Prices folds all);
   `attemptFor` treats the not-yet-landed remainder of the held attempt as the same attempt (Try again keeps key + version).
3. r3 #3: banner copy only ("...saving them will be refused. To go on, copy anything you typed, then Start again...").
4. r3 #4: `'chat'` LinkKind in `shared/linkRules.ts` with the owner arm's host rule (`!~*`, read SELECT-only today).
5. r3 #5: one `useEditLock` (event lock, then profile lock) used by Details and Prices.
6. r3 #7 / #8: Instagram compared as sent; music compared in canonical order.
7. Docs: `docs/design/1082.md` (rows r1 #8 / r2 #2 superseded note, "Review round 3" table, Known limits queue for r3 #9, #10,
   length caps, `eventModel.ts` not export-only); fix2 handover appended with the real numbers.
8. Walk 390x844 light + dark for the 3 changed states (PNGs 18-20, 6 metrics rows `round: r3`).

## Checks run locally (this head)
- `npx vitest run src/modules/organiser` 6636 passed (London default, America/New_York, Australia/Sydney).
- Full `test:unit` (inside `npm run pre-ship`): 17585 passed, 17 failed in 5 files the PR does not touch: 4 live-DB contract files
  ("Invalid API key": no real anon key in this container; CI has the secret) and `tests/integrityCouldNotRun.test.ts`
  (5 failures, identical on main a5d4bb4: container PATH).
- pre-ship's lint links, build, bundle-budget, first-load requests, chunk cycles: ok. pre-ship itself was stopped at its typecheck
  step by my 590 s time limit; the remaining steps were run by hand: typecheck 99 errors vs ratchet baseline 106 (none in files
  this round touched); eslint on the PR's changed files 0 errors; `test:e2e` (CI env) 157 passed, 2 failed
  (organiser-home load failure, organiser-onboarding sign-in @390), both passed on re-run 17/17: load flakes, specs not touched.
- `check:dancer-area-isolation` OK.

## Not done / not verified
- Ricky's phone test. Live CI result on the final head (reported in the PR body after the push).
- Queued, no code: r3 #9 (venue city vs entity city: admin RPC), r3 #10 (live allowlist contract check), the old length caps,
  r3 #11 / #12 nits.
- No /code-review pass this round (no person in the loop to type it; the orchestrator's diff-only check is the stated next step).

## Next steps
Orchestrator: CI on the final head + the narrow diff-only check of r3 #1 and #2 (stopping rule: any further defect proved by a
failing test gets reverted and queued).
