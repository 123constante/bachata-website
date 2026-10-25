# P3 organiser redesign (mockup C3): server contract, slice A0

Status: survey and contract only. No src, SQL or migrations in this slice. Server work lands in the
admin repo (`123constante/bachata-admin`, migrations there) as A1-A3, then the Website builds behind
the flag `organiserP3`.

Sources: live `pg_proc` bodies and `pg_constraint` on prod `stsdtacfauprzrdebmzg` (read-only,
25 Oct 2026), `main` at 36d3cea, C3 spec (`claude/er-p3-mock-c3`, `docs/organiser-rebuild/p3/mockups/C3.md`).
Every function name below was read from `pg_proc`. Where something was not read in full, it says so.

---

## 0. The short version

- **Most of C3 already has a live RPC.** The server is ahead of the Website on four points:
  - Per-date name, music, photos and price are already owner-writable through `occurrence.set_override`
    (`title`, `music_styles`, `gallery`, `passes`). The public event page already applies them
    (`_event_view_snapshot_compat_v1` calls `_effective_occurrence_*_p5` for each one).
    Only the Website's `OWNER_OVERRIDE_KEYS` (`src/modules/organiser/shared/seriesCommands.ts:112`)
    lacks them. So A2's override half is mostly a **Website** job, plus one reader fix (the calendar).
  - Date regeneration when the Repeat rule changes exists (`_reconcile_series_occurrences_after_rule_change_p5_v1`).
    The gap is that the owner path of `series.set_recurrence` accepts only weekly, one weekday, every week.
  - History exists (`organiser_series_history_v1`) and has no Website caller.
  - Undo exists (`organiser_undo_last_change_v1`) but only for `series.upsert`.
- **Real server gaps:**
  1. **A1:** a stored forward rule on a series session ("this and later"). Today, `series.apply_forward_from`
     only copies event-level keys into per-date override rows. It has no session fields, and it can
     only reach dates that already exist (owner cap: 30 upcoming).
  2. **A2:** the owner Repeat rule is too narrow (monthly, several weekdays, end after N, course counting).
     The organiser workspace says only `has_override`, not *which* fields differ. Its occurrence list is
     capped at the 100 newest dates.
  3. **A3:** owner undo for per-date and session commands; an owner "Make a copy" (duplicate is admin-only
     today); `has_bookings` missing from the failure classifier.
- **Owner forks (section 6):**
  - Make a copy: the parity matrix says DROPPED-BY-DECISION; C3 D42 draws it.
  - The "max 500 dates" copy vs the server's real caps (30 upcoming for owners, 520 for after_count).
  - Undo window: 24h rolling vs "today".

---

## 1. Shape survey (prod, counts only, 25 Oct 2026)

`event_series_p5`, excluding templates. Kind is computed like this:
- `format = festival` → festival
- `format = course` → course
- rule `mode = monthly` → monthly
- rule `mode = custom` → dates I pick
- `format = recurring` → weekly series
- otherwise → one-off

The columns are:
- **ses** = series programme items (sessions)
- **d** = occurrence rows
- **cancel** = series with at least one cancelled date
- **no fut** = no scheduled date today or later
- **empty LU** = no programme people at all
- **date ovr** = at least one `event_occurrence_override_p5` row
- **sess ovr** = at least one `event_occurrence_session_override_p5` row
- **added** = at least one `event_occurrence_added_session_p5` row
- **breaks** = non-empty `removed_dates`

