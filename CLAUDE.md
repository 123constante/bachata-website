# CLAUDE.md — Website (Bachata Calendar public site)

*Loaded in full every session — budget: stay under 19 KB. New material goes
to `docs/` with a pointer here, per the pattern already used for CI guards
(`docs/ci-guard-notes.md`) and testing doctrine (`docs/testing-doctrine.md`).*

**Public-facing Bachata Calendar** — React + TypeScript + Vite + Supabase +
Vercel. Mobile-first. ~95% of users are on mobile. This repo owns zero
migrations; all schema authority lives in `bachata-admin-11april`.

---

## Architecture

### Event page module

Moved to [`src/modules/event-page/CLAUDE.md`](src/modules/event-page/CLAUDE.md),
which loads when work touches that module. The one-line version: `BentoPage.tsx`
is the real `/event/:id` render, and `sections/` is MOSTLY DEAD -- prove a file
there has an importer before editing it.

### Chunk splitting (Vite)

Manual chunks in `vite.config.ts`: `vendor-react` (carries tslib &mdash; see the
comment there before moving it), `vendor-query`, `vendor-motion`,
`vendor-sentry`, `vendor-supabase`, `vendor-icons`, `vendor-ui`,
`vendor-ui-modal`. Do not break these without reason &mdash; they are tuned for
cache hit rates AND, since 2026-08-14, for first-load REQUEST count.

The two `vendor-ui*` groups are name lists, and which list a package is in is a
MEASURED fact about the app shell's first-load graph, not a judgement &mdash;
put a package in the wrong one and its weight lands on every route. The rule
and the way to re-measure it are in `vite.config.ts`; `perf-budgets.json`
budgets and the puller ratchet are what enforce the result.

---

## Scoped rules (`.claude/rules/` &mdash; load only when matching files are touched)

Still mandatory; they just stay out of sessions that never touch those files.
Read the file directly if you need one before touching a match.

- `design-density.md` (`src/**/*.tsx`, `*.css`): COMPACT layouts &mdash; 3-column
  mobile grids, `p-3`, `text-sm`; never Apple-style whitespace.
- `breadcrumbs.md` (`src/**/*.tsx`): every `<GlobalLayout>` page passes
  `buildBreadcrumbs(routeId, ctx)`; never hand-roll.
- `data-contracts.md` (`src/**`, `app/**`, `scripts/**`): venue reads use
  `COALESCE(co.venue_id, e.venue_id)`; `emitProfileView` on clickable profiles;
  `record_event_view_v1`; day-rollover must mirror admin exactly (CI #8).

---

## Density exclusions — DO NOT modify these files for density changes

The calendar view and its day-detail modal have a bespoke layout that is
EXEMPT from the density rules above. Do NOT apply density changes to:

- src/components/EventCalendar.tsx
- src/components/calendar/CalendarGrid.tsx
- src/components/calendar/CalendarListView.tsx
- src/components/calendar/DayDetailModal.tsx
- src/components/calendar/calendarUtils.ts
- src/hooks/useCalendarEvents.tsx

Note: src/components/ui/dialog.tsx is a shared shadcn primitive. Do not
alter it as part of calendar density work. It may be adjusted for OTHER
dialogs if and only if the change does not affect DayDetailModal.

If a task involves any of these excluded files, ask Ricky before changing
anything in them.

---

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


## File-write safety (mandatory for agents)

Source files over 2 KB go through `scripts/safe-edit.py` (SURGICAL &mdash; the
default for an existing file) or `scripts/safe-write.py` (FULL-BODY &mdash; new
files, whole rewrites, any safe-edit refusal). `.claude/hooks/pre-write-block.sh`
refuses a raw `Edit`/`Write` on them and prints the exact invocation with your
path substituted &mdash; read what it prints; it cannot drift from the script.
Why: the Cowork &rarr; FUSE &rarr; NTFS mount corrupted large writes (null bytes,
silent truncation, stale reads).

- **`.md` is NOT guarded** &mdash; a large doc rewrite is unwatched.
- A hunk whose payload contains the `@@SAFE-EDIT-*@@` marker lines (editing the
  safe-edit docs) collides with the parser &mdash; use full-body.
- A payload with a bare `HUNK` line at column 0 closes the outer heredoc early.
- Recovery: `npm run check:integrity`, `npm run repair:corrupt`. A live foreign
  session lock (`scripts/hooks/session-lock.mjs`) means work in a `git worktree`.
- CRLF is auto-applied to source extensions; `--lf` overrides.

---

## CI workflows

Every workflow with its trigger and checks:
[`docs/ci-guard-notes.md`](docs/ci-guard-notes.md#workflow-inventory). What
matters without opening it:

- `architecture-guard.yml` does **NOT** run eslint.
- **The conflicting-PR trap.** A conflicting PR's `pull_request` workflows never
  queue &mdash; the gates cease to exist rather than fail, while Vercel stays
  green. `pr-mergeable-guard.yml` (push/hourly, deliberately NOT `pull_request`)
  catches it; `npm run check:pr-mergeable`.
- The numbered DB contract checks, the guards whose green is narrower than it
  looks, and **the six rules `check-script-conventions.mjs` enforces &mdash; read
  those before writing a new guard** &mdash; are all in that doc. Never pin a
  check count in prose: `grep -c '^      - name: Run ' .github/workflows/db-contract-check.yml`.
- `check-og-images.mjs` needs a live deploy, so it is not in
  `db-contract-check.yml`; run `npm run check:og`.

---

## Testing

Full doctrine — lint-chain mechanics, canary/self-test rules, exit-code
convention: [`docs/testing-doctrine.md`](docs/testing-doctrine.md).

```bash
npm run test:unit        # all unit tests (Vitest)
npm run test:e2e         # curated smoke specs — the CI gate (e2e-smoke.yml)
npm run lint             # node scripts/run-lint-chain.mjs
```

The facts that survive the doc not being loaded: `test:e2e` is an **explicit
spec list**, not a glob — a new spec joins the gate only when added by name.
`npm run lint`'s chain runs **every link**, none hiding another; **the
trailing `eslint .` is informational and does not gate** — `pre-ship`'s
ship-scoped ratchet is what actually gates eslint. If `check:legacy-tables` or
`check:legacy-program-rpcs` fails, fix the call site, not the check.

---

## Key patterns

### HTML entities over raw Unicode

Cowork→FUSE→Windows pipeline corrupts em-dash, ellipsis, smart quotes via
cp1252 round-trip → visible mojibake on prod. Use `&mdash;`, `&hellip;`,
`&rsquo;` in JSX. Never paste Unicode punctuation directly into source files.

---

## Operating model (pointer -- doctrine lives in the project memory dir)

Classify every request and say the class: TRIVIAL / BUILD-visual /
BUILD-non-visual / MIGRATE / GUARD-CI / PERF / AUDIT / ARC &mdash; pipelines in
`feedback_operating_model.md` (project memory). Non-trivial work runs the
7-step workflow. Decisions reach Ricky as clickable questions at genuine forks
only. Every code-bearing diff gets
`/code-review` BEFORE commit &mdash; Ricky types it when told; findings become
edits, never follow-up commits. SQL/guards &rarr; xhigh; keystone/arc-close/
DB-contract PRs &rarr; ultra.

**State the stopping rule out loud before a review round runs.** User-facing or
data-integrity changes get two rounds; a CI-guard change gets ONE. A finding
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

## Recent changes

Don&rsquo;t keep a changelog here &mdash; it rotted once. Use `git log --oneline -20`;
old entries are archived in [`docs/changelog-archive-2026.md`](docs/changelog-archive-2026.md).
