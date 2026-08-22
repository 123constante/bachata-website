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

This repo does **NOT** own `supabase/migrations/*.sql`. That folder must not
exist. Migration authority lives in `bachata-admin-11april/supabase/migrations/`,
applied via `supabase db push` from there (CLI-only).

**Forbidden in this repo:**
- Adding `*.sql` files under `supabase/migrations/`
- Hand-applying DDL via Supabase SQL editor without the migration in admin first

**What this repo owns:**
- Contract-check scripts (`scripts/check-*.mjs`), run from db-contract-check.yml.
  No count is pinned here, for the same reason none is pinned on the guard-script
  count above: a number copied into prose has no writer maintaining it. This one
  had drifted twice over — it read "66" while the workflow held 72 check steps
  and its own comments had reached #67. Count them when you need the figure:
  `grep -c '^      - name: Run ' .github/workflows/db-contract-check.yml`
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
the target or content exceeds 2 KB.** It prints the exact invocation to use.
There are TWO write paths and the hook prints the right one for the case:

**SURGICAL (`safe-edit.py`) &mdash; the default for a file that already
exists.** Transports only the changed hunk, so a 15 KB component costs a
20-line patch rather than two 15 KB round-trips:

```bash
PATCH=$(mktemp /tmp/hunk-XXXXXX.txt)
cat > "$PATCH" <<'HUNK'
@@SAFE-EDIT-OLD@@
...the exact existing text, unique in the file...
@@SAFE-EDIT-NEW@@
...its replacement...
@@SAFE-EDIT-END@@
HUNK
PYTHONUTF8=1 python3 scripts/safe-edit.py src/components/foo/Bar.tsx < "$PATCH"
```

Marker lines and the closing `HUNK` must sit at column 0. Every success prints
a result sha256: chain the next edit on the same file with
`--expect-base-sha <that sha>` so a concurrent clobber fails loudly instead of
silently reverting your earlier edit. Exit 4 = zero or duplicate match,
6 = base-sha mismatch; both mean fall back to full-body.

Two gotchas, both learned the hard way: a hunk whose own payload contains
these marker lines (i.e. editing THIS section) collides with the parser &mdash;
use full-body for it. And a payload containing a bare `HUNK` line at column 0
closes the outer heredoc early and leaks the rest into your shell.

**FULL-BODY (`safe-write.py`) &mdash; new files, whole-file rewrites, and any
`safe-edit.py` refusal:**

```bash
WRITER=$(mktemp /tmp/edit-XXXXXX.tsx)
cat > "$WRITER" << 'EOF'
...full file contents...
EOF
cat "$WRITER" | PYTHONUTF8=1 python3 scripts/safe-write.py src/components/foo/Bar.tsx
```

`safe-write.py` v2 stages to `/tmp`, verifies sha256 via subprocess after
`sync`, retries on mismatch, restores backup on failure. It is the ONE write
path &mdash; `safe-edit.py` writes through it, so both paths get the same
mount defences; the surgical path is a transport optimisation, never a
replacement.

