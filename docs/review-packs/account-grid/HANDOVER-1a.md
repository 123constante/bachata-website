# Handover: account-grid slice 1a (the check)

Branch `claude/account-grid-1a`, from `origin/main` (070c320). No PR opened (orchestrator integrates 1a + 1b).

## Done (files)
- `scripts/check-journey-grid.mjs` (new): JOURNEY-GRID rules 1-5. Flags: `--self-test`, `--write-baseline`,
  `--skip-if-absent`, `--root <dir>`. Env `JOURNEY_GRID_REQUIRED=1` forces a hard fail on a missing grid.
- `scripts/journey-grid-baseline.json` (new, `[]`).
- `scripts/__tests__/check-journey-grid.test.mjs` (node:test; vitest globs do not cover `scripts/`) and
  `scripts/__tests__/fixtures/journey-grid/full/` (a full-coverage mini repo; the self-test copies it and mutates it).
- `package.json`: `check:journey-grid` (with `--skip-if-absent`) and `check:journey-grid:self-test`.
- `scripts/run-lint-chain.mjs`: two links (self-test canary, then the check).

## Decisions / interface notes
- Kinds accepted: J R E U OTP **W** (brief adds W). W ref = a path to a file or folder, optional `#anchor` / `:line`; it
  counts as a walk. E = `tests/e2e/<ref>.spec.ts` that exists AND is listed in `package.json test:e2e`. U ref may carry `#anchor`.
- `state`: must start with an `S-` id from the ACCOUNT-MODEL.md state table (`S-ADMIN-*` prefix matches any defined id), or
  `any`. On the plan-branch grid, rows such as `signed in as a different e-mail` do not start with either, so 1b must reword them.
- Template R titles: expanded from `for (const [a, b] of [[...], ...])` immediately before the `test(\`...\`)`. Loops over a named
  array (`for (const r of ROUTES)`) are NOT expanded; cite those through a J row or a literal title.
- Exemption: a row with `built` other than `BUILT` (NOT BUILT, PLANNED) that is uncovered does not fail. It MAY sit in the baseline;
  a baseline id that IS covered, unknown, or listed twice fails.
- Dangling refs always fail (never baselinable). Exit: 0 pass / 1 violation / 2 unreadable/unparseable file.

## Skip -> hard requirement (integration step)
Until `docs/account-system/journey-grid.json` exists (it lands in 1b) the lint link prints `SKIP: ... nothing was checked` and exits 0.
Integration: (1) after applying 1b run `node scripts/check-journey-grid.mjs --write-baseline` once and review the diff;
(2) delete `--skip-if-absent` from the `check:journey-grid` line in `package.json` (or set `JOURNEY_GRID_REQUIRED=1` in CI).
From then a missing grid exits 1.

## Red-first proof (rolled-back mutants, each makes `--self-test` red; file removed after)
| Mutant | Cases that went red |
|---|---|
| dangling refs not reported | dangling J ref, dangling R ref (+ more) |
| baseline-now-covered check off | baseline id now covered fails |
| new-uncovered check off | uncovered row not in baseline; required row without walk |
| missing grid returns 0 | missing grid file fails; main() with no grid returns 1 |
| rule 5 off | journey with no grid row fails |
| walk not required | required row with a test but no walk fails |
| template titles not expanded | full-coverage fixture passes; main() on full fixture |

## Per-job table (sandbox)
| Job / command | Exit | Result |
|---|---|---|
| `node scripts/check-journey-grid.mjs --self-test` (23 cases) | 0 | all ok |
| `node --test scripts/__tests__/check-journey-grid.test.mjs` | 0 | 6 pass |
| `npm run check:journey-grid` (real tree, no grid) | 0 | loud SKIP |
| `npm run check:script-conventions` + `:self-test` | 0 | R1-R6 clean for the new guard |
| `npx vitest run tests/lintChain.test.ts` | 0 | 27 pass |
| `npm run check:mojibake` | 0 | clean |
| `bin/check-integrity.sh` | n/a | "Permission denied" in sandbox (not run) |
| full `npm run lint`, `npm run build`, e2e | not run | no `src/` change; no production change |

## Verified / Not verified
Verified: every rule in both directions on fixtures; script-conventions R1-R6; lint-chain unit test.
Not verified: the check against the REAL grid (not on `main`; 1b owns it); `architecture-guard.yml` step; full lint chain;
`check:integrity` (permission denied here). No prod data used.

## Left
- Integration: add `npm run check:journey-grid` (and `:self-test`) to `architecture-guard.yml` (PLAN says so; the file is outside 1a's ownership).
- Integration: `--write-baseline`, drop `--skip-if-absent`, as above. Run the check once against 1b's real grid; fix any resolver
  mismatch (e.g. W ref format) in 1a's script.
