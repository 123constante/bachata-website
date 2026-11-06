# Brief: local-entry-point-proof-website (WEBSITE, queue rank 30, AUTOMATION). Run the entry-point proof's TARGETS-coverage check locally (pre-ship / pre-push), so a new `scripts/**/*.mjs` that dispatches via `isEntryPoint(import.meta.url)` but is missing from TARGETS fails before push. Branch claude/local-entry-point-proof. Repo Website.

Brief-version: 2
Lane: careful
Model: Sonnet
Tier: HARD-TIER (`scripts/**` ship-gate code). Needs the OWNER's Approve at head later; you never approve, never merge, never self-certify.

Context line: stay under 30% of your context; at 25% start nothing new; push + handover by 30%. Never merge/approve/--no-verify. Plain git only (never `gh api`). Supabase is READ-ONLY (nothing here touches it). PUSH ONCE, at a part boundary where everything is coherent and its tests ran (Vercel cap). NO migration. One branch off main, never stacked. Files over 2 KB go through `scripts/safe-edit.py` / `safe-write.py` (see CLAUDE.md).

Why: #1402 added `route-runner.mjs` with `isEntryPoint` but not in TARGETS; only CI (`architecture-guard.yml`) caught it, after a paid push.

## What main lacks
(Verified by the orchestrator with `git grep` on origin/main 3e8a74b0a, 2026-11-06.)
- pre-ship / ship-gate / .husky never run the entry-point proof (it runs only in architecture-guard.yml lines 249-250) -- grep: coverage-only
- `assertTargetsCover(root)` (line 631) is not exported, so the cheap TARGETS-coverage check cannot be called without the full spawning probe run -- grep: export function assertTargetsCover

## Files
scripts/prove-entry-point-dispatch.mjs (ONLY: export `assertTargetsCover`, optionally add a `--coverage-only` flag that runs just it, offline, no spawns; behaviour of the default run byte-identical)
scripts/pre-ship.mjs (add one step calling the coverage check; red names each missing file and says "add it to TARGETS in scripts/prove-entry-point-dispatch.mjs")
scripts/ship-gate.mjs (ONLY if pre-push (`.githooks/pre-push` step 2) does not already run that pre-ship step; prefer one place)
package.json (ONLY a `prove:entry-point:coverage` script if you add the flag)
tests/ or scripts/__tests__ unit test for the coverage check (fake tree: listed file = green, unlisted dispatching file = red, file that only imports the helper = green)
docs/handover/local-entry-point-proof.md

## Rules
- Local check must be fast (no child processes, under 1 s) and offline. A filesystem read error = "cannot run" (the script's exit-2 convention), never a silent green.
- Do not change TARGETS entries or the CI steps; CI stays the backstop. Follow `check-script-conventions.mjs` rules (see `docs/ci-guard-notes.md`).

## Acceptance checks
1. Mutation: on a scratch branch add `scripts/zz-probe.mjs` containing `isEntryPoint(import.meta.url)`; `npm run pre-ship` goes red naming it; remove it and pre-ship is green. Record both outputs in the handover.
2. `npm run prove:entry-point:self-test` and `npm run prove:entry-point` still pass unchanged.
3. The new unit test is red on unmodified main (export missing) and green after.
4. Every step of `architecture-guard.yml`'s affected job, `npm run lint`, `npm run test:unit` run locally; per-job table in the PR body. Handover with an honest Not verified.