| lifecycle | kind | n | ses 0/1/2-3/4+ | d 0/1/2-13/14-100/>100 (max) | cancel | no fut | empty LU | date ovr | sess ovr | added | breaks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| live | weekly series | 37 | 0/3/26/8 | 0/0/8/28/**1** (131) | 20 | 7 | 7 | 25 | 14 | 9 | 5 |
| live | monthly | 6 | 0/0/3/3 | 0/0/0/6/0 (71) | 1 | 0 | 0 | 5 | 5 | 4 | 2 |
| live | course | 6 | 0/4/2/0 | 0/0/5/1/0 (16) | 0 | 2 | 2 | 0 | 1 | 0 | 1 |
| live | dates I pick | 1 | 0/1/0/0 | 0/0/1/0/0 (8) | 1 | 1 | 0 | 1 | 0 | 1 | 1 |
| live | festival | 8 | 0/0/1/7 | 0/8/0/0/0 (1) | 0 | 2 | 3 | 1 | 0 | 0 | 0 |
| live | one-off | 11 | 0/1/8/2 | 0/11/0/0/0 | 0 | 10 | 1 | 0 | 0 | 0 | 0 |
| paused | weekly series | 1 | 0/0/1/0 | (79) | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| paused | one-off | 1 | 1/0/0/0 | 1 date | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| ended | weekly series | 13 | 0/4/8/1 | 0/1/9/3/0 (64) | 7 | 13 | 4 | 7 | 1 | 1 | 5 |
| ended | course | 8 | 1/5/2/0 | 0/0/8/0/0 (8) | 0 | 8 | 5 | 0 | 0 | 0 | 1 |
| draft | weekly series | 2 | 2/0/0/0 | 1/0/0/1/0 (52) | 0 | 1 | 2 | 0 | 0 | 0 | 0 |
| draft | one-off | 2 | 2/0/0/0 | 1/1 | 0 | 1 | 2 | 0 | 0 | 0 | 0 |
| archived | (all kinds) | 653 | mostly 0-1 | 298 with 0 dates | 0 | 650 | 631 | 1 | 0 | 0 | 0 |

No `pending_review` or `rejected` series exist today. Occurrence statuses: 3048 `scheduled`, 146 `cancelled`.

Other shapes the screens will meet:

| Shape | Count | Why it matters |
|---|---|---|
| Live or paused series with more than 100 dates | 1 (131 dates) | `admin_event_workspace_p5` returns only the 100 newest dates, so the All dates list and counts line would be wrong. A2 R3. |
| Per-date override rows | 374 | |
| Keys in those rows | `cover_image_url` 226, `venue_id` 190, `description` 187, `city_id` 185, `ticket_url` 74, `gallery` 44, `cancellation_reason_label` 33, `title` 16, `music_styles` 10, `passes` 0 | Per-date name, music and photos are **already in prod data**. The Website editor must show them even before it can write them. |
| Session override rows | 97 | 26 cancelled ("not running"), 30 time changes, 32 title changes, 21 line-up changes |
| Added (date-only) sessions | 41 | |
| A series session overridden on 3 or more dates | 9 sessions (3 of them time changes; at most 6 dates) | These are "this and later" done by hand. A1 does not migrate them; they stay per-date. |
| Courses whose `course_total_sessions` differs from their non-cancelled date count | 2 | `classCount` must be worked out from dates, never read from the column. A2 R2. |
| Monthly rules | 6 `nth_weekday`, 1 `day_of_month`, 1 `{kind, weekday}` | Shape `weekday_except_last` / multi |
| Weekly rules with `interval` other than 1 | 0 | Every 2 weeks is new data |
| Multi-day festivals (more than one programme day) | 11 | |
| Series with room-bound sessions | 18 | |
| Session items with no title | 239 | C3's "No name yet" |
| Session items ending past midnight | 79 | Ends the next day |
| Ended series with `ended_on` | 21 | 0 ended series still have future scheduled dates |
| Cancelled dates with a reason label | 32 of 146 | Older cancels have no reason. The preview must handle null. |
| Series with a `group_chat_url` | 10 | |
| `event_audit_p5` rows (History source) | 4167 | |

---

## 2. Screen → RPC map (every C3 screen and sheet)

"Live" means the RPC exists today. "GAP" means it is part of A1, A2 or A3 below. "Web" means the server
is enough and only Website wiring is missing.

| C3 screen / sheet | Reads | Writes | Status |
|---|---|---|---|
| Home (Next up, Needs you, views) | `organiser_home_v1` (next_dates ≤3, has_own_changes), going RPCs (main, switch off) | none | Live. The views total is not read here; its source is not verified in this slice. |
| Event page (sessions timeline, rows, "Different on N dates", "Extra on …") | `admin_event_workspace_p5` (series + programme + occurrences), `organiser_series_cast_v1` | none | Partly GAP. Per-field "different on" needs `override_keys` (A2 R3). The forward-rule row needs A1's reader. |
| Repeat screen | workspace `series.recurrence_rule` | `series.set_recurrence` | **GAP A2 R1.** The owner path is weekly-only, one weekday, interval 1, ends none/until ≤12 months. |
| Name and details | workspace | `series.upsert` (owner allowlist), `occurrence.set_override` for "Save for this date" | Live, plus Web: add `title`, `music_styles`, `gallery`, `passes` to `OWNER_OVERRIDE_KEYS`. |
| Prices | workspace `passes` | `series.upsert` (`default_passes` validation is in the Website copy table); per date `occurrence.set_override.passes` | Live, plus Web. |
| History | `organiser_series_history_v1` | `organiser_undo_last_change_v1` | Read live, no Website caller. **Undo GAP A3 R2** (upsert only today). |
| Make a copy | none | `admin_duplicate_event_p5` (admin only) | **GAP A3 R3**, owner fork F1. |
| Organiser page | `get_organiser_contact_settings_v1`, `my_profile_progress_v1`, … | `create_organiser_profile_v1` / `submit_organiser_profile_v1` | Live. The WhatsApp column needs a storage decision; it is **out of P3**. |
| Festival page + preview | `event_view_p5` (`snapshot_compat`), workspace | `series.set_program` is **refused for festivals** (owner) | Read live. Programme edit is out of P3 (#24). |
| Save errors | n/a | every command | Live codes; see A3 R1. |
| Session sheet (What is it, name, times, room, level, line-up) | workspace programme | `series.set_program` (every date) | Live for "Every date". |
| Session scope ("Which dates?": Every / From X on / Just X) | | Every: `series.set_program`. Just X: `organiser_set_occurrence_programme_v1`. From X on: **GAP A1**. | GAP A1 |
| Remove from every date | | `series.set_program` (refuses an item with per-date overrides: `permission_denied`, matched by COMMAND_COPY) | Live |
| Date sheet (sessions, add a session to this date only, not running) | `event_view_p5 {occurrence_id}` + `organiser_get_occurrence_programme_v1` | `organiser_set_occurrence_programme_v1` | Live (refused on cancelled, past, multi-day, ended dates) |
| Change the time on this date | | `occurrence.set_time` (`reset:true` to undo) | Live (not festivals) |
| Move to another day | | `occurrence.move_date` (`date_taken`) | Live |
| Skip this week (break) / Put this week back | | `series.skip_date` / `series.unskip_date` (`has_bookings`) | Live. Course re-counting is A2 R2. |
| Put this date back to normal | | composite: `occurrence.set_override` with null payload + `occurrence.set_time reset` + programme save with no deltas | Live as three calls. A one-call `occurrence.reset` is optional; not proposed. |
| Copy changes from another date | source date reads | composite of the writes above | No single command. **Out of P3** (see #148 and 6). |
| Different details this date (Where, About, Ticket) | `event_view_p5` | `occurrence.set_override` (`venue_id`, `description`, `ticket_url`) | Live |
| Line-up sheet (per session, scopes) | cast + programme | every date `series.set_program`; this date `organiser_set_occurrence_programme_v1` `people_add/remove`; this and later **GAP A1** | GAP A1 |
| Status sheet / Hide / Show / Back to draft | workspace | `series.set_lifecycle` (live↔paused, →archived; draft→live) | Live. "Back to draft" from live is **not** an owner transition today: grey it out with a reason. |
| End it | | `series.end_run` (`today_session` ran / not_running) | Live |
| Stop repeating | | `series.stop_repeating` (`keep_occurrence_ids`) | Live |
| Cancel a date / bulk cancel / bulk more | | `occurrence.cancel` (+reason), `admin_bulk_occurrence_command_p5` `occurrence.bulk_cancel` / `bulk_shift` | Live (`bulk_shift` refuses weekly/monthly with `contract_violation`) |
| Chat (WhatsApp group link) | workspace | `series.set_group_chat` (https only) | Live |
| Socials, video, gallery photo, cover | workspace | `series.upsert` | Live. The owner allowlist for `video_urls` and social keys was **not read in full**. |
| Change the kind (convert) | | `series.collapse_to_one_off` is named in a message only; it is not in `command_dispatch_p5` | GAP, **out of P3** (C3 already toasts "phase 4") |
| Going (Home, date, page, Stats) | going RPCs on main (`get_my_event_going_v1`, `get_my_organiser_going_total_v1`, …) | none | Live on main, switch off |
| Theme, tour, leave guard, tray, error sheet, video error | none | none | Client only |
| All dates (counts, filters, Find a date, Class n of 8) | workspace occurrences (100 newest) | | **GAP A2 R3** (cap and per-key changes) |

---

## 3. Gap list with proposed contracts

All new commands go through the existing envelope (`series_command_p5` / `occurrence_command_p5` →
`apply_aggregate_write_p5`). That gives them, unchanged:
- `idempotency_key` (required) via `command_idempotency_p5`, with replay returning `idempotent_replay:true`
- `expected_version` → `version_conflict`
- `event_audit_p5` rows (so History sees them)
- the daily cap of 100
- the owner/manager ACL (`_assert_can_edit_series_p5` and `v_owner_member_kinds`)
- the past-date rule

Each new kind needs a row in `command_dispatch_p5`, a label in `_organiser_audit_kind_label_v1`, and an
arm in `_command_failure_code_p5` for any new message prefix.

### A1: "This and later" as ONE forward rule on a series session

**Storage (new table):** `event_series_program_item_forward_p5`
- Columns: `id`, `item_id` (FK to `event_series_program_item_p5`, ON DELETE CASCADE), `from_date date`,
  `patch jsonb`, `created_at`, `updated_at`
- `unique(item_id, from_date)`
- The patch keys are a subset of: `title`, `start_time`, `end_time`, `ends_next_day`, `level_keys`,
  `room`, `venue_room_id`, `people` (a full replacement list of `{profile_id, profile_type, role, sort}`)
- **`type` is not allowed.** Changing the kind of a session is "every date" only. This keeps
  event-truth P1's derived category a function of the base items (section 5).

**Resolution (one SQL function, the only place it happens):** `_effective_series_item_p5(item_id, occurrence_date) returns record`
1. Start from the base item.
2. Apply every forward row with `from_date <= occurrence_date`, oldest first, so the latest wins per key.
3. Apply `event_occurrence_session_override_p5` for that date (per-field COALESCE, as today).

`cancelled` comes only from step 3. A forward rule never touches it, so "not running" on a later date
survives.

**Command:** `series.set_session_forward` (owner, member kind)

Payload:

```json
{ "item_id": "uuid", "from_date": "YYYY-MM-DD", "patch": { ... } }
```

- Pass `"patch": null` to remove that forward row ("Undo" from the From-row).
- Rules:
  - `from_date` must be on or after today (London). Past → `permission_denied: forward_from_past`, which
    is the same tag `apply_forward_from` already uses.
  - It must be a date the series generates, or an existing occurrence. Otherwise
    `invalid_payload: from_date_not_a_series_date`.
- Side effect, in the same transaction:
  - For every occurrence with `occurrence_date >= from_date`, drop the **same keys** from that date's
    `event_occurrence_session_override_p5` row. Keep `cancelled` and `cancellation_reason_label`.
    Delete the row if nothing is left.
  - For `people` in the patch, clear `people_added`, `people_modified` and `people_removed` on those rows.
  - This is C3's "later dates' own changes to the same fields are dropped". The response lists them, so
    the scope sheet's consequence line and the History row can name them.
- Output (`data`):
  - `{forward_id, from_date, keys[], dropped:[{occurrence_id, occurrence_date, keys[]}], kept_not_running:[occurrence_date]}`
  - plus the envelope's `new_version` / `audit_id`
- **Dry run:** `"dry_run": true` in the payload returns the same `data` and writes nothing. It writes no
  audit row and uses no idempotency slot. C3 needs this to draw the consequence line *before* the tap
  (fix-pass #5 and #11).
- Errors:
  - `invalid_payload: patch key % not allowed` (this includes `type`)
  - `invalid_payload: item_id does not belong to this series`
  - the existing time and people validations (shared with `_owner_program_problem_p5`: 5 min-12 h,
    20 people, roles `teaching`/`djing`/…)
  - `version_conflict`
  - `permission_denied: % on a festival is admin-only` (festival programmes stay admin-edited)
  - `permission_denied: % on an ended series is admin-only`
- Idempotency: the envelope key. Re-sending the same patch for the same `(item_id, from_date)` is a no-op
  upsert.

**Interaction with existing commands:**
- `series.set_program` deleting an item cascades its forward rows. The existing "item has per-date
  overrides" refusal is extended to forward rows: `permission_denied: removing the session would delete
  its later changes`. Add this to COMMAND_COPY.
- `series.set_program` changing a base key that a forward row also sets: the base changes and the
  forward row still wins from its date. That is correct, because it is "Every date" up to the From date.
- `admin_duplicate_event_p5`: copy the forward rows only when `copy_dates`.

**Readers that must call the resolver (all server-side; no client merge):**
- `_organiser_programme_rows_p5_v1` and `organiser_get_occurrence_programme_v1` (date sheet)
- `get_occurrence_program_v1`, and through it `get_occurrence_override_program_v1` and
  `event_view_p5` `legacy_compat` / `native` (public schedule)
- `get_calendar_events_v2` (the session start/end/title it aggregates)
- `_p5_occurrence_program_end_v1` and the materialiser that stamps
  `materialised_start_utc` / `materialised_end_utc`. A forward time change must **re-stamp** every
  affected future occurrence in the same transaction, or calendar ordering drifts. CI guard
  `check-occurrence-p5-materialised-canonical` would catch this.
- `organiser_series_cast_v1`: forward `people` count as "people set on dates still to come" (C3 #17).
- `admin_event_workspace_p5`: add `program_forward:[{id, item_id, from_date, patch}]` so the event page
  can draw "From Fri 20 Nov: 8:30pm to 9pm". This is additive; old readers ignore it.

**Why not reuse `series.apply_forward_from`:**
- It writes values into each date's override row. That is the shape C3's walk rejected: N one-off
  changes, every chip dotted.
- It can only reach dates that already exist. With the owner cap of 30 upcoming dates and the 12-month
  horizon, a no-end weekly series silently stops having the change once the nightly top-up adds new dates.

### A2: Repeat rules, regeneration, course counting, per-date details

**R1. Widen the owner path of `series.set_recurrence`** (`_owner_weekly_rule_problem_p5` → `_owner_rule_problem_p5`):
- Allowed rule modes:
  - `weekly` with 1 to 7 `weekdays`, `interval` 1 to 4
  - `monthly` with `kind` in `day_of_month` | `nth_weekday` | `multi_nth_weekday`
- Allowed ends:
  - `none`
  - `until_date` up to 24 months
  - `after_count` from 1 to 500
- Run `_validate_recurrence_payload_v1` on **every** caller. Today `_cmd_series_set_recurrence_p5` skips
  it, so an admin's rule through this kind is unvalidated. That is a live bug; fix it in the same
  migration.
- Regeneration stays `_reconcile_series_occurrences_after_rule_change_p5_v1`. Curated dates (any override,
  added session or session override) are spared, and booked dates are cancelled, not deleted.
- **Dry run:** `dry_run:true` returns
  `{will_add:[date], will_remove:[date], will_cancel_booked:[date], keeps_own_changes:[date], next_8:[date]}`.
  C3's red "This removes N dates already on the calendar" and "N dates keep their own changes" need it
  before the tap.
- Errors:
  - `invalid_recurrence_payload` (22023) with sub-reasons: `interval_out_of_range`, `count_over_cap`,
    `until_too_far`, `mode_not_allowed`
  - `has_bookings` is never raised; booked dates are cancelled and reported instead
- "Dates I pick" (`mode=custom`) stays admin-only through `set_recurrence`. Owners build it with
  `series.add_date` and `series.stop_repeating`. That is already live.

**R2. Course counting (classes exclude breaks and cancelled):**
- For `format=course` with `end.kind=after_count`, generation counts **only dates that will run**. It
  skips `removed_dates` (breaks) and cancelled occurrences, so skipping a week appends a class (C3 #10).
- Server-derived `class_count` (non-cancelled, non-break dates) and `last_class_date` go into the
  workspace payload.
- `course_total_sessions` is written equal to `count` by `set_recurrence`. The 2 drifted rows get a
  one-off data fix in the admin migration.
- Error: `invalid_transition: course_needs_count` when a course rule has no `after_count`.

**R3. Workspace reader:**
- `admin_event_workspace_p5` gains `override_keys text[]` per occurrence (from `overridden_keys`) and
  `session_change_kinds text[]` (`time` | `title` | `not_running` | `people` | `extra`).
  - This lets "Different on N dates" sit under Where / About / Ticket (C3 #63) and lets the All dates
    plain words come from the server.
- It also gains `meta.total`, `meta.counts {upcoming, past, cancelled, changed, breaks}` and paging
  (`p_before date`, `p_limit ≤ 200`), so a 131-date series lists fully.
  - Additive: the existing 100-newest default stays for old callers.

**R4. Per-date name, music, photos, price:**
- **No new server command.** `occurrence.set_override` already accepts `title`, `music_styles` (≤20),
  `gallery` (≤30), `cover_image_url` and `passes` for owners. They are admin-only on a cancelled date
  (`permission_denied: occurrence_cancelled`).
- Website: add those keys to `OWNER_OVERRIDE_KEYS` and the field labels.
- **One reader gap:** `get_calendar_events_v2` returns `es.default_music_styles`, not the per-date
  effective value. 10 live override rows set `music_styles`, so calendar music filters disagree with the
  event page for those dates. The fix is `_effective_occurrence_text_array_p5(eov,'music_styles',…)`,
  admin migration A2.
- The calendar also aggregates `pi.title` for session titles. Whether it applies session-override titles
  was **not verified** in this slice; A1's resolver makes that question moot.

**R5. The 500 cap:** see owner fork F2. The server has no 500-date generation cap today. The real limits are:
- 30 upcoming materialised dates for owners (`held_back`, topped up nightly)
- the 12-month horizon
- `after_count ≤ 520`
- 500 as the cap for `apply_forward_from` and bulk commands

### A3: Error codes, History/Undo, Make a copy

**R1. Error codes.**
- The client reads the message prefix. The live prefix set is:
  - `permission_denied`
  - `invalid_payload`
  - `invalid_recurrence_payload`
  - `invalid_transition`
  - `not_found` / `series_not_found` / `occurrence_not_found`
  - `version_conflict`
  - `bulk_too_large`
  - `contract_violation`
  - `has_bookings`
  - `past_date`
  - `publish_blocked`
  - `no_sessions_for_time_override`
  - `room_in_use_by_session`
  - `not_undoable`
  - `undo_conflict`
  - `viewer_role_mismatch`
  - `invalid_viewer`
  - `invalid_target`
  - `not_signed_in` / `not_a_member` (42501)
- C3's ERRS list of 12 lacks `contract_violation` and `has_bookings`. **Both are already raised:**
  - `contract_violation` by bulk shift
  - `has_bookings` by remove_date and skip_date
- **The Website's `COMMAND_COPY` already matches both**, so the gap was in the mockup, not the product.
- Server change: `_command_failure_code_p5` has no `has_bookings` arm, so failed audit rows file it as
  `unknown`. Add the arm.
- New in A1-A3: `from_date_not_a_series_date`, `course_needs_count`, `forward_from_past` (existing tag),
  and the undo refusals below.
- Website: one `L.errors` map keyed by prefix, which is the existing `COMMAND_COPY` plus the new tags.
  Never two copies.

**R2. History and Undo.**
- Read: `organiser_series_history_v1(p_series_id, p_limit ≤100, p_before)` is live. It returns
  `items[{at, kind, label, who: you | the Bachata team | a co-host, date, fields[]}]` and ACL errors
  `not_signed_in` / `not_a_member` (42501).
  - Add `audit_id` and `undo: {possible bool, reason text}` to each item. Additive.
- New command: `organiser_undo_change_v1(p_series_id uuid, p_audit_id uuid)`. Plain RPC like the
  existing undo. It calls the command surface with `undo_of` and a fresh idempotency key.
- Undoable kinds and what undo writes:

  | Kind | Undo writes |
  |---|---|
  | `series.upsert` | Today's logic |
  | `occurrence.set_override` | The `before` override row |
  | `occurrence.set_time` | `reset` or the before state |
  | `occurrence.cancel` | Uncancel / recancel |
  | `series.skip_date` | `unskip_date` |
  | `series.set_session_forward` | Delete the forward row, or restore the before patch. The dropped per-date keys come back from `before`. |
  | `occurrence.set_session_delta` (programme save) | The before sessions |

- Not undoable (the reason is shown):
  - `series.set_lifecycle`, `series.end_run` (point to the Status sheet)
  - `series.set_recurrence`, `series.stop_repeating` (dates were deleted or cancelled; point to Repeat)
  - bulk commands
  - anything older than the window (fork F3)
- Refusals:
  - existing: `not_undoable: …`
  - `undo_conflict: the same thing changed after this change`. This is checked per target and key, not
    "anything on the series", so two edits to different dates can each be undone.
  - `permission_denied` (same ACL as the command)
- Idempotency: the undo's own envelope key, plus "an audit row is undone at most once"
  (`not_undoable: already undone`).
- Keep `organiser_undo_last_change_v1` as is for older callers.

**R3. Make a copy (fork F1).**
- Proposed: `organiser_copy_event_v1(p_envelope)` with kind `series.copy` and payload
  `{name, first_date}`.
- ACL: caller owns or manages the source (`_assert_can_edit_series_p5`). The source can be in any
  lifecycle, including ended (C3's ended Summer Camp).
- It reuses `admin_duplicate_event_p5`'s copy logic: `copy_dates:false`, `as_template:false`,
  `default_start_date = first_date`, lifecycle `draft`, slug null.
- It also copies `gallery`, `video_urls`, `passes`, socials and `group_chat_url`. Admin duplicate
  drops these; C3's "what is / isn't copied" list says they are copied. Do this unless the owner says
  otherwise.
- It does not copy per-date changes, breaks, forward rows or rooms.
- Quota: counts toward the existing 20-series-per-day create quota (`permission_denied: quota_exceeded`).
- Output: `{new_series_id}`.
- Errors:
  - `invalid_payload: name_required`
  - `permission_denied: first_date in the past`
  - `not_found`

### Sizing as admin migrations

| Migration | Contents | Size |
|---|---|---|
| A1 | Forward table, `_effective_series_item_p5`, `series.set_session_forward` (+ dry_run), reader rewires (6 functions), re-stamp of materialised times, workspace `program_forward`, set_program cascade/refusal, duplicate copies forward rows | L. The reader rewires are the risk; one resolver keeps them consistent. |
| A2 | Owner rule widening + validator on every path + dry_run; course counting + `class_count`; workspace `override_keys` / `session_change_kinds` / counts / paging; calendar per-date `music_styles` | M |
| A3 | Failure-code arm for `has_bookings`; history `audit_id` + `undo`; `organiser_undo_change_v1`; `organiser_copy_event_v1` (if F1 = yes) | M |

Order: A2 R3 (workspace reader) first, because every Website screen reads it, then A1, then A3. The Website
can start on screens that are "Live" or "Web" in section 2 before any migration lands.

---

## 4. Per gap: Website readers/writers that break, and CI checks to add

| Gap | Website code affected | CI contract checks to add (`scripts/check-*.mjs`, run from `db-contract-check.yml`) |
|---|---|---|
| A1 forward rule | Organiser `parseWorkspace` (`shared/seriesModel.ts:83`) must tolerate and then use `program_forward` (additive, so nothing breaks if ignored). The date sheet (`programmeModel.ts parseProgramme`) shows resolved values, so it needs no change. Public readers `EventScheduleGrid.tsx` (`useOccurrenceOverrideProgram` :203, `useOccurrenceProgram` :452) and `ScheduleBlock.tsx:1104` stay correct **only if** the server resolves. If any reader is missed, dancers see the old time after the From date. Calendar `eventRpcs.ts:379` and `wallClock.ts` depend on re-stamped materialised times. | `check-program-forward-resolution.mjs`: pg_proc guard that every programme reader in the list above calls `_effective_series_item_p5`, plus a live probe: for each forward row, the effective start at `from_date` equals the patch unless a per-date override exists. `check-program-forward-materialised.mjs`: no future occurrence whose `materialised_start_utc` disagrees with its resolved first session (extend `check-occurrence-p5-materialised-canonical` if cleaner). |
| A2 R1/R2 rules + course | `series.set_recurrence` callers (`events/eventModel.ts`) build weekly-only payloads today; still valid. New: Repeat screen payloads. `classCount` must read `class_count`, never `course_total_sessions` (2 drifted rows). | `check-owner-recurrence-validated.mjs`: pg_proc guard that `_cmd_series_set_recurrence_p5` calls `_validate_recurrence_payload_v1`. `check-course-count-contract.mjs`: for live courses with `after_count`, the number of non-cancelled, non-break dates equals `count` (counts only). |
| A2 R3 workspace | `parseWorkspace` / `parseEventWorkspace` (`events/eventModel.ts:46`): additive keys; nothing breaks. The 100-row cap breaks the All dates list for 1 live series today (131 dates). | Extend an existing workspace check, or add `check-workspace-p5-shape.mjs`: `meta.total` equals the occurrence count; `override_keys` equals `overridden_keys`. |
| A2 R4 per-date details | `OWNER_OVERRIDE_KEYS` (`seriesCommands.ts:112`) must gain 4 keys (Website). Public: `useEventPageQuery.ts:372` / `festivalEventQuery.ts:50` already get effective values from `snapshot_compat`, so no break. Calendar music filter is wrong today for 10 dates (server fix). | `check-calendar-effective-overrides.mjs`: pg_proc guard that `get_calendar_events_v2` reads `music_styles` through `_effective_occurrence_text_array_p5`. |
| A3 R1 errors | `selfServeErrors.ts` `COMMAND_COPY` (:144): add the new tags. `has_bookings` and `contract_violation` are already matched. | `check-command-failure-codes.mjs`: every message prefix raised by a `command_dispatch_p5` handler has an arm in `_command_failure_code_p5` (catches today's `has_bookings` miss). |
| A3 R2 history/undo | No caller today. The existing COMMAND_COPY `undo_conflict` / `not_undoable` regexes are reused. | `check-undo-contract.mjs`: every kind listed as undoable has a dispatch handler that accepts `undo_of`; the history item shape has `audit_id`. |
| A3 R3 copy | `parity-matrix.test.ts:327` asserts `admin_duplicate_event_p5` is absent (DROPPED-BY-DECISION). If F1 = yes, that row changes to the new RPC. | `check-organiser-copy-acl.mjs`: pg_proc guard that `organiser_copy_event_v1` asserts edit rights on the source and never sets lifecycle other than `draft`. |

Existing guards to keep in mind:
- `check-no-legacy-program-rpcs.mjs`: new Website code must read `event_view_p5`, not `get_occurrence_program_v1`.
  `EventScheduleGrid.tsx:208` still calls `get_occurrence_override_program_v1` directly.
- `check-event-truth-v1.mjs`: category drift only shrinks.
- `check-occurrence-delete-booking-safety.mjs`
- `check-going-rpcs.mjs`

`db-contract-check.yml` has 54 `Run` steps today. Count, don't pin:
`grep -c '^      - name: Run ' .github/workflows/db-contract-check.yml`.

---

## 5. Conflicts

**Event-truth P1 (eventCategory; the Type is derived from sessions).**
- PR #750 / branch `feat/event-truth-p1p3` was **not found**. `git ls-remote origin 'feat/event-truth*'`
  is empty, and no commit message mentions it.
- What is on `main`:
  - `src/lib/eventCategory.ts` (byte-pinned twin of admin's, SQL twin `_derive_series_category_v1`)
  - `scripts/check-event-truth-v1.mjs` (P0 floor: drift only shrinks)
  - organiser comments saying the server derives category from sessions and ignores a sent value
- Conflicts and resolutions:
  1. A forward rule that changed a session's `type` would make the derived category date-dependent.
     **Resolved by A1 forbidding `type` in a forward patch.** The kind changes for every date or for one
     date (added sessions are already date-only and already in the derivation).
  2. C3 "Kind is a read-only word from sessions, never a picker" agrees with P1. The Website must render
     it with `categoryWord` / `wordForStored`, not a new mapping (one shared mapping rule).
  3. Make a copy must not send `category`. The server derives it.
- If #750 exists under another name, its P1 SQL must land before A1, so the derivation reads base items
  only and A1 does not need to touch it.

**Going / people on main.**
- Going is merged with its switch off: #992, #998 (organiser who-is-going parts, not mounted), #1018
  (Stats going total, not mounted), and the `check-going-rpcs` guard for six RPCs.
- C3's Who's going (Home, date sheet, page, Stats) consumes these as they are. P3 mounts
  `OrganiserGoing.tsx` / `GoingTotalStat.tsx` only when both `organiserP3` and the going switch are on.
  No server gap, no conflict.
- People S1-S8 (#980 … #1019): line-up chips use `organiser_series_cast_v1` and
  `organiser_search_people_v1`. A1 changes `cast` to include forward `people`. That is an additive
  meaning change, flagged for whoever owns the people arc.
- The view-count sources for Stats were not read in this slice.

**Feature flag.** There is no `organiserP3` yet. Flags live in `src/lib/featureFlags.ts` as Vite env
booleans, for example `organiserSelfServe` → `VITE_ENABLE_ORGANISER_SELF_SERVE`. Add `organiserP3` →
`VITE_ENABLE_ORGANISER_P3` (default off) in the first Website slice. The organiser module also has
`parityGate.ts` `AW1_APPLIED` as a code constant; keep the two separate.

---

## 6. C3 open items: inside P3 or not

| Item | In P3? | Recommendation |
|---|---|---|
| #24 festival programme stubs | **No** | Owners cannot write a festival programme (`series.set_program` refuses festivals; 11 multi-day festivals). Keep the festival page read-only for the programme with "Ask us to change the programme". Phase 4. |
| #25 "Removed 1 empty session" when a name was typed | Yes | Website-only bug; fix in the session-sheet slice. |
| #26 tray + leave guard only on Name and details; no confirm on "Undo my changes" | Yes | Website-only. One save-model component for every edit screen. |
| #27 error codes (`contract_violation`, `has_bookings`) | Yes | Already raised and already in `COMMAND_COPY`; the gap was the mockup. A3 R1 adds the classifier arm and new tags. |
| #28 monthly copy, undo Stop repeating, History Undo, regeneration, max-500 note | Partly | Regeneration exists and only needs the owner rule widened (A2 R1). History Undo is A3 R2. Undo of Stop repeating stays not undoable, with the reason shown. Copy of a monthly is A3 R3, which copies the rule. Max-500 note: F2. |
| #59 / #106 per-date name, music, photos, price | **Yes** | The server already accepts them for owners. This is Website keys + UI, plus the calendar music reader fix (A2 R4). Cheapest win in the list. |
| #63 "Different on N dates" under Where / About / Ticket | Yes | Needs `override_keys` in the workspace (A2 R3). |
| #71 no grouping by kind | Yes (decision) | No server impact. Recommend accepting the kind chip per row. |
| #81 room chips in the main session sheet | Yes | Website-only. Rooms stay admin-defined (`series.set_rooms` is admin-only). Show chips only at venues with 2+ rooms (18 series have room-bound sessions). |
| #148 per-date changes save instantly, nothing queues | **No** | Keep instant saves + Undo toast + History. A queue would need a draft layer server-side, which nothing in A1-A3 provides. "Copy changes from another date" also stays out (no single command; composite writes would not be atomic). |

**Owner forks:**
- **F1. Make a copy for organisers?** The parity matrix row C33 says DROPPED-BY-DECISION. C3 D42 draws it.
  Recommend **yes** (A3 R3). It is a small RPC and the main path to a new season of a course.
- **F2. The "max 500 dates" note.** No 500-date generation cap exists. Recommend replacing it with the
  real limit organisers can hit: "Stops after" up to 500 (enforced in A2 R1). Show nothing for open-ended
  rules, because the 30-date owner horizon is topped up nightly and is invisible to them.
- **F3. Undo window.** The server today allows 24h rolling. C3's help says "For changes from today, open
  History". Recommend **until the end of the London day** for History Undo (matches the copy; simpler to
  explain), and keep the immediate toast Undo.
