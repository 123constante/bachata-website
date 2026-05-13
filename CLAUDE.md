## Design density (mandatory — do not deviate without explicit request)

This project prefers COMPACT, information-dense layouts. Default mobile-first
spacing is too generous for our taste. Apply these rules to every UI change:

- Mobile (≥375px): default to 2-column grids for card lists (venues, events,
  teachers, DJs, dancers, organisers). Never 1-column unless the card
  legitimately needs full width (hero, single featured item, detail page).
- Tablet: 3 columns. Desktop: 4+ columns.
- Card padding: p-3 (not p-4/p-6). Gap between cards: gap-3 (not gap-4/gap-6).
- Card images: 16:9 or 4:3 aspect, not 1:1 squares taking half the screen.
- Typography: text-sm for body, text-base for card titles. Reserve text-lg+
  for page headers only.
- Buttons: py-2 px-3 default. Never py-4 unless it's a primary page CTA.
- Vertical rhythm: prefer space-y-3 over space-y-6.
- Icons: w-4 h-4 inline, w-5 h-5 for prominent. Not w-8+ unless decorative.

When in doubt, make it MORE compact, not less. If a design feels too dense,
Ricky will ask to loosen it — assume compact until told otherwise.

Do NOT produce "Apple-style" generous-whitespace mobile layouts.

## Density exclusions — DO NOT modify these files for density changes

The calendar view and its day-detail modal have a bespoke layout that is
EXEMPT from the density rules above. Do NOT apply density changes to:

- src/components/EventCalendar.tsx
- src/components/calendar/CalendarGrid.tsx
- src/components/calendar/CalendarListView.tsx
- src/components/calendar/DayDetailModal.tsx
- src/components/calendar/calendarUtils.ts
- src/hooks/useCalendarEvents.tsx

Note: src/components/ui/dialog.tsx is a shared shadcn primitive used by other
dialogs on the site. Do not alter it as part of density work on the calendar
modal. It may be adjusted for OTHER dialogs if and only if the change does
not affect DayDetailModal's appearance.

If a task involves any of these excluded files, ask Ricky before changing
anything in them.


## Breadcrumbs (mandatory)

Every page that uses `<GlobalLayout>` MUST pass `breadcrumbs={buildBreadcrumbs(routeId, ctx)}`
from `@/lib/breadcrumbs`. Do NOT hand-roll breadcrumb arrays.

```tsx
import { buildBreadcrumbs } from '@/lib/breadcrumbs';

// Listing
<GlobalLayout breadcrumbs={buildBreadcrumbs('parties')}>

// Nested listing
<GlobalLayout breadcrumbs={buildBreadcrumbs('djs')}>

// Detail page (entity name supplied, isLoading flag handles loading state)
<GlobalLayout breadcrumbs={buildBreadcrumbs('dancer.detail', {
  entityName: dancer?.first_name,
  isLoading,
})}>

// Event page (parent dispatches by event type)
<GlobalLayout breadcrumbs={buildBreadcrumbs('event.detail', {
  entityName: pageModel.identity.title,
  eventType: pageModel.identity.eventType,
  isLoading: state !== 'ready',
})}>
```

Adding a new page:
1. Add a one-line entry to `src/lib/breadcrumbs/siteIa.ts` (label, path, parent, entity flag).
2. Use `buildBreadcrumbs('newRouteId', ctx)` on the page.
3. The unit + tree-validity tests in `src/lib/breadcrumbs/__tests__/` will already cover it.

The dev-only runtime warning in `GlobalLayout` flags pages that render the
sub-header but pass no breadcrumbs — production never crashes.

The visible breadcrumb is paired with a hidden `<script type="application/ld+json">`
emitting Schema.org `BreadcrumbList` for SEO. No extra work — `PageBreadcrumb`
emits it automatically from the `items` it receives.

Pages that legitimately have no breadcrumb (Index, Auth, AuthCallback, Onboarding)
must pass `showSubheader={false}`.


## Calendar occurrence venue/city contract (mandatory)

`calendar_occurrences.venue_id`, `city_id`, and `city_slug` are NULL by default.
They may be set ONLY when `is_override = true` on the same row, indicating the
occurrence has been deliberately moved away from the parent event's defaults.

Read paths must use `COALESCE(co.venue_id, e.venue_id)` to fall back to the
parent event when the override is unset. The shipped public RPCs already do
this (`get_event_page_snapshot_v2`, `get_public_venues_list_v2/v3`,
`get_public_event_detail`, `get_public_festival_detail`, `calendar_events_dto`).
Any new public read path that touches venue MUST use the same pattern.

Self-check + CI:
- Health-check RPC `check_occurrence_venue_contract_v1()` returns aggregate
  health JSON (anon-callable, no row data).
- Workflow `.github/workflows/db-contract-check.yml` runs the check on every
  push, PR, and daily 06:00 UTC. Fails the build on any contract violation.
- Local check: `node scripts/check-venue-contract.mjs`.

Contract migration: admin repo `20260428120000_occurrence_venue_drift_fix_v1.sql`.
Helper-function alignment: admin repo
`20260428160000_occurrence_venue_helpers_align_with_contract_v1.sql`.


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

