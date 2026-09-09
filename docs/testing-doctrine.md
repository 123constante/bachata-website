# Testing doctrine

Full detail behind CLAUDE.md's Testing section — the lint-chain mechanics, the
canary/self-test rules, and why each exists.

## Unit / contract tests (Vitest)

```bash
npm run test:unit                   # all unit tests
npx vitest run tests/               # same
```

Contract tests: `tests/eventViewCompat.contract.test.ts`,
`tests/publicEventPageLineup.contract.test.ts`,
`tests/occurrenceProgram.contract.test.ts`.

## E2E (Playwright)

```bash
npm run test:e2e         # curated smoke specs — this is the CI gate (e2e-smoke.yml)
npm run test:e2e:all     # everything under tests/e2e/ — no scheduled caller
```

`test:e2e` is an EXPLICIT spec list, not a glob, so a new spec does not silently
join the PR gate. Admit one only after running it individually under the smoke
environment (placeholder key), then add it to the list by name.

Retired specs live in `tests/e2e-attic/`, which no runner collects — `testDir`
pins `tests/e2e`. See that directory's README for why the nightly was retired
2026-07-31 and what covers the ground now (`e2e-smoke`, `prod-smoke`,
`synthetic-ssr-monitor`).

Dev server must be running at port 8080 for Playwright. Vite dev: `npm run dev`.

## Lint

```bash
npm run lint
```

Runs `node scripts/run-lint-chain.mjs`. **Every link runs; none can hide
another.** It used to be one shell `&&` chain, which stopped at the first red
— and since four links are `:self-test` canaries sitting immediately ahead
of the check they prove, a canary that red for its own reasons reported "this
guard is broken" and the guard never ran to name the actual defect. Four of the
four canaries in the chain have held that defect. The runner removes the cause;
the individual canaries are still worth cleaning up, but they are no longer
load-bearing for whether a check gets to speak.

`scripts/run-lint-chain.mjs`'s `LINKS` array is the chain. Read it, not a list
in prose — nothing keeps prose in step:

```bash
node -e "import('./scripts/run-lint-chain.mjs').then(m=>console.log(m.LINKS.join(' -> ')))"
```

Exit codes follow the same 0 / 1 / 2 convention the guards themselves use:
**0** all green, **1** something reported a violation, **2** nothing violated
but a guard could not run. Exit 2 is reported as 2 rather than collapsed into
"failed", because "the guard is broken" and "your tree is broken" are different
facts. (`pre-ship.mjs`'s `runCheck` still collapses them — queued residual,
not fixed here.)

**The `eslint .` tail is INFORMATIONAL and does not gate.** It runs last, always,
and prints `[WARN]`. Whole-tree eslint reports a few hundred pre-existing errors
— measure the count, never quote one from prose; three copies in this tree
disagreed the moment anyone checked (178 here, 189 in `pre-ship.mjs` "as of
2026-07-30", 174 measured on 2026-08-26). **No workflow runs eslint**:
`architecture-guard.yml` runs `lint:architecture`, a different script. So a red
eslint has never meant "this branch broke something", and it no longer makes the
tier red either. `pre-ship`'s ship-scoped ratchet is what actually gates eslint.
**A non-zero `npm run lint` now means a guard failed or could not run —
never merely that eslint is red.** The tail is also SKIPPED once any link is
red, so a failing guard's remediation line is the last thing on your screen
rather than the first of ~290 eslint problems.

The `:self-test` links are canaries, each sitting immediately ahead of the check
it proves — `tests/lintChain.test.ts` enforces that adjacency mechanically
over `LINKS`. A guard that diffs against an allowlist stays GREEN when its
DETECTORS silently stop matching, so the check alone cannot tell you the rule
still fires; only the canary can.

**Prove independence before pairing.** Inject the violation the check exists to
catch, and require the canary to stay GREEN while the check goes RED. Keep a
canary to injected fixtures and arithmetic; anything it asserts about the live
subject can red on ordinary work. Three of the four still break that rule
— `check:mojibake:self-test` (`.claude/settings.local.json` is collected),
`check:script-conventions:self-test` (R5 over the live source of
`check-ci-budget.mjs`), `check:workflow-artifact-policy:self-test` (A5 fan-out
over the real `.github/workflows`) — and **eight of the chain's twelve
checks have no canary in any tier.** `scripts/pre-ship.mjs` carries both lists
with line numbers and is the maintained copy.

`scripts/pre-ship.mjs` mirrors the chain link for link, but only its `CHECKS`
band comment records where the mirrored prefix ends; `tests/reviewScope.test.ts`
enforces set membership against `LINKS`, so a missing entry fails and a
REORDERED one does not.

If `check:legacy-tables` or `check:legacy-program-rpcs` fails, there is a
reference to a table or RPC that has been retired from the DB. Fix the call
site, not the check.
