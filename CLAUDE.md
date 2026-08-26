# CLAUDE.md — Website (Bachata Calendar public site)

**Public-facing Bachata Calendar** — React + TypeScript + Vite + Supabase +
Vercel. Mobile-first. ~95% of users are on mobile. This repo owns zero
migrations; all schema authority lives in `bachata-admin-11april`.

---

## Repository structure

```
src/
  App.tsx              Root router (lazy imports with chunk-reload retry)
  pages/               Route-level page components (40+ pages)
  modules/
    event-page/        Event detail page — model, hooks, sections, bento tiles
    profile/           Profile module
    vendor/            Vendor portal
  components/          Shared UI components
    calendar/          EventCalendar, CalendarGrid, DayDetailModal (EXEMPT from density)
    layout/            GlobalLayout, GlobalHeader, BottomNav, PageBreadcrumb
    ui/                shadcn/ui primitives
    organiser/         Organiser-specific components
    venue/             Venue-specific components
  lib/
    breadcrumbs/       buildBreadcrumbs(), siteIa.ts, JSON-LD
    featureFlags.ts    VITE_ENABLE_* flags → ComingSoonGate
    supabase.ts        Supabase client
    analytics.ts       Event view tracking, search telemetry
    sentry.ts          Sentry error capture
    programDayRollover.ts  Day-rollover logic (must mirror admin lib)
  hooks/               useAuth, useEvents, useCalendarEvents, useAttendance, etc.
  contexts/            CityContext
scripts/               CI contract check scripts (see db-contract-check.yml)
tests/                 Vitest unit tests + Playwright e2e specs
bin/                   Integrity and session-lock tools
.github/workflows/     CI: db-contract-check.yml, architecture-guard.yml, integrity.yml
```

---

## Architecture

### Routing

All pages are lazy-loaded via `lazyWithRetry()` (defined in App.tsx), which
wraps `React.lazy()` with a single-reload recovery for stale chunk 404s after
Vercel deploys. Only `Index` is eager.

Routes gated by feature flags render `<ComingSoonGate>` + `<ListingRequestForm>`
when the flag is false (see `lib/featureFlags.ts`).

### Event page module

`src/modules/event-page/` is the full event detail surface:
- `buildEventPageModel.ts` — pure model builder from DB payload
- `useEventPageQuery.ts` — React Query hook; calls `event_view_p5` with
  `shape:'snapshot_compat'` (native P5 build; NOT byte-equal to the retired
  `get_event_page_snapshot_v2` -- admin `20260709070000` made it native and
  `20260709080000` revoked anon EXECUTE on the legacy fn. `starts_at`/`ends_at`
  echo `event_occurrence_p5.materialised_start_utc`, a naive London wall clock
  stamped `+00` -- display as-stored, never Intl-convert)
- `BentoPage.tsx` — the ACTUAL top-level render for `/event/:id`, via
  `EventPage.tsx:90`. Owns the `mx-auto w-full max-w-[430px] px-2` wrapper that
  the `--bento-cell` fallback in `src/index.css` is derived from; that coupling
  is guarded by `tests/bentoCellContract.test.ts`.
- `EventPageScreen.tsx` — UNUSED, zero importers. Do NOT derive layout from it.
  Its wider `max-w-2xl px-3 sm:px-4` shell does not render the bento, and
  trusting this entry cost a shipped regression (a tablet got a 155.5px bento
  cell against a true 99px).
- `bento/` — bento tile components (schedule, people, raffle, vendor, etc.)
- `sections/` — page sections

### QueryClient

Defined in App.tsx. Global defaults: `staleTime: 60_000`, `retry: 1`,
`refetchOnWindowFocus: false`. All query and mutation errors route to Sentry
via `QueryCache` / `MutationCache` `onError`.

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

## Design density (mandatory — do not deviate without explicit request)

This project prefers COMPACT, information-dense layouts.

- Mobile (>=375px): default to **3-column grids** for card lists (venues,
  events, teachers, DJs, dancers, organisers). Never 1-column unless the
  card legitimately needs full width.
- Tablet: 3 columns. Desktop: 4+ columns.
- Card padding: p-3 (not p-4/p-6). Gap between cards: gap-3 (not gap-4/gap-6).
- Card images: 16:9 or 4:3 aspect, not 1:1 squares taking half the screen.
- Typography: text-sm for body, text-base for card titles. Reserve text-lg+
  for page headers only.
- Buttons: py-2 px-3 default. Never py-4 unless it's a primary page CTA.
- Vertical rhythm: prefer space-y-3 over space-y-6.
- Icons: w-4 h-4 inline, w-5 h-5 for prominent. Not w-8+ unless decorative.

