# Weekly socials audit (read-only), 2026-10-29

Scope: weekly recurring events ("weekly socials"). Prod project `stsdtacfauprzrdebmzg`, SELECT only. No code or data changed. Counts only.

## 1. Data source (proved)

- Repeat rule: `event_series_p5.recurrence_rule` (jsonb). Weekly = `{"mode":"weekly","weekdays":[n],"interval":1|null}`, with `n` 0..6 (0 = Sunday, matching `extract(dow)`). Lifecycle: `event_series_p5.lifecycle_status`, `ended_on`, `removed_dates`. Dates: `event_occurrence_p5` (`occurrence_date`, `lifecycle_status`, `materialised_start_utc`, stored local-as-Z), with per-date edits in `event_occurrence_override_p5`.
- Calendar: `get_calendar_events_v2` reads `event_series_p5` JOIN `event_occurrence_p5` only. It admits `lifecycle_status='live'`, or `'ended'` for dates `<= ended_on`. It excludes archived dates and cancelled one-offs, and keeps cancelled nights of a recurring series. Per-date start comes from `materialised_start_utc`, so there is no clock arithmetic and no BST shift.
- Event page: `src/modules/event-page/useEventPageQuery.ts:372` calls `event_view_p5`. The stale-memory claim "event page reads legacy" no longer holds on prod: the legacy `public.events` and `public.event_occurrences` relations do not exist (`to_regclass` is null for both). The calendar-vs-page desync is now at most p5-vs-p5 (RPC logic), not table-vs-table.
- Writer of the rule: admin repo RPCs (`admin_event_publish`, series upsert). Not re-verified here; this repo owns no writers.

## 2. Shapes (recurring-format series, templates excluded; "next" = a non-cancelled date >= London today)

| Mode | Status | Series | Has next | Past-only | >100 dates | Has a cancelled date |
|---|---|---|---|---|---|---|
| weekly | live | 28 | 28 | 0 | 1 (132 dates) | 18 |
| weekly | paused | 1 | 1 | 0 | 0 | 1 |
| weekly | draft | 7 | 7 | 0 | 0 | 1 |
| weekly | archived | 7 | 5 | 2 | 0 | 0 |
| weekly | ended | 0 | - | - | - | - |
| (no rule) | live | 9 | 2 | 6 (+1 future dates all cancelled) | 0 | 3 |
| (no rule) | ended | 13 | 0 | 11 (2 more have only dates after `ended_on`) | 0 | 7 |
| (no rule) | draft / archived | 4 | 2 | 2 | 0 | 0 |
| monthly | live / archived | 8 / 2 | 6 live | 1 archived | 0 | 1 |
| custom | live | 1 | 1 | 0 | 0 | 1 |

Notes: "weekly" is 43 series. The 26 rule-less series are irregular-date series stored as `format='recurring'`, not weekly. The 132-date live weekly series is over the 100-row API cap if fetched unbounded; the calendar fetches by date range, so it is bounded in practice (not verified).

## 3. Per-surface behaviour

Verified from RPC body only (calendar). Event page and organiser area were not exercised in a browser; see Not verified.

- Live weekly with next date: appears on calendar. No live weekly series lacks a next date (0 of 28).
- Ended: calendar shows only dates up to `ended_on`, by design (Arc P2).
- Cancelled single date of a live weekly: calendar keeps a Cancelled row (18 series).
- Draft/paused/archived weekly: excluded from the calendar (not `live`). Draft with dates (7) and paused (1) are by design hidden.
- BST to GMT (2026-10-25): no clock maths in the calendar path; `materialised_start_utc` is local-as-Z, so display weekday and time cannot shift. See finding 3 for data, not code, anomalies near the change.

## 4. Findings

### FIX FIRST
1. **Live series with no rule and no upcoming date (7 series).** They show on the calendar only through past dates and then vanish with no signal to the organiser. Six have dates only in the past. 02f6a4fe has dates to 2026-11-20 that are all cancelled (13 of 20 cancelled). Not weekly, but they are the "live night with nothing coming" shape. Query:
   `select id, recurrence_rule, (select max(occurrence_date) from event_occurrence_p5 o where o.series_id=es.id) from event_series_p5 es where format='recurring' and lifecycle_status='live' and not exists (select 1 from event_occurrence_p5 o where o.series_id=es.id and o.occurrence_date>=(now() at time zone 'Europe/London')::date and o.lifecycle_status='scheduled');`

### FIX LATER
2. **Dates off the rule weekday (2 live/paused weekly series, 5 dates since 2026-10-01).** 131c7d97 (rule Fri) has Wed/Thu dates in October (4 dates, one cancelled Wed); b38f71cb (rule Thu) has a cancelled Monday 2026-10-26, the day after the clock change. Possibly deliberate moved dates, but the series is shown as "every Friday" while dates fall on other days. Query: join `event_series_p5` (`recurrence_rule->'weekdays'->>0`) to `event_occurrence_p5` and compare `extract(dow from occurrence_date)`.
3. **Per-date start differs from the series default (5 dates, 5 series; none has a custom start override).** 131c7d97 on 2026-10-01 (19:00 v 20:00), 1dd29914 on 2026-10-20 (19:30 v 18:30), 1e0a984c 2026-10-17 (16:30 v 19:00), b38f71cb 2026-10-26 (20:00 v 19:30), fe5f5be4 2026-10-04 (12:00 v 18:30). Two are exactly +/-1h, which could be a BST/GMT materialisation effect; the rest are not. Cannot be proven from counts. Query: compare `(materialised_start_utc at time zone 'UTC')::time` with `default_local_start_time`.
4. **Legacy link gaps.** 1001 of 3427 p5 occurrences have no `legacy_occurrence_id` (27 live weekly series have future dates with none). With the legacy tables gone, confirm nothing still keys on legacy ids (guest list, going). Query: `select count(*) from event_occurrence_p5 where legacy_occurrence_id is null;`
5. **132-date weekly series** exceeds the 100-row cap if any consumer fetches all dates without a range.

## 5. Not verified

- Event page (`event_view_p5`) and organiser area output for each shape: the RPC bodies were not read and nothing was rendered on a phone.
- No browser walk at 390x844.
- Whether findings 2 and 3 are deliberate overrides vs generator drift (needs the admin writer; overrides were only checked for `custom_local_start_time`).
- Calendar RPC body read only to ~6,000 of 17,338 characters (base CTE and gates); the derived and output CTEs were not read.
- That the 1-hour pattern in finding 3 is a clock-change effect.
- The writer RPC names in section 1.
