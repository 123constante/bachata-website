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
scripts/               CI contract check scripts (48 checks in db-contract-check.yml)
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
  `shape:'snapshot_compat'` (delegates to legacy program RPCs, byte-equal
  to `get_event_page_snapshot_v2`)
- `EventPageScreen.tsx` — top-level render
- `bento/` — bento tile components (schedule, people, raffle, vendor, etc.)
- `sections/` — page sections

### QueryClient

Defined in App.tsx. Global defaults: `staleTime: 60_000`, `retry: 1`,
`refetchOnWindowFocus: false`. All query and mutation errors route to Sentry
via `QueryCache` / `MutationCache` `onError`.

### Chunk splitting (Vite)

Manual chunks in `vite.config.ts`:
`vendor-react`, `vendor-query`, `vendor-motion`, `vendor-supabase`, `vendor-ui`.
Do not break these without reason — they are tuned for cache hit rates.

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

This repo does **NOT** own `supabase/migrations/*.sql`. That folder must not
exist. Migration authority lives in `bachata-admin-11april/supabase/migrations/`,
applied via `supabase db push` from there (CLI-only).

**Forbidden in this repo:**
- Adding `*.sql` files under `supabase/migrations/`
- Hand-applying DDL via Supabase SQL editor without the migration in admin first

**What this repo owns:**
- Contract-check scripts (`scripts/check-*.mjs`) — 48 checks in db-contract-check.yml
- `supabase/config.toml` project_id pin

CI check #18 verifies `Website/supabase/migrations/` does not exist. Re-creating
it will fail the workflow.

---

## Migration authority (mandatory)

