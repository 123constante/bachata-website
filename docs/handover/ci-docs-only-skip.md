# Handover: docs-only CI skip (dt_b89702de7a8d)

## Done
- `scripts/ci/docs-only.mjs`: classifier (`isDocsOnly`), `--self-test` (27 cases + one mutant per rule, 11 mutants, each must turn the table red).
  Modes: stdin paths, `--merge <sha>` (diff `sha^1..sha`, the PR merge commit), `--base/--head`. Non-`pull_request` `EVENT_NAME` or any error => `docs_only=false`.
- Six workflows, each REQUIRED job: after checkout a `Detect docs-only PR` step (`id: changes`); every later step gets `if: steps.changes.outputs.docs_only != 'true'` (combined with existing `if`s). Job names, matrix, concurrency, permissions, timeouts unchanged.
  `architecture-guard.yml` (integrity), `perf-budget.yml` (bundle-budget only), `e2e-smoke.yml`, `typecheck.yml` (wallclock-brand), `workflow-lint.yml` (bom-check, masking-check), `unit-tests.yml` (unit, all 3 matrix legs).
- Self-test wired ungated into `masking-check` (always-running required job).
- `tests/entryPoint.test.ts`: its "gating step" extractor rejected ANY `if:`; it now accepts exactly the docs-only `if:` (and a fixture row proves the inverse condition is still rejected).

## Rules
docs-only = every path under `docs/`, `.claude/`, `plans/`, or `*.md` (any case) NOT under `src/ public/ .github/ scripts/ tests/ app/`. Empty list, `..`, absolute or quoted paths => false. Renames list both paths (`--no-renames`).

## Risks / for the orchestrator
- A guard that reads `docs/**` or `.claude/**` content (integrity, pointer checks) is skipped on a docs-only PR; they still run on `push` to main. If that hides a failure class, revert the PR.
- Not provable inside this PR (it edits workflows, so it is not docs-only). First proof: next docs-only PR shows 7 required checks green fast; one code PR still runs in full.
- Not-required jobs (lighthouse, doc-weight, notification-check, dancer-area-isolation, preview jobs) deliberately untouched.
- Pre-existing, unrelated: 5 tests in `tests/integrityCouldNotRun.test.ts` fail in the cloud sandbox on clean main too.
