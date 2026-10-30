# P3 journey audit: PUBLIC group (J-v1..J-v9, J-d4..J-d7)

Brief: `docs/briefs/p3-audit-journeys.md` (branch `brief/p3-audit-journeys`). Contract: `docs/design/p3-acceptance/CONTRACT.md` on `claude/p3-acceptance-contract-3`.
Code: `origin/main` at 472ecde. Live RPC bodies and prod shapes: read-only `SELECT` on project `stsdtacfauprzrdebmzg`, 2026-10-30. Counts only; no personal data; no writes.
No browser was used. Every step is PASS / FAIL / CANNOT-TELL from code and the live function bodies.

**The question:** after an organiser edits a date, cancels, changes a repeat rule, or sets a cover, price or status in P3, do the PUBLIC event page and the calendar show it?

**Short answer:** yes, at the database level. Every P3 write lands in the P5 tables. Every public read now reads those same P5 tables. The known risk "event page reads legacy, calendar reads p5" is **closed** (evidence in section 1). What is left is narrower:
- **Visibility rules that differ.** A paused series, and an ended series that has future cancelled dates, follow different rules on the event page and the calendar.
- **Stale times.** On 84 future dates (2 series), the stored end time does not match the end time worked out from the sessions.
- **Client caches.** The public page and the calendar each keep their data for 1 hour inside the browser, and a P3 write does not clear them.
- **Missing guards.** Moving a date has no guard for guest-list entries or sold tickets.
- **Owner rule R1 / gap G-16 is still open.**

---

## 1. Write-to-read trace (the core table)

All P3 event writes go through `series_command_p5` / `occurrence_command_p5`. Both call `apply_aggregate_write_p5` (`src/modules/organiser/shared/selfServeApi.ts:282,288`). One write goes around them: "just this date" sessions use `organiser_set_occurrence_programme_v1` (`src/modules/organiser/p3/data/sessions.ts:160`).

**Edge cache.** Every command calls `_emit_cache_revalidation_v1('event', COALESCE(legacy_event_id, id))` (`apply_aggregate_write_p5` body lines 1112-1152). Festivals also get a `'festival'` call. `organiser_set_occurrence_programme_v1` calls it too. The vault secrets are configured (2 of 2 set). In the last 7 days `net._http_response` holds 30 responses, all HTTP 200. The receiver is `app/routes/api.revalidate.tsx:127` → `purgeTagsFor('event')` (`app/cacheTags.ts:178`), which purges `event-<id>` plus the city tag. The organiser page is edge TTL 0 (`app/routes/organiser.tsx:166-173`). The venue page edge-caches only the venue row; its event list is fetched in the browser.

**What the public pages read**
- **Event page:** `event_view_p5(snapshot_compat)` → `_event_view_snapshot_compat_v1` (`src/modules/event-page/useEventPageQuery.ts:372`). It reads `event_series_p5`, `event_occurrence_p5`, `event_occurrence_override_p5`, the program tables and `event_attendance`. It does **not** read legacy `events`; the word appears only in comments.
- **Schedule block:** `event_view_p5(legacy_compat)`, which uses `get_event_program_v1` / `get_occurrence_program_v1` and reads the session override and added-session P5 tables.
- **Calendar:** `get_calendar_events_v2` (`src/integrations/supabase/eventRpcs.ts:370`), which reads P5 only. The other public lists are also P5 only: `calendar_events_dto` (venue), `get_organiser_*` and `get_public_festival_detail_v2`.

