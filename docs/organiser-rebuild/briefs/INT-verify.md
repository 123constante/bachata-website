# Brief INT-verify -- integration CI verification of R1 slices S1+S2+S3(fixed)+S4

Repo `123constante/bachata-website`. Zero-context worker. You are the integrator-verifier. Work and push ONLY `claude/org-r1-integrate` (create from `feat/organiser-r1` if it exists on origin, else from `main`; first run `git branch -r` and read `docs/organiser-rebuild/briefs/README.md` on `origin/arc/briefs-organiser-r1` to see which is the R1 base).

## Task
1. Merge, in this order, with plain `git merge` (never a PR merge): `origin/claude/org-r1-home` (S1), `origin/claude/org-r1-change` (S2), `origin/claude/org-r1-addcancel` (S3, fix pass head 07d73ca), `origin/claude/org-r1-new` (S4, head 62745427). Expected conflicts ONLY in `shell/OrganiserRoutes.tsx` and `shell/__tests__/routes.test.tsx`: resolve by keeping EVERY real route from every slice (no duplicates); search for stray conflict markers afterwards (`git grep -n "<<<<<<<"`). Do not edit anything else except what a conflict forces.
2. Run EVERY step of every CI job that applies (read `.github/workflows`): typecheck (compare the error count with the base branch; new errors are findings), `npm run test:unit` (full), `npm run lint`, `npm run build` (PRODUCTION build), `check:mojibake`, `lint:architecture`, perf budget, and anything else the workflows run. Record command + exit code + counts in a table.
3. Cross-slice checks: every route in S1's Home links (homeJobs rows, C34/C35) resolves to a real route after the merge; S2/S3 Done wiring is identical, not duplicated; nothing imports the deleted `NewEventPage`/`newEvent`. Add NO new feature code; if a cross-slice defect needs code, list it with file:line and the one-sentence fix instead.
4. Known open item to confirm or refute: Home `no_dates_left` row for a festival leads to a C8 with every day disabled.
5. If E2E needs credentials you lack, mark NOT verified; do not fake it.

## Handover
Write `docs/organiser-rebuild/handovers/INTEGRATE.md`: merge result, the CI table, cross-slice findings, Verified / Not verified (what a sandbox cannot run: real browser, e2e creds, live storage).

## Rules
Plain git only (never `gh api`). Shell commands without variables, loops or `$(...)`. Never `--no-verify`. ONE push (Vercel cap): claude/* branches no longer deploy only once PR #806 merges, so push once at the end. Stay under 30% context; at 25% start nothing new; by 30% push + handover with last commit subject ending `PARTIAL [worker-done <ticket>]`. Final commit subject ends `[worker-done <ticket>]`.
