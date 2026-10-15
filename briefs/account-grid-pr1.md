# Brief: Account system PR-1 (Website): the journey grid becomes a CI gate. Two slices, one brief

Repo `123constante/bachata-website`. Read FIRST on branch `arc/briefs-dancer-rebuild`: `briefs/dancer-rebuild-COMMON.md`
(hard limits, CI without billing, definition of done, handover, 30% context rule). Then from branch
`claude/account-system-plan` (read with `git show origin/claude/account-system-plan:<path>`): `docs/account-system/PLAN.md`
(section "PR-1"), `docs/account-system/JOURNEY-GRID.md` (section "The proposed CI check", rules 1-5),
`docs/account-system/journey-grid.json`, `docs/account-system/build_grid.py`, `docs/account-system/GAPS.md` (G-A2).
On `main`: `docs/ci-guard-notes.md` (six rules), `docs/review-packs/public-journeys/MATRIX.md`, `scripts/run-lint-chain.mjs`.
Plain git only, never `gh api`. Commands without variables, loops or `$(...)` where a plain command works. Check a
PRODUCTION build (`npm run build`), not only the dev server.

## State (important)
PR #764 is MERGED on `main` (593971cf). It already added the 13 J rows and the account-edge build specs that PLAN.md
lists for slice 1b, plus D1 (sign-out clears person-scoped storage). So 1b is now mostly: bring the grid onto `main`,
point every row's `covered_by` at what really exists on `main`, add what is still missing. Read `git log --oneline -15
origin/main` and the merged MATRIX.md before assuming any row is missing.

Your dispatch prompt names your SLICE: 1a or 1b. Do only your slice; never touch the other slice's files.

## Owner decisions (binding)
- A grid row with no test AND no walk fails CI (ratchet: a baseline file lists today's known gaps by id; the check fails
  on any NEW uncovered row and on any baseline id that is now covered, so the baseline only shrinks).
- Deletion rows are renamed (deletion = hide + 30-day restore, never auto-erase): `ac.delete.hide`, `ac.delete.restore-30`,
  `ac.delete.after-30`, `ac.delete.refused-sole-owner`, `ac.delete.admin-erase`; they replace `ac.erase` and
  `ac.erase.re-signup`. They are `built: PLANNED` (built in PR-3) and sit in the baseline.
- No production change. No change under `src/` except a test-id if a spec truly needs one (say why).

## Pinned interface 1a <-> 1b
`docs/account-system/journey-grid.json`, schema `version: 1` exactly as on `claude/account-system-plan`: rows with
`id, matrix, entry, state, action, end, transition, covered_by[{kind,ref}], people, coverage, decision, built`.
`kind` values: `J` = a journey id in `tests/journeys/publicEntryJourneys.ts`; `R` = a FULL test title in a spec (template
titles like `${shape}: ...` are expanded by 1a from the spec's `for` table); `W` = a walk entry (path to a WALK.md line or
screenshot folder). 1a READS this file; 1b OWNS it. 1a develops against fixtures, not the real file.

## Slice 1a: the check (branch `claude/account-grid-1a`, from `origin/main`)
Owns ONLY: `scripts/check-journey-grid.mjs` (new), `scripts/journey-grid-baseline.json` (new, start EMPTY `[]`; the
integration step fills it), `scripts/__tests__/check-journey-grid.test.mjs` (new) with fixtures under
`scripts/__tests__/fixtures/journey-grid/`, one link in `scripts/run-lint-chain.mjs`, the `check:journey-grid` line in
`package.json`. Build JOURNEY-GRID rules 1-5. Self-test: dangling-ref fixture exits 1, full-coverage fixture exits 0,
uncovered-not-in-baseline exits 1, baseline-id-now-covered exits 1, missing grid file exits 1 with a clear message (not 0).
Prove each failing case with a rolled-back mutant (break the rule, see the test go red, restore). If
`docs/account-system/journey-grid.json` is absent on your branch, the lint-chain link must SKIP with a printed reason
(it lands in 1b), never pass silently: say how the integration step turns that skip into a hard requirement.

## Slice 1b: grid + rows (branch `claude/account-grid-1b`, from `origin/main`)
Owns ONLY: `docs/account-system/**` (copy from `claude/account-system-plan`, then edit), `tests/journeys/**`,
`tests/e2e-build/**` (incl. `fakes/*`), `docs/review-packs/account-grid/**`.
1. Copy `docs/account-system/` from `claude/account-system-plan` onto your branch. Apply the deletion rename above
   (json, JOURNEY-GRID.md, build_grid.py if it generates ids). Regenerate with `python3 docs/account-system/build_grid.py`
   if that is how the md is made.
2. For every row, set `covered_by` to what really exists on `main` now (J ids, full R titles, W walks from
   `docs/review-packs/public-journeys/`). Do not invent refs: every ref must resolve.
3. Add what PLAN.md asks that #764 did not: axe (`@axe-core/playwright`, add to devDependencies) on every J row's END in
   the build specs, zero serious/critical violations (fix nothing in `src/`; a real violation is listed in the handover with
   the element, and its row stays covered but marked in `docs/review-packs/account-grid/AXE.md`). Any still-missing row a
   real account can hit: add the J row/spec. Rows that cannot be covered until a later PR: list them in
   `docs/review-packs/account-grid/BASELINE-PROPOSAL.md` (id + which PR covers it).
4. Run the phone suite and build specs at 390x844 for every row you touch.

## Gates (both slices)
Every CI job step from `.github/workflows` your sandbox can run, per-job table (command, exit code, one line). Billing
annotations are not code failures. Red-first for every new check/test. Prod READ-ONLY (Supabase MCP SELECT/counts) and only
if a row needs a shape count.

## End (both slices)
Handover `docs/review-packs/account-grid/HANDOVER-<slice>.md` (done, red-first outputs, per-job table, Verified / Not
verified, "## Left"). Do NOT open a PR (the orchestrator integrates 1a + 1b into `claude/account-grid` next). Final commit
subject ends `[worker-done <ticket>]`, push YOUR slice branch only, stop. Context: at 25% start nothing new; by 30% push
with `PARTIAL [worker-done <ticket>]` and a precise "Left" list.