| P3 write (kind) | Tables written | Event page reads it? | Calendar reads it? | Verdict |
|---|---|---|---|---|
| `occurrence.move_date` | `event_occurrence_p5.occurrence_date`, `event_series_p5.removed_dates` | yes (occurrence row) | yes (`eo.occurrence_date`) | PASS (data). No guard for bookings or tickets: A-public-5 |
| `occurrence.set_time` / reset | session override / added-session tables; trigger `trg_recompute_p5_headline_time` → `materialised_start_utc/end_utc` | yes (headline via `_p5_occurrence_effective_headline_v1`) | yes (`materialised_start_utc`, line 31) | PASS. Start drift on prod = 0 of 1,473 future live dates |
| `series.set_program` (all dates) | program day/item/section/people | yes (schedule) | has_party/has_class via effective sessions | PASS for sessions. The stored END time drifts: A-public-2 |
| `organiser_set_occurrence_programme_v1` (this date) | `_cmd_occurrence_set_session_delta_p5` tables + headline trigger + its own revalidate | yes | yes | PASS |
| `occurrence.cancel` (recurring date) / uncancel | `event_occurrence_p5.lifecycle_status`, override `cancellation_reason_label` | yes (cancelled + reason, `v_ov.cancellation_reason_label`) | yes (Cancelled row + reason, lines 42-43) | PASS |
| `series.cancel_one_off` | through `_cmd_occurrence_cancel_p5` | yes, the page shows the reason | **removed from the calendar** (line 89, owner decision 11) | PASS (meant) |
| `series.skip_date` / `stop_repeating` | DELETE `event_occurrence_p5` (refused if `_occurrence_date_has_bookings_v1`) | gone | gone | PASS |
| `series.unskip_date` / `add_date` | INSERT `event_occurrence_p5` | yes | yes | PASS |
| `series.set_recurrence` | `event_series_p5` + `_reconcile_series_occurrences_after_rule_change_p5_v1`, which spares curated dates (`_occurrence_is_curated_v1`) | yes | yes | PASS (data). A moved date is NOT curated: A-public-6 |
| `series.end_run` | series `ended`/`ended_on`; future dates cancelled or removed | page stays public (`ended` is allowed) | only dates `<= ended_on` (lines 82-83) | Mostly PASS. Future cancelled dates on ended series: A-public-3 |
| `series.set_lifecycle` paused | `event_series_p5.lifecycle_status` | page and PAST dates are public; future hidden (`_p5_paused_hides_occurrence_v1`) | **whole series hidden, past dates too** (`lifecycle_status='live' OR ended`) | FAIL (low): A-public-4 |
| `series.set_lifecycle` archived / back to draft | lifecycle | `not_found` | hidden | PASS |
| `series.upsert` (cover, name, venue, prices, description, links) | `event_series_p5` | yes | cover / name / venue yes; price is not shown on the calendar (by design) | PASS |
| `occurrence.set_override` (title, cover, venue, city, ticket_url, description, gallery, passes) | `event_occurrence_override_p5` | all 9 keys are read (`_effective_occurrence_*`: title, cover_image_url, venue_id, city_id, ticket_url, description, gallery, passes; cancellation label read directly) | title, cover, venue, city, cancellation label (ticket, description, gallery and passes are not calendar fields) | PASS |
| `series.set_group_chat` | `event_series_p5` | CANNOT-TELL whether the public page shows the group chat | n/a | CANNOT-TELL |
| `series.set_organisers` | `event_series_p5.organiser_ids` → junction trigger | byline (`_public_series_byline_v1`) | `primary_organiser_name` | PASS |

---

## 2. Findings

### A-public-1: owner rule R1 is not met. There is no "this date only / all dates" choice, and the preview does not name who is going (G-16)
- Journeys: J-v1, J-v2. **Severity: blocker** (Critical owner rule).
- What happens:
  - The Repeats preview is a `series.set_recurrence` dry run (`src/modules/organiser/p3/model/repeat.ts:194`, `data/repeat.ts:5-8`). It lists dates added or removed ("This removes N dates already on the calendar.", `model/repeat.ts:423`). It never lists the going people on those dates.
  - Edits to series fields (cover, venue, prices) apply to the series default with no scope question. Only sessions offer "every date" / "just this date" (`data/sessions.ts:82,160`).
- Evidence: the code above. On prod, 67 future dates on live recurring series are "curated" (they have an override or session rows). Those are the dates where the scope question matters.
- Suggested fix: add a scope step to series field edits, and add the per-date going count to the repeat dry-run preview.
- Owner question: for a series field such as cover, should "all dates" overwrite per-date overrides, or keep them (R1 says hand-edited dates are kept)?

