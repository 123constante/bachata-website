# S5 door screens: make PR #1056 mergeable (handover)

Ticket: dt_015728bf7eec. Brief: `docs/briefs/s5-door-rebase.md` on `brief/s5-door-screens`.
Branch: `claude/s5-door-screens` (PR #1056). Parked, do not merge (needs admin #1018).

## Done

- The brief asked for a rebase plus `--force-with-lease`. The force-push was denied by the auto-mode classifier, so the branch was made mergeable by merging `origin/main` into it instead. This is a plain fast-forward push with no history rewrite.
- One conflict: `src/components/AnimatedRoutes.tsx`. Both sides only added a route. Kept both:
  - main: `/admin/organisers/front-door` (AdminFrontDoor)
  - door: `/run-events` (OrganiserDoor)
  - Lazy imports auto-merged, no duplicates.
- No changes to `supabase/migrations/`, `.github/workflows`, calendar density-excluded files, or unrelated files.
- The merged tree is byte-identical to the rebased result the checks were run on.

## Checks (local, on the merged tree)

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: 21 of 22 links green. `check:integrity` exit 126 because `bin/check-integrity.sh` is mode 100644 on main (not from this branch). Run with bash it passes: `integrity-guard: ok (2663 files checked, 0 issues)`. Not changed here. Fix on main: `git update-index --chmod=+x bin/check-integrity.sh`. The `eslint` link was skipped by the chain because of the failing link above.
- `npm run test:unit -- --maxWorkers=3`: 615 files passed, 15 tests failed:
  - 5 `tests/integrityCouldNotRun.test.ts`: known sandbox failures from the brief.
  - 8 contract tests (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`): "Invalid API key" against the live Supabase project. Environmental, no sandbox key.
  - 2 plan-hygiene `/tmp` fixture runs: `unknown flag --norender`. Not door code.

## Left / next steps

- Owner/CI: confirm PR #1056 shows MERGEABLE on the pushed head, and that its `pull_request` checks queue.
- Owner: fix the `bin/check-integrity.sh` exec bit on main so `npm run lint` is fully green.
- Not verified: browser walk at 390x844, prod-shaped data survey, live contract tests, Vercel preview, review stamp (`/code-review` not run).