**Other guardrails:**
- `PostToolUse` hook — parse-checks files >2 KB after any Edit/Write
- `.githooks/pre-commit` — integrity check on staged files
- `npm run check:integrity` — full tree scan (`bin/check-integrity.sh`)
- `npm run repair:corrupt` — auto-restore corrupted files from HEAD
- `scripts/hooks/session-lock.mjs` — advisory session lock (hooks: SessionStart
  acquire, per-turn heartbeat, SessionEnd release; 90-min staleness backstop; a live
  foreign lock warns with the other session's branch — work in a `git worktree` then).
  `bin/session-lock.sh` is a thin CLI wrapper for manual use

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
- Live image references (#65) &mdash; HEAD-checks every image URL reachable from a
  public surface via `list_public_image_refs_v1` (admin `20260729120956`). Added
  after a cover override pointed at an R2 object that was never uploaded and an
  event page served a 404 image for ~14 hours. Scoped to live/slugged/published
  records on purpose: a dead image on an archived row breaks no page and must not
  red-light CI. It shipped labelled #47, which is the Public-RPC latency budget;
  renumbered 2026-08-10. Unlike every other check it makes outbound CDN requests,
  so it runs LAST and is double-bounded &mdash; 10s per request, 120s per sweep &mdash;
  because the job is `timeout-minutes: 5` and undici would otherwise wait 300s on
  a stalled edge, killing every check behind it with no named failure.
- Occurrence delete / booking safety (#66)
- Program-day offset canonical (#67)
- Override-mirror ghost rows (#68) &mdash; `calendar_occurrences` rows still
  carrying `is_override = true` after the P5 override row emptied, with no
  override content anywhere. Hit in prod 2026-08-19. Calls
  `check_override_mirror_ghost_v1()` (admin `20260704140000`). **The symptom is
  in the ADMIN editor, not on a public page here** &mdash; an OVR/deviation
  badge that never clears; `is_override` appears in this repo only in the
  generated types. It is guarded from here because the admin migration wires it
  here. ZERO rows measured is exit **2**, not a pass &mdash; on 2026-08-21 prod
  carried 357 rows with `is_override = true` and **zero** ghosts among them, so
  a total of 0 means the read broke; that figure is a dated reading and nothing
  gates on it. A readable `ghost_count` is judged BEFORE the payload fields it
  does not depend on, so a shape drift elsewhere cannot downgrade a real
  violation to an infrastructure 2. Retires WITH the legacy mirror at Lever 1E
  &mdash; delete the step then, never relax the floor.

- OG bake-pipeline health (#69) &mdash; reads the BAKE half of
  `check_og_render_health_v1()`, which was installed and called by **no CI** until
  2026-08-22. It deliberately does **not** gate on `stuck`: measured that day,
  healthy prod reads `stuck = 1` and the 2026-08-21 incident read `stuck = 1`,
  the same permanent `card-data-unavailable` row. `_og_sweep` restamps
  `updated_at` on every POST it issues, so a row under retry is never 15 minutes
  stale and `stuck` **could not have counted the outage**. What it gates on is
  P1's error vocabulary (`bake POST failed: HTTP <code>`), `stuck - error` as a
  self-cancelling lower bound on stale PENDING rows, and a zero-`ready` ledger.
  Both directions proven against prod in rolled-back transactions; those
  payloads are the canary's fixtures. The SCRAPE half is a separate check
  (`check-og-scrape-evidence.mjs`) on purpose.
  **The transport rule does NOT clear itself, deliberately.** `_og_sweep` selects
  `attempts < 5`, and `_og_enqueue` resets `attempts` only on its
  `INSERT..ON CONFLICT` branch &mdash; reached when the row is new or the COVER
  HASH changed, never on an unrelated write. So a parked row means that entity
  will never have a baked OG image until a cover change or a deliberate repair,
  and the violation text carries the repair SQL. That is not `stuck`'s defect
  wearing a new hat: `stuck` reads 1 on a HEALTHY system, this reads 0.
  Named blind spot: `sample_errors` is `LIMIT 5 ORDER BY updated_at DESC` with no
  per-row timestamp, so five newer content errors can push parked transport
  errors out of the sample. Closing it needs a counter the RPC does not expose.

`check-og-images.mjs` validates OG image shape/size/format against the deployed site; run manually via `npm run check:og`. Not in `db-contract-check.yml` (wrong trigger context &mdash; needs a live deploy, not a DB connection).

**Read its arms before trusting a green.** The `pull_request` arm probes the
Vercel PREVIEW through `VERCEL_AUTOMATION_BYPASS_SECRET`, which exempts the
request from the WAF as well as from Deployment Protection &mdash; so it is
structurally incapable of failing on an edge-control regression, and on
2026-08-21 every run in the 14-hour outage was a green preview run. Since P5 the
guard REPORTS this per run (measured host, bypass sent or not, bot protection
exercised or not) to stdout and the run summary, on green runs as loudly as red.
The target class is decided by INCLUSION against the known production host, so a
staging alias or an unparseable base reads as UNRECOGNISED and never claims to
have exercised production edge controls.
Production is covered by the daily schedule **and**, since P5, by a
`deployment_status` arm gated to `state == success && environment == Production`
&mdash; ~24h detection latency down to minutes. Its honest limit: that event and
the production alias move are not transactionally ordered, so the arm can still
measure the previous deployment. It buys latency, not commit attribution.

`check-sitemap-fetchable.mjs` (`npm run check:sitemap-fetchable`) gates
`sitemap-submit.yml` ahead of its GSC submit. That workflow was green throughout
the incident because `sitemaps.submit` only REGISTERS a feedpath &mdash; Google
answers "noted" and fetches later, so no outcome of that call could ever go red
on an unfetchable sitemap. The guard GETs the URL with a **non-browser** UA (a
browser UA was 200 all through the outage) and asserts 200 + XML + a sitemap
root element + a floor of 50 `<loc>` entries (prod: 314, of which 26 are static
routes that render with no database at all). The floor applies to a flat
`<urlset>` ONLY &mdash; a `<sitemapindex>` lists child sitemaps and needs just
one, or the gate would false-red the day the generator is split. Gate and submit
now derive their URL from one workflow-level `SITEMAP_TARGET`, and the script
REFUSES (exit 2) if `GSC_CHECK_BASE` disagrees with what it probed: proving one
URL and announcing another is the same wrong-surface class this arc removes.
The workflow carries its own failure-notification step &mdash; without it this
would have been a brand-new unattended prod probe with no audience, and
`lint-workflow-notification.mjs` could not have caught that, because its
predicate is scoped to schedule-reachable jobs and this one is push-triggered.
**That blind spot in the P2 lint is real and queued, not fixed here.**
It cannot prove Googlebot specifically is allowed &mdash; Vercel verifies that by
reverse DNS and spoofing the UA would be less accurate, not more.
`/robots.txt` 429'd in the same incident and still has no guard.

### Writing a new guard &mdash; the six rules `check-script-conventions.mjs` enforces

`npm run check:script-conventions` runs **two** scans. R1&ndash;R5 cover the
`scripts/check-*.mjs` and `lint-*.mjs` files &mdash; all of them but one, since
`NOT_A_GUARD` exempts the scanner itself (it would flag its own rule patterns as
violations). That exemption is from the SCAN, not from the rules: the scanner is
held to R1&ndash;R5 by hand-written canary cases instead.

No count is pinned here on purpose. This sentence read "89 of the 90" until #240
added a 91st guard, and nothing went red &mdash; a number copied into prose has no
writer maintaining it. Count them when you need the figure:
`ls scripts/ | grep -E '^(check|lint)-.*\.mjs$' | wc -l`.

**R6 has its own, wider corpus**: every `.mjs` under `scripts/` and `bin/`,
recursively, and `NOT_A_GUARD` does not apply to it. That is deliberate &mdash; the
two worst instances of the defect it catches were `ship-gate.mjs` and
`scripts/hooks/review-stamp.mjs`, one a subdirectory away and the other not
matching the name pattern, and a rule blind to those two would have been
decoration. So a new file under `scripts/hooks/` is held to R6 even though
R1&ndash;R5 never look at it. It exists because the worst failure a CI suite has is a check that
reports green without having checked anything: a red check gets fixed, a falsely
green one is trusted for months.

| Rule | A guard fails it when |
|------|-----------------------|
| R1 silent-skip | a green exit is reachable from a missing secret, a walled URL, an undeployed RPC or an empty sample, with no escalation env and no `assertMeasured()` floor |
| R2 swallowed-error | it has an empty `catch`, or a `.catch(() => default)` &mdash; an unreadable file then scans clean |
| R3 exit-drift | it breaks 0 pass / 1 contract violated / 2 infrastructure. Missing creds are **2** |
| R4 no-canary | it carries no `--self-test` proving it can fail |
| R5 unproven-exit | its canary proves the RULES but never drives the function whose return value becomes `process.exitCode` &mdash; so the rules are measured and the CODES are merely asserted. It proves VALUE-ownership only; an exit statement inside a function body is invisible to it (the named gap, below) |
| R6 raw-entry-point | it compares `import.meta` against `process.argv[1]` by hand. Node realpaths one side and not the other, so through a junction or symlink the script exits 0 having run NOTHING &mdash; canary included. Use `isEntryPoint(import.meta.url)` from `scripts/lib/entry-point.mjs`. `npm run prove:entry-point` is the sweep that proves it, and it runs in `architecture-guard.yml` &mdash; canary first, last step in the job, separately bounded by `timeout-minutes`, no `if:`, no `continue-on-error`. Not literally every PR: that workflow's `pull_request` is filtered to `branches: [main, master]`, so a PR between two topic branches does not queue it. It was in NO caller at all from #235 until 2026-08-20, which is how an unlisted dispatcher kept it at exit 2 (&ldquo;cannot run&rdquo;) for days with nothing going red; `tests/entryPoint.test.ts` now asserts that step is present and gating, out of parsed YAML |

**It is a ratchet, not a gate you can satisfy by editing the allowlist.** Today's
violations are frozen in `scripts/script-conventions-allowlist.json`; the guard
fails on a new violation, on a count increase, and deliberately on a **stale**
entry, so the list can only shrink. Re-baseline with
`node scripts/check-script-conventions.mjs --write` **after** fixing something,
never to make a new script pass. An allowlisted script is still lying to you.

**The reference implementation is `check-ci-budget.mjs`.** It was the only
script satisfying R5 when the rule landed (`check-script-conventions.mjs` was
changed in the same commit to satisfy it too); its `main(argv, deps)` seam plus
the "THE EXIT-CODE CONTRACT ITSELF" block in its canary are the shape to copy: the
collaborators are injected so the canary can drive `main()` with no token, no
network and no filesystem (the entry-point dispatch itself stays undriven &mdash;
R5 proves the exit OWNER is driven, not the line that invokes it, which is
exactly the gap R6 and `scripts/prove-entry-point-dispatch.mjs` now close), and each case pins WHICH branch produced its code.
That last part is not decoration &mdash; four branches there return 2, so a case
asserting only "it returned 2" passes for the wrong reason.

**What R5 cannot see.** It is static: it proves the canary CALLS the exit owner,
not that it asserts anything useful about the answer. Branch-pinning is still
yours to do. And note the deliberate interaction with R4 &mdash; a script with no
canary is R4 debt only, so **fixing R4 by adding a rules-only canary turns that
script into an R5 violation**. That is the rule asking for the other half of the
job, not a bug.

**THE NAMED GAP &mdash; R5 proves value-ownership, not reachability.** It asks
who PRODUCED the value that lands in `process.exitCode` and whether the canary
calls them. It never asks whether the assigning statement RUNS, and the two come
apart the moment that statement sits inside a function body: the owner list then
holds only the inner value-producer, so a canary driving that alone passes.
Measured 2026-08-19, canary present in every row &mdash;
`process.exitCode = await main(argv)` at module scope names `main` and FIRES if
the canary skips it, while `main(){ process.exitCode = verdict() }`, the same
inside a class method, the same inside a module-scope IIFE, and
`main(){ process.exit(verdict()) }` all resolve to `[verdict]` and pass. **So
the rule asks MORE of the more testable shape** &mdash; that is an inversion, not
just a blind spot, and it is how `check-override-mirror-ghost.mjs` passed R5 with
its exit code disconnected from its own verdict.

It is documented rather than fixed, with evidence: three attempts to widen
ownership to the enclosing function were built and reverted on 2026-08-19
(`plans/queued-r5-exit-owner-widening-attempt3-reverted.md`). Each walked the
syntax tree outward from the exit site; each went blind to a wrapper it could not
name while over-firing on a callee it could. **A syntactic ancestor is not a
drivability proof.** A fix that would work is dynamic rather than static &mdash;
a canary case that SPAWNS the script and asserts the real process-level exit code
&mdash; and that is a different rule, queued for its own decision. Until it
lands, read an R5 pass as "the value-producer is driven", never as "the exit
contract is proven". The gap is pinned by a canary case named
`R5 GAP (documented, NOT desired)`; if that case ever starts firing, rewrite this
section in the same commit.

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

Chains: `check:integrity` → `check:mojibake` → `check:legacy-tables` →
`check:legacy-program-rpcs` → `check:no-social-word` → `lint:architecture` →
`check:route-boundaries` → `check:image-widths` → `check:rpc-typing` →
`check:script-conventions` → `check:wallclock-brand` →
`check:workflow-artifact-policy` → `eslint .`.

If `check:legacy-tables` or `check:legacy-program-rpcs` fails, there is a
reference to a table or RPC that has been retired from the DB. Fix the call
site, not the check.

**`npm run lint` exits non-zero on a clean tree, and that is expected.** The
final `eslint .` reports ~178 pre-existing errors. **No workflow runs eslint** —
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