When in doubt, make it MORE compact. If a design feels too dense, Ricky will
ask to loosen it — assume compact until told otherwise.

Do NOT produce "Apple-style" generous-whitespace mobile layouts.

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

## Breadcrumbs (mandatory)

Every page that uses `<GlobalLayout>` MUST pass `breadcrumbs={buildBreadcrumbs(routeId, ctx)}`
from `@/lib/breadcrumbs`. Do NOT hand-roll breadcrumb arrays.

```tsx
import { buildBreadcrumbs } from '@/lib/breadcrumbs';

// Listing
<GlobalLayout breadcrumbs={buildBreadcrumbs('parties')}>

// Detail page
<GlobalLayout breadcrumbs={buildBreadcrumbs('dancer.detail', {
  entityName: dancer?.first_name,
  isLoading,
})}>

// Event page
<GlobalLayout breadcrumbs={buildBreadcrumbs('event.detail', {
  entityName: pageModel.identity.title,
  eventType: pageModel.identity.eventType,
  isLoading: state !== 'ready',
})}>
```

Adding a new page:
1. Add a one-line entry to `src/lib/breadcrumbs/siteIa.ts`.
2. Use `buildBreadcrumbs('newRouteId', ctx)` on the page.
3. Breadcrumb unit tests in `src/lib/breadcrumbs/__tests__/` auto-cover it.

Pages with no breadcrumb (Index, Auth, AuthCallback, Onboarding) must pass
`showSubheader={false}`.

---

## Calendar occurrence venue/city contract (mandatory)

`calendar_occurrences.venue_id`, `city_id`, and `city_slug` are NULL by default.
They may be set ONLY when `is_override = true`.

Read paths must use `COALESCE(co.venue_id, e.venue_id)`. All shipped public
RPCs already do this. Any new public read path touching venue MUST use the same
pattern.

Health check: `check_occurrence_venue_contract_v1()` (anon-callable).
CI: `db-contract-check.yml` check #1. Local: `node scripts/check-venue-contract.mjs`.

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
  expectations. New contracts go here. No count is pinned, for the same reason
  none is pinned on the guard-script count: a number copied into prose has no
  writer maintaining it. This one had drifted twice over &mdash; it read "66"
  while the workflow held 72 check steps and its own comments had reached #67.
  Count them when you need the figure:
  `grep -c '^      - name: Run ' .github/workflows/db-contract-check.yml`
- The `supabase/config.toml` `project_id` pin (so other tooling knows which
  project to point at)

If you find yourself wanting to write DDL in this repo: stop, switch to the
admin working tree, author the migration there, push, then return here.

