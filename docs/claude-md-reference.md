# Reference moved out of CLAUDE.md (2026-11-02)

Moved verbatim to keep the always-loaded CLAUDE.md small. Still mandatory.

## Migration authority (mandatory)

This repo does **NOT** own `supabase/migrations/*.sql` &mdash; that folder must
not exist. Migration authority lives in the admin repo
`bachata-admin-11april/supabase/migrations/`, applied via `supabase db push`
from there (CLI-only, per admin's CLAUDE.md).

**Forbidden in this repo:**
- Adding `*.sql` files under `supabase/migrations/`
- Hand-applying DDL via the Supabase SQL editor without committing the
  migration to admin's repo first

**What this repo owns instead:**
- Contract-check scripts (`scripts/check-*.mjs`), run from
  `db-contract-check.yml` &mdash; these validate that the live DB matches our
  expectations. New contracts go here. Never pin their count in prose (it has
  drifted before); count them:
  `grep -c '^      - name: Run ' .github/workflows/db-contract-check.yml`
- The `supabase/config.toml` `project_id` pin (so other tooling knows which
  project to point at)

If you find yourself wanting to write DDL in this repo: stop, switch to the
admin working tree, author the migration there, push, then return here.

Enforced by `scripts/check-migration-stamps.mjs` (the migration-authority
arc-closeout step in `db-contract-check.yml`, prose-numbered #18): it fails if
`supabase/migrations/` exists. Re-creating that folder will red the workflow.
History (the May 2026 collapse, rollback tags):
[`docs/ci-guard-notes.md`](docs/ci-guard-notes.md#migration-authority-history).

## Key patterns

### HTML entities over raw Unicode

Cowork→FUSE→Windows pipeline corrupts em-dash, ellipsis, smart quotes via
cp1252 round-trip → visible mojibake on prod. Use `&mdash;`, `&hellip;`,
`&rsquo;` in JSX. Never paste Unicode punctuation directly into source files.

## Operating model (pointer -- doctrine lives in the project memory dir)

Classify every request and say the class: TRIVIAL / BUILD-visual /
BUILD-non-visual / MIGRATE / GUARD-CI / PERF / AUDIT / ARC &mdash; pipelines in
`feedback_operating_model.md` (project memory). Non-trivial work runs the
7-step workflow. Decisions reach Ricky as clickable questions at genuine forks
only. Every code-bearing diff gets
`/code-review` BEFORE commit &mdash; Ricky types it when told; findings become
edits, never follow-up commits. SQL/guards &rarr; xhigh; keystone/arc-close/
DB-contract PRs &rarr; ultra.

**State the stopping rule out loud before a review round runs.** ONE round, risky
classes only (migrations, RPC/ACL, money, approval automation, screens with saves,
uploads, routing or cache; owner click 2026-11-12, was two for user-facing). A finding
proved by MUTATION (the gate stays green against the mutant it exists to catch)
means revert now and queue the defect &mdash; no further round. Fixes to findings
are unreviewed code.

Arc plans carry the per-PR model/effort table (`feedback_model_effort_matrix.md`);
phase starts write `.claude/arc-state.json` and state the phase's required
/model + effort in one line (a mismatch is declared and recorded, never a
halt). Ship gate: `npm run pre-ship` + the
pre-push receipt gate (`scripts/ship-gate.mjs`). Session economy: delegate bulk
reads, read only what you edit, and SAY when to start a fresh session.

PR volume and Vercel deploy budget (one PR per unit of work, push once, batch merges): [`docs/pr-batching-policy.md`](docs/pr-batching-policy.md).
