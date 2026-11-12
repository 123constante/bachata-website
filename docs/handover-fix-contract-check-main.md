# Handover: red `contract-check` on main (P5 materialised canonical)

Brief: `brief/fix-contract-check-main:docs/briefs/fix-contract-check-main.md`.
Branch: `claude/fix-contract-check-main`. Ticket `dt_073d2aa2a819`. Surveyed 2026-11-12, read-only SQL only.

## TL;DR

- **Not stale data in general, not a bad stash function. A writer gap (cause (b)).**
  `series.set_program` on a **live** series moves the series' derived start time
  (via trigger `trg_p5_sync_series_default_times`), but nothing re-times the
  already-materialised occurrence rows. `_cmd_series_set_program_p5` calls
  `_retime_draft_occurrences_after_program_p5_v1`, which returns 0 for every
  series that is not a **draft** ("Live, paused, ended and archived series are
  never touched").
- All **51** drifted rows are **one live weekly series** (`f43ef36f-93ec-48fb-bde9-fff422cab8ac`,
  recurring, Europe/London). On 2026-11-11 20:51&ndash;20:52 UTC the organiser ran
  four `series.set_program` saves that moved the first session from 19:00 to 19:15.
  `default_local_start_time` became 19:15; the 51 future rows kept 19:00. Drift is
  exactly -15 min on every row.
- **The fix cannot land in this repo.** This repo owns zero migrations
  (`supabase/migrations/` must not exist here). The data repair and the writer fix
  are an **admin-repo migration** for the lead to land under the standing
  migration approval. The draft SQL is below. The check was not loosened.
- **The contract-check stays red until that migration is applied to prod.** No
  change in this repo can make it green: the RPC reads live prod data.

## Classification of the 51 rows (prod, 2026-11-12)

| Class | Count |
|---|---|
| Gated `time_drift` (non-festival, future, scheduled) | 51 |
| `date_drift` | 0 |
| Distinct series | 1 (`f43ef36f...`, format `recurring`, lifecycle `live`) |
| Festival rows in `drift_count` | 0 (festival time drift is report-only, `festival_time_drift_future`; the "6 h off" festival row in the brief is in `festival_sample`, not in the gate) |
| Date range | 2026-11-12 .. 2027-11-11 (weekly) |
| materialised time / expected time | 19:00 / 19:15 on every row (diff -15 min) |
| Rows with bookings | 0 |
| Rows with session override / added session | 0 / 0 |
| Expected == `stash_local_as_utc(occurrence_date, default_local_start_time)` | yes, all 51 (no overrides, so the headline helper falls to the programme min = series default) |
| Past rows of the series | 19:00 (correct for their time; not gated) |

Audit trail (`event_audit_p5`, target = the series): `series.upsert` 20:49:23
(passes/payment only, no time change) then `series.set_program` x4 at 20:51:28,
20:52:07, 20:52:25, 20:52:50. Series and all three programme items carry
`updated_at = 20:52:50.438304`; occurrence rows last touched 03:45 the same day.

### Why `series.upsert` did not catch it

`_cmd_series_upsert_p5` does re-materialise live series (no lifecycle filter,
excludes override / added-session / session-override rows) but only when the
series start time changes through the upsert payload. Here the start moved through
the programme trigger, so the upsert's IS-DISTINCT-FROM gate never opened. This is
the gate-needs-a-writer trap: a live series can reach drift through an ordinary
organiser save, and only a migration can clear it.

## Proposed admin-repo migration (draft &mdash; lead to land)

Two parts. (1) the writer: let `set_program` re-time live/paused series the same way
it already re-times drafts. This matches what `series.upsert` already does for a
live series when its start moves, so it is not a new policy for live events &mdash; it
closes a second door to the same state. Keeps the bookings exclusion the draft path
has. (2) the one-shot repair of rows that are drifted now, through the same
canonical helper, never through raw arithmetic.

**Decision for the lead/owner before landing part (1):** the draft-only scope was
deliberate (ER AD2, 20261202130000). If the owner wants live-series programme edits
to NOT move published times, part (1) is wrong and the alternative is to make
`series.set_program` refuse to change day-0 start on a live series. Either way the
check needs a writer; part (2) alone will go red again on the next such edit.

```sql
-- <admin>/supabase/migrations/2027032116xxxx_retime_live_occurrences_after_program_v1.sql
BEGIN;

-- (1) Writer: draft OR live/paused, never ended/archived/template.
CREATE OR REPLACE FUNCTION public._retime_draft_occurrences_after_program_p5_v1(p_series_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_today date := (now() AT TIME ZONE 'Europe/London')::date;
    v_occ   record;
    v_n     int := 0;
BEGIN
    -- 2026-11-12 (bachata-website brief fix-contract-check-main): extended from draft-only to
    -- live and paused. A set_program save on a live series moved default_local_start_time via
    -- trg_p5_sync_series_default_times but left every future row at the old time (51 rows,
    -- check_occurrence_p5_materialised_canonical_v1 red with no admin remedy). series.upsert
    -- already re-times live series when their start changes; this closes the programme door.
    IF NOT EXISTS (SELECT 1 FROM public.event_series_p5 s
                    WHERE s.id = p_series_id
                      AND s.lifecycle_status IN ('draft', 'live', 'paused')
                      AND NOT COALESCE(s.is_template, false)) THEN
        RETURN 0;
    END IF;
    FOR v_occ IN
        SELECT eo.id, eo.materialised_start_utc AS s0, eo.materialised_end_utc AS e0
          FROM public.event_occurrence_p5 eo
         WHERE eo.series_id = p_series_id
           AND eo.lifecycle_status = 'scheduled'
           AND eo.occurrence_date >= v_today
         ORDER BY eo.occurrence_date, eo.id
           FOR UPDATE
    LOOP
        CONTINUE WHEN public._occurrence_date_has_bookings_v1(v_occ.id);
        PERFORM public._recompute_occurrence_headline_time_from_sessions_v1(v_occ.id);
        IF EXISTS (SELECT 1 FROM public.event_occurrence_p5 eo
                    WHERE eo.id = v_occ.id
                      AND (eo.materialised_start_utc IS DISTINCT FROM v_occ.s0
                           OR eo.materialised_end_utc IS DISTINCT FROM v_occ.e0)) THEN
            v_n := v_n + 1;
        END IF;
    END LOOP;
    RETURN v_n;
END
$function$;
-- (The name still says "draft"; renaming would touch _cmd_series_set_program_p5. Leave it,
--  or ship a _v2 and repoint the caller in the same file -- lead's call.)

-- (2) One-shot repair: exactly the rows the gate counts, through the canonical helper.
--     PREDICTION (2026-11-12): 51 rows updated, all series f43ef36f..., 19:00 -> 19:15 local-as-UTC.
--     The count falls by one each Thursday the migration waits (weekly series).
DO $$
DECLARE r record; v_n int := 0; v_after bigint;
BEGIN
    FOR r IN
        SELECT eo.id
          FROM public.event_occurrence_p5 eo
          JOIN public.event_series_p5 s ON s.id = eo.series_id
          LEFT JOIN LATERAL public._p5_occurrence_effective_headline_v1(eo.id) h ON true
         WHERE eo.lifecycle_status = 'scheduled'
           AND eo.materialised_start_utc IS NOT NULL
           AND NOT (COALESCE(s.format, '') = 'festival' OR s.festival_id IS NOT NULL)
           AND eo.occurrence_date >= current_date
           AND h.headline_start IS NOT NULL
           AND eo.materialised_start_utc IS DISTINCT FROM h.headline_start
    LOOP
        PERFORM public._recompute_occurrence_headline_time_from_sessions_v1(r.id);
        v_n := v_n + 1;
    END LOOP;
    RAISE NOTICE 'p5 time-drift repair: % rows re-anchored', v_n;

    -- Proof in the same transaction: the gate must read 0 or the whole file rolls back.
    SELECT (public.check_occurrence_p5_materialised_canonical_v1()->>'drift_count')::bigint INTO v_after;
    IF v_after <> 0 THEN
        RAISE EXCEPTION 'p5 time-drift repair left drift_count=%', v_after;
    END IF;
END $$;

COMMIT;
```

Undo: part (2) is a data repair to the canonical value, so there is no meaningful
undo (the "before" value is the drifted one). Part (1) undo = re-run the
20261202130000 body of `_retime_draft_occurrences_after_program_p5_v1(p_series_id uuid)`
(draft-only `IF NOT EXISTS` clause).

### Replay test cases for the admin migration (table-driven, admin repo)

| # | Series | Edit | Expected after `series.set_program` |
|---|---|---|---|
| 1 | live, recurring, no overrides | first session 19:00 -> 19:15 | all future scheduled rows 19:15; past rows unchanged |
| 2 | live, row with bookings | same | that row stays 19:00 (shows as drift: owner decision whether booked rows should block or move) |
| 3 | live, row with session override start 20:00 | same | row stays 20:00 (helper reads the override) |
| 4 | paused | same | re-timed like live |
| 5 | ended / archived / template | same | untouched, returns 0 |
| 6 | festival | same | no-op (helper returns nothing for festivals) |
| 7 | draft | same | unchanged behaviour (AD2) |

Case 2 is a real open question: the draft path skips booked rows, so a live series
with a booked date and a programme time change will still show drift on that date.
Today there are 0 such rows.

## Done / left / next

- **Done:** root cause, classification, prediction (51 -> 0), draft migration and
  replay cases. No prod writes.
- **Left (lead):** land the admin migration (decide case 2 and the live-scope
  question), apply to prod, re-run `contract-check` on main.
- **Not done here:** contract-check green. It cannot go green from this repo.