### A-public-2: on 84 future dates, the stored end time does not match the end time worked out from the sessions
- Journeys: J-v4, J-d6. **Severity: medium.**
- What happens: `materialised_end_utc` (what the event page headline and the calendar fall back on) differs from `_p5_occurrence_effective_headline_v1().headline_end` on **84 future scheduled dates in 2 live recurring series**. The difference ranges from -31 to +60 minutes. Start times match on every date (0 drift across 1,473 future live dates).
- Evidence:
  - `trg_recompute_p5_headline_time` sits only on the session override and added-session tables.
  - `_p5_sync_series_default_times_v1` on `event_series_program_item_p5` updates the series default, not stored per-date ends.
  - The calendar works out the end from `override_local_end` → `m_end` (only when the start differs from the default) → `local_start + default_duration` (`get_calendar_events_v2` lines 93-103).
- Effect: the schedule block can show one end time while the headline or calendar shows another, after a `series.set_program` edit.
- Suggested fix: recompute stored date times after an all-dates program edit (or use the headline helper in the readers), then backfill the 84 dates.
- Browser walk: open one of the 2 series' event pages and compare the headline end time with the last session's end.

### A-public-3: future cancelled dates on ended series. Does the event page list them while the calendar hides them?
- Journeys: J-v6, J-d7. **Severity: low.**
- What happens: 2 ended recurring series have future cancelled dates. The calendar only shows dates `<= ended_on`. Whether `_event_view_snapshot_compat_v1` lists those future cancelled dates on the page is CANNOT-TELL from the body slice read.
- Suggested fix: apply the same `ended_on` bound in the snapshot's occurrences list.
- Browser walk: open an ended series with future cancelled dates. The page must not advertise a date after the run ended.

### A-public-4: a paused series keeps its past dates on the event page but loses them from the calendar
- Journeys: J-v6, J-d8 (status). **Severity: low.**
- What happens:
  - The event page serves a paused series and its past dates (`event_view_p5`: anon admits `live`/`paused`/`ended`, then `_p5_paused_hides_occurrence_v1`).
  - `get_calendar_events_v2` admits only `live`, or `ended` up to `ended_on` (lines 82-83). It also lists `WHERE es.lifecycle_status IN ('live','ended')` at line 123. So a paused series' PAST nights disappear from the calendar and from the organiser's "Past nights" (`get_organiser_calendar_events_v1` wraps it).
- Prod: 2 paused series (1 one-off, 1 recurring).
- Suggested fix: admit `paused` for dates `< London today` in `get_calendar_events_v2`, reusing `_p5_paused_hides_occurrence_v1`.
- Owner question: should a paused series' past nights stay in public history? The owner decision of 2026-10-08 says the page keeps them.

### A-public-5: moving a date has no guard for bookings, guest-list entries or tickets, and the screen does not warn
- Journeys: J-v7, J-v3, J-d4. **Severity: high.**
- What happens:
  - `_cmd_occurrence_move_date_p5` refuses festivals, non-scheduled dates and a date that is already taken. It does **not** call `_occurrence_date_has_bookings_v1`. Skip, remove and stop-repeating all do call it.
  - Going rows and guest-list entries are keyed on the occurrence id, so they silently move with the date.
  - The DateSheet has no sold, going or guest-list check on Move (`src/modules/organiser/p3/screens/DateSheet.tsx`; it only shows `P3NightGoing`). No notification is written; none of the cancel or move handlers writes any notify table.
- Prod: **3 future scheduled dates (3 series) carry guest-list entries.** 7 going rows, 0 of them on future dates. 6 tickets / 4 orders, and no ticket type is keyed to an occurrence.
- Suggested fix: when a date has bookings, refuse the move (or ask to confirm) with "N people are on the guest list for this date", and notify them.
- Owner question: may a date with guest-list entries be moved at all, and must those people be told?

### A-public-6: a moved date is not "curated", so a later repeat-rule change can drop or re-create it
- Journeys: J-v2, J-d5. **Severity: medium.**
- What happens: `_occurrence_is_curated_v1` counts only override, added-session or session-override rows. `move_date` writes none of them. It changes `occurrence_date` and appends the old day to `removed_dates`. When the rule is reconciled, a moved date that falls off the new pattern is not spared.
- Evidence: the curated body (read 2026-10-30) and the move_date body (lines 47-58).
- Suggested fix: count `occurrence_date` not on the rule (or a moved flag) as curated.
- CANNOT-TELL until checked: whether `_reconcile_series_occurrences_after_rule_change_p5_v1` already keeps off-pattern dates. A browser walk must move one date, change the rule, and confirm the moved date survives.

