# Organiser-link fix plan (P5 organiser_ids -> event_entities)

Status: **plan only** (per Ricky, 2026-06-11). Data already reconciled; durable
fix below is NOT yet implemented. Owner repo for the DDL items: `bachata-admin-11april`.

---

## Problem

Public organiser pages render "No upcoming events" even when the organiser has
live events. Confirmed root cause (high confidence; verified against live
`pg_proc` and a live census):

- The only live event editor since the Phase-1E cutover is **editor-v2**.
  When an organiser is selected, it saves via `series.upsert` ->
  `_cmd_series_upsert_p5`, which writes the organiser **only** to
  `event_series_p5.organiser_ids[]` and **never** to `public.event_entities`
  (role='organiser'). It does not call `replace_or_patch_organisers`.
- The public site reads organiser -> events **exclusively** from
  `event_entities`:
  - `src/pages/OrganiserProfile.tsx` (the organiser page)
  - `src/modules/event-page/sections/MoreEventsSection.tsx`
  - `FestivalDetail.tsx`
- The event *detail* page is fine because admin repointed those reads to
  resolve P5-first (`_resolve_primary_organiser_v1`, 2026-07-27 arc) - but the
  organiser-page read was never repointed, and the Website architecture lint
  (`scripts/lint-runtime-architecture.mjs`, rule `no-legacy-organiser-fields`)
  forbids public `src/` from referencing `organiser_ids` directly.

Net: every event created/edited through editor-v2 is born with its organiser
only in the P5 array -> invisible on the organiser's own page.

Why no guard caught it: `check_event_organiser_drift_v1` was deliberately
narrowed (migration 20260727020000) to treat "P5 has organiser, event_entities
empty" as **not** drift, and it has zero call sites (never runs). The unit test
`tests/eventOrganiserLinks.test.ts` covers only read helpers.

## Already done (data, live)

Reconciled `event_entities` from the canonical `event_series_p5.organiser_ids`
for all affected ACTIVE events. **0 active orphans remain.** Events relinked:
Anna Galenda / Bachata Summer Course, Latin Krazy, Bachata Picnic, Dancing in
the Park, Spring Fiesta, BachaZouk UK Festival 2026, June Styling Course,
London Loves BOS (BOS + London Loves Bachata), Mambo City x LLB.

1 inactive orphan remains (swept by the backfill below when it ships).

## Already done (Website CI, this change)

- `scripts/check-organiser-link-contract.mjs` - calls anon RPC
  `check_organiser_link_contract_v1()`; hard-fails CI when any active event has
  a P5 organiser but no `event_entities` row.
- Wired into `.github/workflows/db-contract-check.yml` as check #34.
- **LIVE as of 2026-06-11** - the health RPC (item 3 below) is applied
  (admin migration 20260816000000), so the guard is active and currently
  passing (active_orphan_count = 0). It soft-passes only if that RPC is absent.

---

## Durable fix (admin repo - author as migrations, apply via `supabase db push`)

### 1. Forward write-through (the actual bug fix)
Redefine `public._cmd_series_upsert_p5` so that, after resolving the series id
and its legacy `events` row, it replace-sets `event_entities` (role='organiser')
from `event_series_p5.organiser_ids`, keyed on `legacy_event_id` (only when
non-null). Reuse the validated helper `replace_or_patch_organisers(p_event_id,
organiser_ids)` rather than hand-rolling DELETE+INSERT, so `organiser_profiles`
validation and the canonical row shape stay intact. Makes `organiser_ids` the
source of truth and `event_entities` a derived projection written on every
create AND edit. Covers smart-import (same series.upsert path) and is
idempotent on re-save.
- Verify the current canonical body via `pg_proc` before authoring (latest
  org-relevant: `20260805040000_cmd_series_upsert_p5_*`).
- Confirm `replace_or_patch_organisers` is safe to call inside the same
  transaction wrt the events-row triggers already fired there.
- `NOTIFY pgrst, 'reload schema';` after.

### 2. One-off backfill migration
For every `event_series_p5` row with `array_length(organiser_ids,1) >= 1` and a
non-null `legacy_event_id` that has zero `event_entities` organiser rows,
replace-set from `organiser_ids` (via `replace_or_patch_organisers` per event,
for validation parity). Sweeps the 1 remaining inactive orphan and any future
gap. Do NOT reuse `20260617150000_backfill_series_organiser_ids_from_event_entities_v1`
- that syncs the OPPOSITE direction (event_entities -> organiser_ids).

### 3. Health RPC `check_organiser_link_contract_v1()` -- DONE (applied 2026-06-11; activates Website guard #34)
Read-only `SECURITY DEFINER`, `GRANT EXECUTE ... TO anon`. Returns jsonb:
`{ ok, active_orphan_count, total_orphan_count, samples[] }` where an orphan is
an event with `event_series_p5.organiser_ids` non-empty (resolving to a real
`organiser_profiles`) but no `event_entities` role='organiser' row. The Website
check #34 already calls this name and soft-passes until it exists, so shipping
this migration turns the dormant guard live with no further Website change.
This is low-risk and additive (no write path touched) - can ship independently
of items 1/2 if you want the guard live before the write-through lands.

### 4. (optional) Widen the drift detector
Redefine `check_event_organiser_drift_v1` to also flag the inverse currently-blind
case (P5 has organiser, event_entities empty) for active/published events. Keeps
the existing ee->p5 direction. Acts as a second regression alarm once item 1 lands.

---

## Secondary defect (separate, additive)

Smart-import silently drops an organiser whose AI-extracted name does not
EXACTLY single-match `organiser_profiles.name` (`findOrganiserIdByName` returns
null on 0 or 2+ matches), even when a matching profile exists. The organiser
never enters `organiser_ids` at all, so items 1-2 cannot recover it. Decide
whether to loosen/surface unmatched-name handling
(`lib/eventSmartImportClient.ts`, `components/events/import/ImportEventDialog.tsx`).

## Open questions

- Per-occurrence organiser overrides write `event_series_occurrence_p5.organiser_ids`.
  `event_entities` is keyed by `event_id` (series-level), so per-occurrence
  granularity may be out of scope - decide whether overrides should reflect.
- Confirm whether to keep `event_entities` as the canonical organiser-page read
  (favours item 1) or repoint the 3 Website readers to a P5-resolving RPC
  (alternative; needs a new RPC + lint exception). Item 1 is recommended.
