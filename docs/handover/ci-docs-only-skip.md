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

## Fix pass (review of 9c2fd6f)

| Finding | Change |
|---|---|
| F1 | `.claude` is docs only for `.claude/rules/**` and any `.claude/**/*.md`. `.claude/hooks/**`, `.claude/settings*.json` and other `.claude` files are code (docs_only=false). |
| F2 | `Mojibake rules (canary)` and `Mojibake guard` no longer carry the docs-only `if:` (node builtins + `git grep`, no `npm ci`), so docs PRs are still scanned for mojibake. `Ensure PyYAML` and `Run integrity guard` stay SKIPPED: the guard's TS parse phase needs `node_modules/typescript` (so `npm ci`) and `bin/*.sh` chmod, and without them it exits 2 (could-not-run). Consequence: null-byte/truncated `.md` is NOT scanned on docs-only PRs. Follow-up: make the guard's `.md` phase runnable without `npm ci`. |
| F3 | `MD_EXCLUDED` now also `api/ supabase/ bin/ .githooks/ components/ e2e/ .vercel/ server/ node_modules/` (the automerge FORBIDDEN trees); one self-test row and one mutant each. |
| F4 | `git fetch --depth=2` only when `EVENT_NAME` is `pull_request` (or unset); other events print `docs_only=false` without touching git. |

Red-first: the new CASES run against the OLD classifier gave 13 FAILURES (`.claude` settings/hook/settings.local/other json, and md in api, supabase, bin, .githooks, components, e2e, .vercel, server, node_modules); exit 1. Against the fixed classifier: 42 cases, 20 mutants, ok.

| Step | Command | Exit |
|---|---|---|
| self-test | `node scripts/ci/docs-only.mjs --self-test` | 0 |
| entry point | `npx vitest run tests/entryPoint.test.ts` | 0 (10/10) |
| conventions | `npm run check:script-conventions` | 0 |
| YAML | PyYAML parse of all workflows in `.github/workflows` | ok |
| push event | `EVENT_NAME=push node scripts/ci/docs-only.mjs --merge deadbeef` | prints docs_only=false |

Not verified: no live Actions run of PR 867 was seen; full unit suite and e2e not run.
