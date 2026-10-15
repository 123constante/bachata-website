# Brief: R1a FINISH (Website, branch claude/dancer-app-r1a) — continuation of the integration worker

The integration worker (brief `briefs/dancer-rebuild-r1a-integration.md`, same branch; READ IT for context and
boundaries) did steps 1-5 and 7 and stopped at its context limit WITHOUT a handover. Branch head 9b6fcee1.
Its commits: 70cde48 (W2b+W2e merged, test:e2e union), de31b90 (one useMyDancerEdit, CityProvider, base reds),
c9cb300 (lazy level-rating children on /event; dancer-app budget rows raised), bf87602 (deterministic sandbox
sign-in; tap targets), 9b6fcee (docs/review-pack/r1a: 42 shots, measurements.md, MOCKED RPCs; avatar fallback).

## What is LEFT (do only this)
1. Step 6 of the integration brief: run EVERY CI job step from `.github/workflows/*.yml` on head 9b6fcee (plus
   `npm run build`), and table each: job, command, exit code, counts. What the previous worker saw (re-run, do not
   trust): `npm run test:unit` offline = 5 failed / 7898 passed, the reds being live-DB contract tests
   (`Invalid API key` in the sandbox: eventViewCompat, occurrenceProgram, publicEventPageLineup) and
   `integrityCouldNotRun`; it showed the same files fail on main in the sandbox. PROVE each remaining red is
   identical on `origin/main` (same command, same count) or fix it. `npm run lint` failed only because
   `bin/*.sh` lost its exec bit in the sandbox (passes after chmod +x; git mode is 100644 on main too): say so.
   The dancer-app e2e specs (every spec in the test:e2e list) must be run and green.
2. Perf: quote the event-route first-load bytes on main vs r1a (same command) to prove the c9cb300 decision
   (owner rule: dancer-app rows raised ONLY if the event route grows <= 0.5 KB gz).
3. Write `docs/handover/dancer-rebuild-r1a.md`: each integration step done (with its commit), every conflict
   resolution from the W2b/W2e merge, the per-job table, the perf numbers, Verified / Not verified, open owner
   questions (no Terms/Privacy pages exist: consent line is text-only and the options row is disabled with reason).
4. Final commit subject ends `[worker-done <ticket>]`; push; stop.

## Boundaries
Only this branch; no PR, no merge, no approve; plain git (never `gh api`); shell commands without variables,
loops or `$(...)` where a plain command works; Supabase read-only; GitHub Actions billing refusals are not code
failures. Context: at 25% start nothing new; by 30% push + handover with subject ending `PARTIAL [worker-done <ticket>]`.