### A-public-7: the public page and the calendar keep their data for 1 hour in the browser, and a P3 write does not clear it
- Journeys: J-x2-adjacent, J-v3, J-d7. **Severity: medium.**
- What happens:
  - `useEventPageQuery` uses `staleTime: 1h` (`src/modules/event-page/useEventPageQuery.ts:391`).
  - `useCalendarEventsRpc` uses a default of `1000*60*60` (`src/hooks/useCalendarEventsRpc.ts:31`).
  - P3 writes invalidate only organiser keys (`src/modules/organiser/p3/data/dates.ts:339-342`, `data/sessions.ts:282-283`).
  - So after a cancel or move, an organiser who goes to the calendar or event page in the same tab sees the old state for up to an hour. Refetch on window focus can hide this. The edge cache is purged correctly (section 1); this is the browser's own copy.
- Suggested fix: after a successful command, invalidate `['event-page-snapshot', id]` and the calendar keys.

### A-public-8: there is no "see it as dancers see it" link from the P3 event page
- Journeys: J-x2-adjacent, J-v6. **Severity: low.**
- What happens: `src/modules/organiser/p3/screens/*` has no link to `/event/<id>`. The only outbound links are ticket and Instagram (`EventPage.tsx:153-154`). The organiser cannot check the public result without leaving P3.
- Suggested fix: add a "View public page" row (full navigation, so the purged edge copy is used).
- Owner choice: none.

### A-public-9: an empty cancel-reasons list still renders nothing (G-12)
- Journey: J-d7 step 2. **Severity: low.**
- What happens: `ReasonPick` (`src/modules/organiser/p3/screens/CancelEventSheet.tsx:80-95`) shows an error plus Try again when the fetch fails (PASS). When the data is `[]`, it renders an empty group with no copy. Prod has 5 reasons, so this cannot happen today.
- Suggested fix: add one explicit empty line.

### A-public-10: concurrent edits (G-24) are guarded on the server; whether every P3 caller sends the version is CANNOT-TELL
- Journey: J-v8. **Severity: medium.**
- What happens: `apply_aggregate_write_p5` raises `version_conflict` when `expected_version` is sent and stale (body lines 859-864, 876). The envelope builder adds `expected_version` only when it is given a version > 0 (`src/modules/organiser/shared/seriesCommands.ts:149`). Whether each P3 screen passes it was not traced call by call. If a screen does not, the later save silently overwrites.
- Suggested fix: make `expected_version` required in the P3 envelope builder.
- Browser walk: two tabs, edit the same date, save both. The second save must be refused or warned.

---

## 3. Journey verdicts

| Journey | Step verdicts | Overall |
|---|---|---|
| J-v1 series vs one date (R1) | scope ask: FAIL (A-public-1); preview of going people: FAIL | **FAIL** |
| J-v2 change repeat rule | preview of dates: PASS; going people in preview: FAIL; hand-edited dates kept: PASS for overrides and sessions, CANNOT-TELL for moved dates (A-public-6) | **FAIL** |
| J-v3 dates off / cancelled / moved | reaches page and calendar: PASS; reason from the fixed list (`_owner_cancellation_reason_ok_p5`, 5 reasons): PASS; going people see it: CANNOT-TELL (no notify; A-public-5) | CANNOT-TELL |
| J-v4 session times, rooms, per-date venue, line-up | times: PASS; per-date venue: PASS; line-up: PASS (program people tables); stored end drift: FAIL on 84 dates (A-public-2); rooms: CANNOT-TELL (P3 sends no `series.set_rooms`) | **FAIL** (medium) |
| J-v5 line-up search / add new person | not traced here (team/people group) | CANNOT-TELL |
| J-v6 publish states | archived / draft hidden: PASS; ended: PASS; paused past dates: FAIL (A-public-4); ended future cancelled dates: CANNOT-TELL (A-public-3) | **FAIL** (low) |
| J-v7 tickets sold / people going | move with bookings not blocked: FAIL (A-public-5); skip / remove with bookings refused: PASS | **FAIL** |
| J-v8 concurrent edits | server guard: PASS; callers: CANNOT-TELL (A-public-10) | CANNOT-TELL |
| J-v9 admin-editor gaps listed (G-21) | not traced in this group (the admin repo is not in scope here) | CANNOT-TELL |
| J-d4 weekly, many dates | "100 of N": **no prod series exceeds 57 future dates** (max 57), so only seed data can test it: CANNOT-TELL; cancel / bring back reach both reads: PASS; Move / Time / Skip / Reset reach both reads: PASS | CANNOT-TELL |
| J-d5 monthly / custom / explicit | rule change sends once via dry-run then commit: PASS (code); Add date / Skip reach both reads: PASS; moved date survives a rule change: CANNOT-TELL | CANNOT-TELL |
| J-d6 course and festival | session edits reach the schedule: PASS; festival move refused on the server (`move_date is not supported for festivals`): PASS; screen copy: CANNOT-TELL | CANNOT-TELL |
| J-d7 one-off cancel and bring back | sends `series.cancel_one_off`; page shows the reason, calendar drops it (owner decision 11): PASS; reasons failure shows Retry: PASS; empty reasons: FAIL (G-12, A-public-9); bring back: PASS (data) | **FAIL** (low) |