This repo does **NOT** own `supabase/migrations/*.sql`. Migration authority
lives in the admin repo `bachata-admin-11april/supabase/migrations/`,
applied via `supabase db push` from there (CLI-only, per admin's CLAUDE.md).

Forbidden in this repo:
- Adding `*.sql` files under `supabase/migrations/` (folder should not exist).
- Hand-applying DDL via Supabase SQL editor without committing the migration
  to admin's repo first.

What this repo owns instead:
- Contract-check scripts (`scripts/check-*.mjs`,
  `.github/workflows/db-contract-check.yml`) — these validate the live DB
  matches our expectations. New contracts go here.
- The `supabase/config.toml` `project_id` pin (so other tooling knows which
  project to point at).

If you find yourself wanting to write DDL in this repo: stop, switch to the
admin working tree, author the migration there, push, then return here.

History: rule introduced May 2026 after collapsing 139 Website-origin
migrations into admin (97 ported, 42 dispositioned). Admin commit b0c8c4f5;
rollback tags `pre-migration-collapse-website` / `pre-migration-collapse-admin`.


## File-write safety (mandatory for agents)

This repo lives on a Windows mount via Cowork → FUSE → virtio-fs → NTFS.
Three corruption modes for writes >~2 KB: null-byte injection, silent
truncation, mount eventual-consistency (fresh read sees stale content).

**A `PreToolUse` hook refuses raw `Edit`/`Write` calls on source files when
the target or content exceeds 2 KB.** It prints the exact `safe-write.py`
invocation to use:

```bash
WRITER=$(mktemp /tmp/edit-XXXXXX.tsx)
cat > "$WRITER" << 'EOF'
...full file contents...
EOF
cat "$WRITER" | python3 scripts/safe-write.py src/components/foo/Bar.tsx
```

`safe-write.py` v2 stages to `/tmp`, verifies sha256 via subprocess after
`sync`, retries on mismatch, restores backup on failure.

**Other guardrails:**
- `PostToolUse` hook — parse-checks files >2 KB after any Edit/Write
- `.githooks/pre-commit` — integrity check on staged files
- `npm run check:integrity` — full tree scan (`bin/check-integrity.sh`)
- `npm run repair:corrupt` — auto-restore corrupted files from HEAD
- `bin/session-lock.sh acquire/release` — advisory lock for multi-file refactors

CRLF auto-applied to source extensions. Override with `--lf` if needed.

---

## CI workflows

| Workflow | Trigger | Checks |
|----------|---------|--------|
| `db-contract-check.yml` | push/PR/daily 06:00 UTC | 48 DB contract checks (venue, coords, program, security, FK, occurrence integrity, series horizon, map, etc.) |
| `architecture-guard.yml` | push/PR | Source integrity + architecture lint + eslint |
| `e2e-smoke.yml` | push/PR | Playwright smoke suite |
| `e2e-nightly.yml` | daily | Full Playwright suite |
| `workflow-lint.yml` | push/PR | Workflow file validation |

**Key DB contract checks** (all in `scripts/check-*.mjs`, enforced by CI):
- Venue / venue coords contract (#1, #16)
- Per-occurrence RPC suite (#2)
- Event-program duration contract (#3)
- Session-people display_name override (#4)
- Guest-entries contract (#5)
- Program editor schema (#6)
- Program save idempotency (#7)
- Day-rollover consistency (#8)
- Admin_list_occurrences null-venue tolerance (#9)
- Canvas consistency (#10)
- Security-hardening policy (#11)
- FK-index contract (#12)
- event_attendees FK target (#13)
- epp.display_name drift (#14)
- epp.avatar_url drift (#15)
- Teacher/DJ assignment integrity (#17)
- Migration authority arc-closeout (#18)
- Per-date program canonical / ADR-007 (#19)
- Occurrence instance_time canonical / ADR-007 (#20)
- Occurrence program format (#21)
- Per-date program sync mutation / ADR-007 (#22)
- Latest-events ordering contract (#23)
- Tracking RPC param-contract (#24)
- Tracking freshness heartbeat (#25)
- search_public_v5 contract (#26)
- Cancelled-occurrence passthrough (#27)
- Occurrence instance_END canonical (#28)
- Program-day / day_id integrity (#29)
- Occurrence integrity aggregator (#30)
- Live series occurrence-horizon guardrail (#31)
- P5 orphan-series guard (#32)
- Festival Map RPC contract (#33)
- Organiser-link contract / P5 organiser_ids vs event_entities (#34)
- Search telemetry param-contract (#35)
- Festival multi-day span / program-day-canonical (#40)
- Organiser past-events inclusion (#41)
- Occurrence time-stamping convention guardrail (#42)
- P5 occurrence materialised canonical (#43)
- Per-occurrence override identity sync (#44)
- Reverse-orphan occurrence guard (#45)
- Venue publish-state visibility gate / venue_is_public consistency (#46)

`check-og-images.mjs` validates OG image shape/size/format against the deployed site; run manually via `npm run check:og`. Not in `db-contract-check.yml` (wrong trigger context &mdash; needs a live deploy, not a DB connection).

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
npm run test:e2e         # curated smoke specs
npm run test:e2e:all     # full suite
```

Dev server must be running at port 8080 for Playwright. Vite dev: `npm run dev`.

### Lint

```bash
npm run lint
```

Chains: `check:integrity` → `check:legacy-tables` →
`check:legacy-program-rpcs` → `lint:architecture` → `eslint`.

If `check:legacy-tables` or `check:legacy-program-rpcs` fails, there is a
reference to a table or RPC that has been retired from the DB. Fix the call
site, not the check.

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

## Recent changes

- **2026-06-27 (latest)** Venue directory fix + durable visibility gate.
  `published` venues were hidden from `/venues` (stale `= 'dancer_ready'`
  literal in `get_public_venues_list_v3`). Added the canonical
  `venue_is_public(publish_state)` predicate (non-draft) and adopted it across
  the directory, detail (`get_public_venue_by_venues_id`, `get_venue_detail`),
  and search venue-section read paths; sitemap now gates on `!= draft`. New
  anon CI guard `scripts/check-venue-publish-gate.mjs` /
  `check_venue_publish_gate_contract_v1()` (#46). Admin migration
  `20260627120000_venue_is_public_predicate_and_gate_v1`.
- **2026-05-16** — Vendor team public display fixes (avatar, roles,
  broken link). About page stacked reveal layout (Approach D).
- **2026-05-14** — Raffle UI: Unicode mojibake fixed, tile layout fixes.
  Bento section titles moved outside cards.
- **2026-05-13** — Venue detail page redesign (Pulse venue). 6 bug fixes
  (breadcrumb z-order, heart/share, YouTube thumbnails, mojibake, recurring
  events). Vendor detail redesign.
- **2026-05-13** — db-contract-check.yml: migration-authority arc-closeout
  check added (check #18). `Website/supabase/migrations/` decommissioned.
- **2026-05-13** — epp.avatar_url drift contract check added (#15).
- **2026-05-13** — `event_view_p5` snapshot_compat shape: 3 callers of
  `get_event_page_snapshot_v2` migrated. Contract test extended (9/9 pass).
- **2026-05-07** — Phase C: occurrence-aware public schedule. `ScheduleBlock`
  uses `get_occurrence_program_v1` when `occurrenceId` in URL.
- **2026-04-30** — Source-integrity guardrail kit v3 (safe-write.py v2,
  PreToolUse hook, sha256 subprocess verify, session-lock advisory lock).
