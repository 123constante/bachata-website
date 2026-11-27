# Website rules - detail (on demand)
Full wording of every Website rule moved out of the slim CLAUDE.md, verbatim. Sections match the `detail#` pointers. Install as docs/website-rules-detail.md.

## architecture
### Event page module

Moved to [`src/modules/event-page/CLAUDE.md`](../src/modules/event-page/CLAUDE.md),
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

### Scoped rules (`.claude/rules/` &mdash; load only when matching files are touched)

Still mandatory; they just stay out of sessions that never touch those files.
Read the file directly if you need one before touching a match.

- `design-density.md` (`src/**/*.tsx`, `*.css`): COMPACT layouts &mdash; 3-column
  mobile grids, `p-3`, `text-sm`; never Apple-style whitespace.
- `breadcrumbs.md` (`src/**/*.tsx`): every `<GlobalLayout>` page passes
  `buildBreadcrumbs(routeId, ctx)`; never hand-roll.
- `data-contracts.md` (`src/**`, `app/**`, `scripts/**`): venue reads use
  `COALESCE(co.venue_id, e.venue_id)`; `emitProfileView` on clickable profiles;
  `record_event_view_v1`; day-rollover must mirror admin exactly (CI #8).

## density-exclusions
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

## migration-authority
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
[`docs/ci-guard-notes.md`](ci-guard-notes.md#migration-authority-history).

## file-write-safety
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

## ci-workflows
Every workflow with its trigger and checks:
[`docs/ci-guard-notes.md`](ci-guard-notes.md#workflow-inventory). What
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

## testing
Full doctrine — lint-chain mechanics, canary/self-test rules, exit-code
convention: [`docs/testing-doctrine.md`](testing-doctrine.md).

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

## definition-of-done
Nobody calls a change "ready", asks for approval or merge, or asks Ricky to
test it until it is verified against the real SHAPES of production data
&mdash; not only fixtures or freshly created records. (2026-10-08: an
organiser rebuild was declared ready on mocked data; Ricky found four bugs on a
phone within minutes &mdash; an ended recurring event shown as Draft, "One
date" on a series with 13 weekly dates, copy pointing at a button that did not
exist, a sticky bar eating half the screen. All were real data shapes.)

1. **Shape survey.** Read-only SELECT (Supabase MCP, prod project
   `stsdtacfauprzrdebmzg`) of the distinct shapes the screens will meet:
   lifecycle/status x format x counts x null/empty x past/cancelled x lists
   over the 100-row API cap. Counts only, no personal data, never any write.
2. **Consistency matrix.** Table-driven vitest for every screen x every shape.
   One shared mapping for any fact shown on more than one screen (never two
   copies, e.g. status tags). No copy that points at a control that is not on
   screen. Every empty state says what the person can do. A control that
   cannot work is disabled with a reason. Saving an untouched record sends no
   command. For bug fixes, run the new tests against the unfixed code first.
3. **Every step of every CI job that applies to the PR** is run locally (read
   `.github/workflows`; e.g. the `integrity` job includes `check:images` with
   `AUDIT_STRICT=1`), and PR checks are green before "ready".
4. **Browser walk** at 390x844 with prod-shaped data.
5. **"Verified on real data" block** in the PR body (template has it) and in the
   hand-off message, including an honest "Not verified".

Ricky's phone test is final confirmation, never the first real-data test. A bug
Ricky finds that this list would have caught is a process failure: fix the
class, add the check, add the lesson here.

Trap: the public site sets `html` font-size to about 13.5px on phones, so
rem-based Tailwind sizes render about 16% small. Use explicit px sizes for tap
targets (see `docs/organiser-rebuild/ARC.md` if present).

## html-entities
### HTML entities over raw Unicode

Cowork→FUSE→Windows pipeline corrupts em-dash, ellipsis, smart quotes via
cp1252 round-trip → visible mojibake on prod. Use `&mdash;`, `&hellip;`,
`&rsquo;` in JSX. Never paste Unicode punctuation directly into source files.

## operating-model
Classify every request and say the class: TRIVIAL / BUILD-visual /
BUILD-non-visual / MIGRATE / GUARD-CI / PERF / AUDIT / ARC &mdash; pipelines in
`feedback_operating_model.md` (project memory). Non-trivial work runs the
7-step workflow. Decisions reach Ricky as clickable questions at genuine forks
only. Risky classes only (SQL, guards, DB-contract) get
`/code-review` BEFORE commit &mdash; ONE round; findings become
edits, never follow-up commits. Everything else relies on `npm run pre-ship` +
CI. No ultra tier (owner click 2026-11-14; earlier: two rounds for user-facing,
ultra for keystone PRs).

**State the stopping rule out loud before a review round runs.** One round. A finding
proved by MUTATION (the gate stays green against the mutant it exists to catch)
means revert now and queue the defect &mdash; no further round. Fixes to findings
are unreviewed code.

Arc plans carry the per-PR model/effort table (`feedback_model_effort_matrix.md`);
phase starts write `.claude/arc-state.json` and state the phase's required
/model + effort in one line (a mismatch is declared and recorded, never a
halt). Ship gate: `npm run pre-ship` + the
pre-push receipt gate (`scripts/ship-gate.mjs`). Session economy: delegate bulk
reads, read only what you edit, and SAY when to start a fresh session.

PR volume and Vercel deploy budget (one PR per unit of work, push once, batch merges): [`docs/pr-batching-policy.md`](pr-batching-policy.md).

## recent-changes
Don&rsquo;t keep a changelog here &mdash; it rotted once. Use `git log --oneline -20`;
old entries are archived in [`docs/changelog-archive-2026.md`](changelog-archive-2026.md).

## dell-prod-walk
Trigger: merged PR with a visible UI difference, Vercel green. Dell (offload@192.168.1.245, headless, Playwright chromium) loads production at 390x844 with a copied cookie-only storage state (owner signs in once on the PC browser; expires, repeat when the walk lands on the sign-in page). Steps: tap every button on the changed screens and compare destinations to the PR tap table; compare the screen to the live keep-list; screenshot each changed screen and compare to the approved mockup. Result recorded in the LIVE file. Fail: roll back at once, one line to the owner. Dell unreachable: retry once, report, never claim checked. Status 2026-11-24: rule written, walk script NOT built yet.
