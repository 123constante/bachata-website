# Handover: GUARD-CI, P3 walk specs must not silently skip in CI

Ticket `dt_8be2c6f9f5cf`. Brief: `brief/guard-p3-walk-specs:docs/briefs/guard-p3-walk-specs-skip.md`.
Branch `claude/guard-p3-walk-specs`. Hard tier (`scripts/**` + workflows): owner Approve at head.

## Proof (step 1)

On main `ea16d47`, these 7 specs are in `npm run test:e2e`. They all skip in `e2e-smoke.yml`'s
`Run E2E smoke suite` step because that step sets only `VITE_ENABLE_ORGANISER_SELF_SERVE`:

| Spec | Skip mechanism |
|---|---|
| walk-p3-w4b-onboarding | runtime probe `test.skip(!mounted)` (/account/p3 not mounted) |
| walk-p3-w4b2-person | runtime probe `test.skip(!mounted)` |
| walk-p3-w4b2-page | runtime probe `test.skip(!mounted)` |
| walk-p3-golive | runtime probe `test.skip(!mounted)` |
| walk-w3c-1-repeat | env `test.skip(!P3_ON)` |
| p3-gate-sheet | env `test.skip(!P3_ON)` |
| ticket-door-scanner | env `test.skip(!MOUNTED)` (needs P3 + TICKETING) |

The runtime-probe form is worse than the env form. With the flag on, a page that breaks
and stops mounting is still a skip, not a failure.

## Done

- `scripts/check-p3-specs-not-skipped.mjs` (+ `--self-test`, 22 cases, named mutants, drives
  `main()` for 0/1/2), wired as `check:p3-specs-not-skipped[:self-test]` and run in
  `architecture-guard.yml` (canary, then guard). For every `e2e-smoke.yml` step running
  `npm run test:e2e*`, every P3 spec in that script must have each `VITE_ENABLE_ORGANISER_*`
  flag it mentions set to `'true'` in the step's env. Every skip in a P3 spec must also be
  gated by a pure flag conjunct.
- Red on main: exit 1, 12 violations (the guard was copied into a main worktree). Green on the branch: exit 0.
- The 4 probe skips now read `test.skip(!mounted && process.env.VITE_ENABLE_ORGANISER_P3 !== 'true', ...)`.
- The P3 specs moved from `test:e2e` to a new `test:e2e:p3`, run by a new e2e-smoke step with
  P3 + TICKETING on. The flags could NOT simply go on the existing step. Measured: with P3 on, the
  legacy suite failed 17 tests across 9 specs (organiser-onboarding, organiser-home, organiser-loop,
  organiser-layout, dancer-home, account-settings, ...; NOT baselined flags-off in this sandbox, so some may be sandbox noise). P3 takes over `/account/o`: the dancer-home and organiser-home failures show exactly that.

## Left / owner decision

- **`walk-p3-w4b-onboarding.spec.ts` FAILS when it actually runs** (light+dark, most tests).
  The Welcome screen now shows a "Find your page" button before `onboarding-search`, and the spec
  still expects the search box on Welcome. It went stale while CI was skipping it. It was NOT
  quarantined: the e2e-smoke job on this PR is expected red on that spec until someone rewrites
  it for the current flow, in a separate BUILD/test PR.
- Not checked by the guard: P3 specs that are in no gate script (walk-p3-w0, walk-p3-w3b1 are local walks).

## Review round 1 (high; a CI-guard change gets ONE round, so stop here)

Fixed: `pre-ship.mjs smokeEnvFrom` now lifts env from the exact `test:e2e` step only. It used to
pull the P3 flags into the legacy smoke run. The guard now evaluates each flag conjunct with
the flags 'true' and requires it to be false, so `!mounted && P3_ON` is rejected. It also sees
`testInfo.skip`, `test.info().skip` and `it.skip`, and accepts the bracket form
`process.env['X']`. The P3 step uses `!cancelled()`. The step sits next to its own comment.
Docs are updated (testing-doctrine, ci-guard-notes inventory, CLAUDE.md).
Named gaps, not fixed: a skip inside an imported helper and an early `return` on a probe. The
Supabase placeholder env is still copied into both e2e steps instead of hoisted to the job.
Also not fixed: `pre-ship` runs only `test:e2e`, not `test:e2e:p3`.
Not fixed, owner decision: walk-p3-w4b-onboarding is red in the gate (above).