**Totals: 13 journeys audited. 0 pass / 7 fail / 6 cannot-tell.** No journey passes outright, because each has at least one step this method cannot settle or a known gap. At the data level (the question in the brief), every organiser write reaches both public reads, except the visibility rule differences in A-public-3 and A-public-4.

## 4. Prod shapes used (counts only, 2026-10-30)
- **Series by lifecycle:** live 69, ended 21, paused 2, draft 13, archived 653.
- **Series by format:** one_off 650, recurring 79, course 16, festival 13.
- **Occurrences:** scheduled 3,281, cancelled 149. There is no `skipped` status; a skip deletes the row.
- **Live recurring series:** 45. 7 have no future scheduled date, 2 have future cancelled dates, 33 have overrides. 0 have more than 100 future dates (max 57).
- **Live one-offs:** 10, of which 9 are past. Live courses: 6, of which 5 have no future date. Live festivals: 8, of which 2 have no future date.
- **Bookings:** 67 curated future dates on live recurring series. 7 attendance rows, 0 on future dates. 524 guest-list entries on dates, 3 future dates (3 series). 6 tickets, 4 orders.
- **Revalidation webhook:** configured, and 30 of 30 calls returned 200 in the last 7 days.

## 5. Walks the lead must do in a browser (390x844)
1. **A-public-2:** open each of the 2 series with end drift; compare the headline end time with the last session's end, on the event page and on the calendar.
2. **A-public-3:** open an ended recurring series that has future cancelled dates; the page must not list dates after the run ended.
3. **A-public-4:** pause a seeded series that has past nights; check the event page (past dates shown) against the calendar and the organiser profile's "Past nights".
4. **A-public-5:** on a seed date with a guest-list entry, Move the date. Record whether P3 warns, and where the guest entry ends up.
5. **A-public-6:** move one date of W-weekly-130, then change the repeat rule; the moved date must survive.
6. **A-public-7:** cancel a date in P3, then navigate in the same tab to /calendar and the event page without reloading. Record how long the old state shows.
7. **J-v8:** two tabs, same date, two saves; the second must be refused or warned.
8. **J-d4:** use seed W-weekly-130 (130+ dates) for "100 of N"; prod cannot reach it.
9. **J-d6:** check that the festival session rows read-only copy and the course scope-disabled reason are on screen.
10. **J-v3:** decide with the owner whether going or guest-list people must be notified of a cancel or move; today nothing is sent.

## Not verified
- No browser walk. Rendered copy, U1-U10 and S-1..S-11 states were not checked.
- Two things were not read line by line: the occurrences list inside `_event_view_snapshot_compat_v1` (22 KB), and the curated-date sparing inside `_reconcile_series_occurrences_after_rule_change_p5_v1`. A-public-3 and A-public-6 are CANNOT-TELL for that reason.
- P3 on the build branch `claude/p3-create-event-build` (New event) was not traced; none of this group's journeys starts there.