This repo lives on a Windows mount accessed from the Cowork Linux sandbox via
a stack of `Cowork bash → FUSE bindfs → virtio-fs → Windows NTFS`. The middle
layers exhibit two distinct corruption modes for writes >~2 KB:

1. **Null-byte injection** — file contains stray `\x00` bytes after write.
2. **Silent truncation** — file ends mid-content with no nulls.
3. **Mount eventual-consistency** — the writing process sees the new content
   correctly via warm kernel cache, but a *separate* follow-up process sees a
   stale prior version (sometimes with the same byte size as the new write).
   Confirmed 2026-04-26 PM: `safe-write` v1 reported success, the next bash
   call saw a truncated file matching a prior version's byte size.

The integrity stack v3 defends against all three, plus guards itself against
corruption.

### Writing files >2 KB — `safe-write.py` is the ONLY supported path

A Claude Code `PreToolUse` hook (`.claude/hooks/pre-write-block.sh`) refuses
raw `Edit`/`Write` calls on `.ts/.tsx/.jsx/.js/.cjs/.mjs/.json/.sql/.yml/.yaml/.sh/.py`
files when the existing target or the new content exceeds 2 KB. It prints
the exact `safe-write.py` invocation to use.

```bash
WRITER=$(mktemp /tmp/edit-XXXXXX.tsx)
cat > "$WRITER" << 'EOF'
…full intended file contents (not a diff)…
EOF
cat "$WRITER" | python3 scripts/safe-write.py src/components/foo/Bar.tsx
```

`safe-write.py` v2 (2026-04-26 PM):

1. Stages the new content in `/tmp` (Linux-native, immune to the mount bug).
2. Computes the expected sha256 of the staged file.
3. Copies to the target, then runs `sync` to flush the mount.
4. Re-reads the target's sha256 in a **subprocess** (`sha256sum` binary) so
   the read bypasses our own kernel cache and surfaces the mount's actual
   settled state.
5. If the round-trip sha256 mismatches: retries verify with backoff
   (0.3s → 1s → 3s). If still mismatched, re-copies and starts the verify
   loop over (up to 2 full re-copy cycles).
6. If the round-trip still fails after that: restores the backup and exits 5.
7. Runs the language-appropriate parse check; rolls back to the backup on
   parse failure (exit 4).

Exit codes:

- `0` success — content on disk matches expected sha256 from a fresh subprocess
- `1` null bytes detected
- `2` truncation suspected (--expect-min-lines violated)
- `3` I/O or argument error
- `4` parse-check failed (file restored from backup)
- `5` sha256 round-trip failed after all retries (file restored from backup)

CRLF is auto-applied to source extensions (the repo is `.gitattributes`
CRLF-locked). Override with `--lf` if needed.

The `PostToolUse` hook (`.claude/hooks/post-write-check.sh`) runs the parse
check after any `Edit`/`Write` to a file >2 KB, catching anything that slips
through (e.g. via the bypass).

### Bypassing the PreToolUse hook

Repair flows that need to write directly without going through `safe-write`
(e.g. `bin/repair-corrupt.sh` doing `git checkout HEAD --`) can set:

```bash
SAFEWRITE_HOOK_BYPASS=1 …
```

Use sparingly — every bypass is a risk surface for the corruption modes
above.

### Coordinating with concurrent sessions

The 2026-04-26 morning incident's actual root cause was two Claude sessions
editing the same files concurrently. Before any multi-file refactor:

```bash
bin/session-lock.sh acquire     # warns if another session is active
bin/session-lock.sh release     # when done
```

The lock is advisory (does not block writes), but makes concurrent activity
visible.

### Verifying the whole tree

```bash
npm run check:integrity         # full sweep
npm run repair:corrupt          # auto-restore corrupted files
```

`npm run check:integrity` calls `bin/check-integrity.sh`, which copies the
guard to `/tmp` and verifies its sha256 against `.integrity-guard.sha256`
before running. This means a corrupted guard cannot pass clean.

### Repairing corruption

```bash
bin/repair-corrupt.sh
```

For each corrupt file:
- If working tree matches HEAD → auto-restore via `git checkout HEAD --`.
- If working tree has edits → DO NOT touch; print exact `safe-write.py`
  command for manual repair (because the corruption may have eaten real
  in-progress work).

### Modifying the guard itself

If you intentionally edit `scripts/integrity-guard.py`:

```bash
bash bin/integrity-pin.sh        # locks new sha256 into .integrity-guard.sha256
git add scripts/integrity-guard.py .integrity-guard.sha256
```

Without re-pinning, every subsequent `check:integrity` will fail with
"GUARD SHA MISMATCH".

### Other guardrails

- `.githooks/pre-commit` runs the integrity check on staged files.
  Install via `bash bin/install-hooks.sh` (auto-run by `npm install`).
- `.github/workflows/integrity.yml` (or `architecture-guard.yml`) runs the
  full sweep on every push and PR.
- `.gitattributes` enforces CRLF for source files (Windows-native repo).
- `npm run lint` chains `check:integrity` → architecture lint → eslint.