Enforced by `scripts/check-migration-stamps.mjs` (the migration-authority
arc-closeout step in `db-contract-check.yml`, prose-numbered #18): it fails if
`supabase/migrations/` exists. Re-creating that folder will red the workflow.

History: rule introduced May 2026 after collapsing 139 Website-origin
migrations into admin (97 ported, 42 dispositioned). Admin commit b0c8c4f5;
rollback tags `pre-migration-collapse-website` / `pre-migration-collapse-admin`.


## File-write safety (mandatory for agents)

This repo lives on a Windows mount via Cowork &rarr; FUSE &rarr; virtio-fs &rarr;
NTFS. Three corruption modes for writes >~2 KB: null-byte injection, silent
truncation, mount eventual-consistency (a fresh read sees stale content).

**You do not need the recipes here.** `.claude/hooks/pre-write-block.sh` refuses
raw `Edit`/`Write` on a source file when the target or the content exceeds 2 KB,
and prints the exact invocation to run &mdash; both paths, with your file's path
already substituted, the column-0 marker rule, and the full exit-code table.
Read what it prints; it is more complete than any copy kept here, and it cannot
drift from the script. Extensions it guards: `.ts .tsx .jsx .js .cjs .mjs .json
.sql .yml .yaml .sh .py` &mdash; **`.md` is not among them**, so a large doc
rewrite is unguarded and is exactly where the mount bites unwatched.

The two paths, so you recognise them: **`scripts/safe-edit.py`** (SURGICAL &mdash;
the default for a file that already exists; transports only the changed hunk, so
a 15 KB component costs a 20-line patch rather than two 15 KB round-trips) and
**`scripts/safe-write.py`** (FULL-BODY &mdash; new files, whole-file rewrites, and
any `safe-edit.py` refusal). `safe-write.py` is the ONE write path &mdash;
`safe-edit.py` writes through it, so both get the same mount defences; the
surgical path is a transport optimisation, never a replacement.

**Two gotchas the hook does NOT print**, both learned the hard way: a hunk whose
own payload contains the `@@SAFE-EDIT-*@@` marker lines (i.e. editing THIS
section) collides with the parser &mdash; use full-body for it. And a payload
containing a bare `HUNK` line at column 0 closes the outer heredoc early and
leaks the rest into your shell.

**Other guardrails:**
- `PostToolUse` hook (`.claude/hooks/post-write-check.sh`) &mdash; parse-checks
  files >2 KB after any Edit/Write
- `.githooks/pre-commit` &mdash; integrity check on staged files
- `npm run check:integrity` &mdash; full tree scan (`bin/check-integrity.sh`)
- `npm run repair:corrupt` &mdash; auto-restore corrupted files from HEAD
- `scripts/hooks/session-lock.mjs` &mdash; advisory session lock (hooks:
  SessionStart acquire, per-turn heartbeat, SessionEnd release; 90-min staleness
  backstop; a live foreign lock warns with the other session's branch &mdash;
  work in a `git worktree` then). `bin/session-lock.sh` is a thin CLI wrapper
  for manual use

CRLF auto-applied to source extensions. Override with `--lf` if needed.

---

## CI workflows

| Workflow | Trigger | Checks |
|----------|---------|--------|
| `db-contract-check.yml` | push/PR/daily 06:00 UTC | DB contract checks (venue, coords, program, program-day offsets, security, FK, occurrence integrity, series horizon, map, image refs, event covers, etc.) — count them, don't trust a number here: `grep -c '^      - name: Run ' .github/workflows/db-contract-check.yml` |
| `architecture-guard.yml` | push/PR | Source integrity + architecture lint + guardrails (legacy-tables, legacy-program-RPCs, images, image widths, plan-hygiene canary, workflow artifact policy, **entry-point dispatch proof**, mojibake). **Does NOT run eslint** |
| `e2e-smoke.yml` | push/PR | Playwright smoke suite |
| `types-drift.yml` | daily 06:17 UTC + PR | Detects `types.ts` drift vs the live schema (honest detector; goes red) |
| `types-drift-autoheal.yml` | daily 06:47 UTC + dispatch | Heals that drift into ONE rolling `bot/types-regen` PR for review |
| `workflow-lint.yml` | push/PR | Workflow file validation |
| `pr-mergeable-guard.yml` | push to main + hourly + dispatch | Every open PR is `MERGEABLE` and has at least one **Actions** check run that RAN. Deliberately **not** a `pull_request` workflow &mdash; that trigger is what fails to queue on a conflicting PR |
| `ci-budget-guard.yml` | daily + dispatch (+ push on its own files) | What this account's CI **costs**: held Actions artifact pool and minutes, account-wide. Lives here because this repo is public and therefore never metered, so it keeps running when a $0 budget pauses the private repos. Needs the `CI_BUDGET_GITHUB_TOKEN` secret; a missing or expired one is **exit 2, never a green 0-byte report** |

**The conflicting-PR trap.** GitHub cannot compute a merge ref for a conflicting
PR, so it never queues that PR&rsquo;s `pull_request` workflows. The gates do not
fail &mdash; they cease to exist, while Vercel (which deploys off the head commit
through its own App) keeps reporting green. The board then reads as a few
&ldquo;skipping&rdquo; entries plus Vercel passes, which looks fine. It bit #217 on
2026-08-08 and auto-closed #138 in July; the usual cause is squash-merging a PR
whose commits a sibling branch still carries individually. `check-pr-mergeable.mjs`
asserts both halves independently, because a bad `paths:` filter or a disabled
workflow empties the board with mergeability perfectly clean. &ldquo;A gate that
ran&rdquo; is defined by INCLUSION (an Actions check run, not SKIPPED), never by
excluding what we recognise &mdash; the exclusion form counted the guard&rsquo;s own
published status as a gate and would have switched the check off after one sweep.
Fixtures, both live:
`--sha b567c8a2` (#217 pre-rebase, 4 skipped + 2 Vercel) reds the gates half;
`--pr 138` reds the mergeable half. `npm run check:pr-mergeable`.

**Key DB contract checks and the per-guard record: [`docs/ci-guard-notes.md`](docs/ci-guard-notes.md).**
That file holds the numbered check list (#1&ndash;#69), the guards whose green is
narrower than it looks (#65 live image refs, #68 override-mirror ghosts, #69 OG
bake health, `check-og-images.mjs`'s bypassed preview arm, `check-sitemap-fetchable.mjs`),
and **the six rules `check-script-conventions.mjs` enforces &mdash; read that before
writing a new guard.** Do not pin a check count in prose: count them with
`grep -c '^      - name: Run ' .github/workflows/db-contract-check.yml`.

`check-og-images.mjs` is NOT in `db-contract-check.yml` (it needs a live deploy,
not a DB connection); run it manually via `npm run check:og`.

---

## Testing

### Unit / contract tests (Vitest)

```bash
npm run test:unit                   # all unit tests
npx vitest run tests/               # same
```

Contract tests: `tests/eventViewCompat.contract.test.ts`,
`tests/publicEventPageLineup.contract.test.ts`,
`tests/occurrenceProgram.contract.test.ts`.

### E2E (Playwright)

```bash
npm run test:e2e         # curated smoke specs — this is the CI gate (e2e-smoke.yml)
npm run test:e2e:all     # everything under tests/e2e/ — no scheduled caller
```

`test:e2e` is an EXPLICIT spec list, not a glob, so a new spec does not silently
join the PR gate. Admit one only after running it individually under the smoke
environment (placeholder key), then add it to the list by name.

Retired specs live in `tests/e2e-attic/`, which no runner collects — `testDir`
pins `tests/e2e`. See that directory's README for why the nightly was retired
2026-07-31 and what covers the ground now (`e2e-smoke`, `prod-smoke`,
`synthetic-ssr-monitor`).

Dev server must be running at port 8080 for Playwright. Vite dev: `npm run dev`.

### Lint

```bash
npm run lint
```

Chains: `check:integrity` → `check:mojibake:self-test` → `check:mojibake` →
`check:legacy-tables` → `check:legacy-program-rpcs` → `check:no-social-word` →
`lint:architecture` → `check:route-boundaries` → `check:image-widths:self-test` →
`check:image-widths` → `check:rpc-typing` → `check:script-conventions:self-test` →
`check:script-conventions` → `check:wallclock-brand` →
`check:workflow-artifact-policy:self-test` → `check:workflow-artifact-policy` →
`eslint .`. Read the chain itself rather than this list; nothing keeps them in
step:

```bash
node -e "console.log([...String(require('./package.json').scripts.lint).matchAll(/npm run ([\w:-]+)/g)].map(m=>m[1]).join(' -> '))"
```

The `:self-test` links are canaries, each sitting immediately before the check
it proves. A guard that diffs against an allowlist stays GREEN when its
DETECTORS silently stop matching, so the check alone cannot tell you the rule
still fires &mdash; only the canary can.

**A canary only belongs in the chain if it is independent of what the check
judges.** `lint` is an `&&` chain, so a canary that itself reds on an ordinary
violation aborts before the check runs and reports the guard as broken instead
of naming the defect. `check:image-widths` was exactly that: three of its
self-test cases asserted facts about the LIVE tree &mdash; that it is clean, and
twice over that the scan had measured something &mdash; so a real bad width red
the canary and the check never ran. They were deleted &mdash; each duplicated a
contract `checkTree()` already enforces &mdash; and only then was it paired.

**Prove independence before pairing.** Inject the violation the check exists to
catch, and require the canary to stay GREEN while the check goes RED. Keep a
canary to injected fixtures and arithmetic; anything it asserts about the live
subject can red on ordinary work.

**The chain does not yet satisfy that rule, so do not read "paired" as "safe".**
Three of the four paired canaries still assert something about the live subject
while gating their own check: `check:mojibake:self-test`
(`.claude/settings.local.json` is collected), `check:script-conventions:self-test`
(R5 over the live source of `check-ci-budget.mjs`) and
`check:workflow-artifact-policy:self-test` (A5 fan-out over the real
`.github/workflows`). Eight of the chain's twelve checks have no canary in any
tier. `scripts/pre-ship.mjs` carries both lists with line numbers and is the
maintained copy &mdash; count from the chain, not from this paragraph.

`scripts/pre-ship.mjs` mirrors the chain link for link, but only its `CHECKS`
band comment records where the mirrored prefix ends;
`tests/reviewScope.test.ts` enforces set membership only, so a missing entry
fails and a REORDERED one does not.

If `check:legacy-tables` or `check:legacy-program-rpcs` fails, there is a
reference to a table or RPC that has been retired from the DB. Fix the call
site, not the check.

**`npm run lint` exits non-zero on a clean tree, and that is expected.** The
final `eslint .` reports a few hundred pre-existing errors &mdash; measure the
count, never quote one from prose. The three copies in the tree disagreed the
moment anyone checked: this line said 178, `scripts/pre-ship.mjs` says 189 "as
of 2026-07-30", and a run on 2026-08-26 reported 174. **No workflow runs eslint** —
`architecture-guard.yml` runs `lint:architecture`, which is a different script.
So the eslint count is not a CI gate and never has been; every guard ahead of it
in the chain is. Do NOT read a red `npm run lint` as "this branch broke
something" — run the individual guard you care about, or diff the eslint count
against `main` before believing a change caused it.

---

## Feature flags

Feature flags in `src/lib/featureFlags.ts` gate public-facing listing pages
behind `<ComingSoonGate>`. Set to `true` in `.env.development` for local work.
Vercel production env overrides `.env.production`.

| Flag | Controls |
|------|----------|
| `VITE_ENABLE_TEACHERS_DIRECTORY` | `/teachers` listing |
| `VITE_ENABLE_TEACHER_DETAIL` | `/teachers/:id` detail |
| `VITE_ENABLE_ORGANISERS_DIRECTORY` | `/organisers` listing |
| `VITE_ENABLE_ORGANISER_DETAIL` | `/organisers/:id` detail |
| `VITE_ENABLE_VENUE_DETAIL` | `/venues/:id` detail |

---

## Key patterns

### HTML entities over raw Unicode

Cowork→FUSE→Windows pipeline corrupts em-dash, ellipsis, smart quotes via
cp1252 round-trip → visible mojibake on prod. Use `&mdash;`, `&hellip;`,
`&rsquo;` in JSX. Never paste Unicode punctuation directly into source files.

### Profile view telemetry

Use `emitProfileView(profileId, type)` from `lib/profileViewEmit.ts` on
any surface that renders a clickable profile. This is the mandate, not
`PersonChip` (which is one packaging of the same call for schedule densities).

### Event view tracking

`lib/analytics.ts` → `record_event_view_v1` RPC. Session-deduped per UTC day.
Bot-UA filtered, admin sessions skipped.

### Day-rollover logic

`src/lib/programDayRollover.ts` — sessions starting 00:00–08:00 of the day
after event start belong to the prior day. This logic must mirror
`admin/lib/programDayRollover.ts` exactly. A CI check (#8) validates the
fixture parity between repos.

---

## Operating model (pointer — doctrine lives in the project memory dir)

Classify every request and say the class: TRIVIAL / BUILD-visual /
BUILD-non-visual / MIGRATE / GUARD-CI / PERF / AUDIT / ARC — pipelines in
`feedback_operating_model.md` (project memory; read it before classifying).
Non-trivial work runs the 7-step workflow. Every code-bearing working diff gets
`/code-review` BEFORE commit — Ricky types it when told; findings become edits,
never follow-up commits. SQL/guards → xhigh; keystone/arc-close/DB-contract
PRs → ultra.

**Review depth is bounded by blast radius, and the stopping rule is stated OUT
LOUD before the round runs.** User-facing or data-integrity changes get two
rounds. A CI-guard change gets ONE. In either case, a finding the reviewer
proves by MUTATION — a gate that stays green against the mutant it exists to
catch — means revert now, queue the original defect, and do not open another
round. Fixes to findings are unreviewed code, so a second round that finds
defects *inside* the first round's fixes is the signal, not a setback to push
through. Earned 2026-08-11 (og scrape: 7 rounds, 8 drafts, ~86 findings) and
2026-08-14 (teacher/DJ baseline: 2 rounds, 15 then 12 findings, my own
mutation-tested canary proven blind three ways — reverted, nothing shipped).

Arc plans carry the mandatory per-PR model/effort table
(`feedback_model_effort_matrix.md`); phase starts write `.claude/arc-state.json`
and state the phase's required /model + effort in one line (the arc-checkpoint hook injects the pin; a mismatch is declared and recorded, never a halt). Ship gate: `npm run pre-ship`
+ the pre-push receipt gate (`scripts/ship-gate.mjs`). Decisions reach Ricky as
clickable questions at genuine forks only. Session economy (same memory file):
delegate bulk reads to subagents, read only what you edit, edit existing files
with `scripts/safe-edit.py`, and SAY when to start a fresh session — Ricky is
never left to guess.

## Recent changes

This used to be a hand-maintained changelog and it rotted &mdash; its newest
entry was still labelled "(latest)" two months after the fact. Don't keep one
here; git is the real history:

```bash
git log --oneline -20
```

The old entries (through 2026-06-27) are archived in
[`docs/changelog-archive-2026.md`](docs/changelog-archive-2026.md), closed.

For the narrative of in-flight work, decisions and gotchas, see the memory index
at `~/.claude/projects/C--dev-Website/memory/MEMORY.md`, plus the plans under
`~/.claude/plans/` and the docs under `docs/`.
