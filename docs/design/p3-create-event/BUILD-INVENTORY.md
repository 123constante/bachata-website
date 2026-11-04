# P3 create event: build inventory (slice 1, Step 1)

Every row of the design inventory (`docs/design/p3-create-event/INVENTORY.md` on
`origin/claude/p3-create-mockups`, 63 rows) re-checked against the LIVE sources on 2026-10-30:
prod `stsdtacfauprzrdebmzg` (read-only `pg_proc` / `information_schema` / counts, no writes) and
the Website code on `main`. Eight admin-visible columns the inventory lacks are added as #64-#71.

**Verdicts.**
- **BUILT**: slice 1 builds it in the new P3 create flow under `/account/p3`, with NO database
  change, using RPCs/columns that exist today.
- **DEFERRED-slice-2**: no database change needed (the server already admits it), but it is
  outside slice 1's scope.
- **DEFERRED-needs-admin**: needs a server command, owner key or column first. The missing piece
  is named.
- **EXCLUDED**: not part of create (reason given).

## The write path (proved)

All create writes go through ONE RPC, `series_command_p5(p_envelope jsonb) -> jsonb`. Its body
calls `_require_onboarding_complete_v1(_command_target_organisers_p5(p_envelope))`, then
`apply_aggregate_write_p5`. On a refusal it writes an audit row and raises the error again.

- **Create** = `series.upsert` sent to a `target_id` that has no row yet. `_cmd_series_upsert_p5`
  inserts `COALESCE(p_series_id, gen_random_uuid())` with `lifecycle_status = 'draft'` (body
  l.316-360, l.345). It returns `data = {series_id, is_create, first_date_occurrence}` (l.471),
  wrapped by `_command_result_ok_p5` as `{ok, new_version, data}`.
- **Website wrappers.**
  - `shared/selfServeApi.ts`: `runSeriesCommand(env)` and `createSeriesCommand(payload, organiserId)`.
    The second adds `organiser_ids: [id]`.
  - `shared/seriesCommands.ts`: `envelope(targetId, version|null, command, key)`,
    `newSeriesId()`, `createDraftPayload(name, format)` = `{name, format, timezone:'Europe/London'}`,
    and `upsertCommand(payload)`.
  - R1 calls them in `flows/new/NewFlow.tsx:142` (NameStep). Later steps go through
    `flows/new/useNewSend.ts`, which re-reads the series with `fetchSeriesWorkspace` and then sends
    each command against the `new_version` the previous one returned. Each command keeps one
    idempotency key.
- **What the create upsert can carry for an owner** (`apply_aggregate_write_p5`
  `v_owner_create_keys`, l.68-74):
  - basics: name, slug, venue, city, start date, start time, duration, level, ticket url,
    description, cover, music styles, gallery, videos, timezone, format, organiser_ids, category
  - price: passes, instagram, payment_methods
  - festival only: starts_at / ends_at / default_start_time / default_end_time
- **What it can NOT carry:** a repeat rule (no `recurrence_rule` key) and sessions. Those are
  separate commands.
- **Format on create** (`_cmd_series_upsert_p5` l.186-189): one_off, recurring or festival. A
  course is refused at create. A course can be reached afterwards through the A2 convert
  (`format` + `course_total_sessions` are owner upsert keys, l.60-64 and l.272-283).

**Fixed order for slice 1** (one `series_command_p5` call per step, each at the previous
`new_version`):

1. `series.upsert` create. Payload: `createDraftPayload(name, format)` plus `organiser_ids`,
   `default_venue_id`, `default_city_id` (`shared/createCity.resolveCreateCityId`),
   `default_start_date`, `default_cover_image_url`, `payment_methods`, `default_passes`, and
   `default_ticket_url` when set. Everything on the create-keys list can ride this one call.
   Upload the cover first with `uploadEventPicture(seriesId, file)`: the id is chosen on the
   client, so the upload folder exists before the row does.
2. `series.set_recurrence` (recurring only). Payload: `rulePayload(draft)` from
   `p3/model/repeat.ts` (`repeatPlan` / `previewCommand` are the builders, `p3/data/repeat.ts`
   `previewRepeat` is the dry-run wrapper). The rule is checked against `_owner_rule_problem_p5`
   (weekly 1-7 days, interval 1-4, monthly day_of_month / nth_weekday / multi_nth_weekday,
   end none / after_count 1-500 / until_date up to 24 months).
3. `series.set_program` `{days:[...]}`: the whole sessions tree. Built with
   `p3/data/sessions.ts` `everyAdd(tree, form)`, sent through `useEverySend(ws)`, behind
   `AW1_APPLIED = true`.
4. Optional: `series.set_lifecycle {to:'live'}` (`lifecycleCommand('live')`, `A1_APPLIED = true`).

Prices can instead go after step 1 through `p3/data/prices.ts` `pricesPlan(ws, base, draft)`,
which sends one `series.upsert` with `default_passes` and `payment_methods`.

**Times live on sessions.** Leave out `default_local_start_time`. R1 does send it
(`flows/new/model.ts timeCommands`), but slice 1 must not.

**Risk to check in build:** `_materialise_series_occurrences_p5_v1` l.67-71 fills an
occurrence's `starts_at` / `ends_at` ONLY from the series' default time. Without one they stay
NULL. Before dropping the series time, check what reads occurrence `starts_at`.

**Go-live gate** (`_series_go_live_check_p5`): `ready` needs all of these:
- venue and city
- an upcoming scheduled date
- a program item with a title and both start and end times
- a cover or poster
- a first date that is not past
- no half-filled session times
- `payment_methods`: the `no_payment` code, l.91-93
- the profile fields

**No series on prod has `payment_methods`** (survey below). Price basics is therefore REQUIRED
for go live, and R1 never sends it. Owner transitions (`_owner_lifecycle_transition_allowed_p5`):
draft -> live | pending_review | archived.

**Failure midway.** Each step is its own transaction. Once step 1 lands, the draft exists, owned
by the page, with `lifecycle_status = 'draft'`. Organisers see it in two places:
- P3 Home's "Needs you" row ("X is still a draft", `p3/data/home.ts:196-201`)
- the Draft tag (`p3/model/status.ts:30`)

A retry with the same idempotency key replays the stored answer. The server stores an answer
only when the call succeeds (`p3/data/sessions.ts` note).

**Discard.** `series.set_lifecycle {to:'archived'}`, allowed for draft -> archived:
- P3: `removeCommand()` (`p3/data/eventPage.ts:285`), used by `p3/screens/StatusSheet.tsx:174`
- R1: `LifecycleActions.tsx:162` "Discarded"

Hard delete is admin only (`admin_delete_series_p5_v1`).

**Onboarding refusal.** `_require_onboarding_complete_v1` raises SQLSTATE P0001 with:
- MESSAGE `onboarding_incomplete`
- DETAIL `{"missing":[...],"organiser_id":...}`
- HINT `Finish your details`

It only runs when the flag `organiser_onboarding_gate` is on, and that flag is **OFF** on prod
today. The Website matches the error with `ONBOARDING_REFUSAL_MATCH` / `isOnboardingRefusal`
(`shared/selfServeErrors.ts:152-156`) and shows the copy "Finish your details first, then you
can add or change your events.".

**No gate screen exists on main.** What does exist:
- `p3/onboarding/graceModel.ts` + `statusQuery.ts` feed `p3/screens/GraceBanner.tsx`, a dismissable
  banner on Home only, and `p3/you/YouScreen.tsx`.
- The full flow is `p3/onboarding/OnboardingFlow.tsx`.

Other create refusals: `permission_denied: series.upsert (create) needs a live organiser` and
the 20-per-24h quota (`apply_aggregate_write_p5` l.605-618).

**Helpers.**
- **Venue search:** `shared/publicVenues.ts`.
  - `useVenueOptions()` -> `get_organiser_venue_options_v1` (all venues: id, name, neighbourhood,
    city_name, address, postcode), falling back to the public list.
  - The filter runs on the client and shows 50 rows (`NewFlow.tsx:34,184`).
  - Nothing found: an EmptyState "No venue matches / Try another word from its name."
    (`NewFlow.tsx:200`).
- **Cover:** `events/media.ts` `uploadEventPicture(seriesId, file)` -> URL. The checks and
  re-encode are `shared/flyerModel`, the upload is `shared/flyerUploadApi.uploadFlyer`, and errors
  come back as plain copy.
- **Pages:** `useOrganiserChoice()` (`organiser/switch/useOrganiserChoice.ts`, re-exported from
  `profile/`) reads `organiser_home_v1` and returns `{organisers, selected, choose}`.
  `flows/new/whichPageModel.ts` `needsPagePick(count, params)` asks only when there are 2+ pages,
  and the screen is `flows/new/WhichPage.tsx` `WhichPageStep`.

## Rows

| # | Field | Verdict | Evidence / what is missing |
|---|---|---|---|
| 1 | Format picker | BUILT | create admits one_off / recurring / festival (upsert l.188). Slice 1 tiles: one date, weekly, monthly, workshop, class-then-party, other dates. All map to one_off or recurring |
| 2 | Course | DEFERRED-slice-2 | Server path exists: create recurring, then `set_recurrence` after_count (fills `course_total_sessions`, set_recurrence l.72), then upsert `format:'course'` (A2 convert, aggregate l.272-283, l.790-814). The Website mirror `OWNER_UPSERT_KEYS` lacks `format` / `course_total_sessions` (client change only). Not in slice 1 scope, so the tile is "coming soon" |
| 3 | Festival | DEFERRED-slice-2 | Owner festival create admitted (upsert l.188, l.257-313; create keys starts_at / ends_at / default_start_time / default_end_time, aggregate l.74). Website `OWNER_CREATE_KEYS` lacks them (client change only). Days 1-14 |
| 4 | Workshop (one day, several classes) | BUILT | one_off + several class sessions in `set_program` |
| 5 | Category | EXCLUDED | Never asked: derived from the sessions by the server (`upsertCommand` strips it) |
| 6 | Online (`livestream_url`) | DEFERRED-needs-admin | Column exists, but `livestream_url` is NOT an owner create/upsert key (aggregate l.60-74) |
| 7 | Class, then party | BUILT | Two items in `set_program` (class + party) |
| 8 | Which page (2+) | BUILT | `needsPagePick`, `useOrganiserChoice` |
| 9 | Name (120) | BUILT | create key `name`. The input is `maxLength={140}` (`CreateFlow.tsx`); the 120 limit is a validation check that blocks Save with its reason (`model.ts`) |
| 10 | Description | DEFERRED-slice-2 | owner key `default_description` |
| 11 | City | BUILT | `resolveCreateCityId` from the venue, sent in the create |
| 12 | Venue search | BUILT | `useVenueOptions` |
| 13 | New venue / not found | DEFERRED-slice-2 | `owner_create_venue_draft_v1(p_name, p_postcode, p_lat, p_lng, p_address, p_area)` + `owner_similar_venues_v1` EXIST on prod (organiser seat, UK postcode, lat/lng required, 5 a day). Unused by the Website. Needs a geocode step |
| 14 | Co-hosts | DEFERRED-slice-2 | `series.set_organisers` (AW1). The create names one page only (l.75-81) |
| 15 | Cover photo | BUILT | `uploadEventPicture` + `default_cover_image_url` in the create |
| 16 | Gallery | DEFERRED-slice-2 | owner key `default_gallery` |
| 17 | Video links | DEFERRED-slice-2 | owner key `default_video_urls` |
| 18 | One date | BUILT | one_off + `default_start_date`. The draft gets its first occurrence (`_ensure_first_date_occurrence_p5_v1`, upsert l.469) |
| 19 | Weekly, one day | BUILT | `rulePayload` weekly |
| 20 | Weekly, several days | BUILT | `_owner_rule_problem_p5` weekly 1-7 |
| 21 | Every N weeks | BUILT | interval 1-4 |
| 22 | Monthly nth weekday | BUILT | `nth_weekday` |
| 23 | Monthly several nth | BUILT | `multi_nth_weekday` |
| 24 | Monthly day of month (29th-31st warning) | BUILT | `day_of_month` 1-31. The warning is client copy |
| 25 | Every N months | BUILT | interval 1-4 monthly |
| 26 | Every weekday except last | DEFERRED-needs-admin | `weekday_except_last` refused as `mode_not_allowed` (`_owner_rule_problem_p5`). Needs an owner rule arm |
| 27 | Other dates (chosen dates) | BUILT (as dates, not a rule) | Owner `custom` rule refused (`mode_not_allowed`), so slice 1 creates `recurring` with NO rule, then one `series.add_date {date}` per extra date (`addDateCommand`; `_cmd_series_add_date_p5` refuses only festival-specific shapes and the 30-upcoming cap, l.35,102). A true `custom` rule stays DEFERRED-needs-admin (owner `custom` mode) |
| 28 | First date (any future date) | BUILT | `default_start_date` (past refused by go-live `first_date_past`) |
| 29 | Ends: keeps going | BUILT | `end.kind none` |
| 30 | Ends: on a date | BUILT | until_date up to 24 months |
| 31 | Ends: after N | BUILT | after_count 1-500 |
| 32 | 30-date cap / Extend | BUILT | Server rule. Shown as a note (`dateCap.ts`) |
| 33 | Dates taken off | DEFERRED-slice-2 | `series.skip_date` / `unskip_date` exist. That is an edit, after create |
| 34 | Course length | DEFERRED-slice-2 | see #2 |
| 35 | Festival days | DEFERRED-slice-2 | see #3 |
| 36 | Session type | BUILT | `set_program` item type |
| 37 | Session start/end | BUILT | `set_program` items. Go-live needs title + start + end (go-live l.29-32) |
| 38 | Level per class session | BUILT | item `levels` (`SessForm.levels`) |
| 39 | Line-up | DEFERRED-slice-2 | `everyLineup` (set_program people) |
| 40 | Rooms | DEFERRED-needs-admin (define) / slice-2 (pick) | `series.set_rooms` handler exists but is NOT an owner kind (aggregate l.14-22). Picking an existing room is `useVenueRooms` (slice 2) |
| 41 | Per-date time change | EXCLUDED | Edit of an existing date (`occurrence.set_time`), not create |
| 42 | How to pay (`payment_methods`) | BUILT | create key `payment_methods`. REQUIRED for go live (`no_payment`) |
| 43 | Ticket link | BUILT | create key `default_ticket_url` |
| 44 | Price list (10 passes) | BUILT | create key `default_passes`, `_owner_passes_problem_p5`, `pricesPlan` |
| 45 | Sell tickets here (Stripe) | DEFERRED-slice-2 | P3 tickets behind `organiserTicketing`. Needs an existing series |
| 46 | Music styles | DEFERRED-slice-2 | owner key `default_music_styles` |
| 47 | Age | DEFERRED-needs-admin | no column / no owner key. Needs admin: an age-policy column on `event_series` (e.g. `min_age`) and its `series.upsert` owner key |
| 48 | Dress code | DEFERRED-needs-admin | no column / no owner key. Needs admin: a `dress_code` text column on `event_series` and its `series.upsert` owner key |
| 49 | Places (event capacity) | DEFERRED-needs-admin | only `guest_list_capacity_max` (admin RPC). Missing: an owner key for event capacity in `series.upsert` (or an owner command for the guest-list cap). Split: Stripe ticket places are DEFERRED-slice-2 |
| 50 | Teaching language | DEFERRED-needs-admin | no column. Needs admin: a `teaching_language` column (series or session) and its owner key |
| 51 | Group chat | DEFERRED-slice-2 | `series.set_group_chat` owner kind |
| 52 | Instagram | DEFERRED-slice-2 | owner key `instagram_url` |
| 53 | Website / Facebook / TikTok | DEFERRED-needs-admin | columns `website`, `facebook_url`, `tiktok_url` exist, but no owner key |
| 54 | Guest list | DEFERRED-needs-admin | `admin_save_event_guest_list_config_v1` admin only. No owner command |
| 55 | Raffle | DEFERRED-needs-admin | `admin_assign_raffle_preset_v1` admin only. Missing: an owner `series_command_p5` kind (e.g. `series.set_raffle`) that assigns a preset |
| 56 | Promo codes | DEFERRED-needs-admin | `default_promo_codes` is NOT an owner key (aggregate l.68-74) |
| 57 | Save draft / go live | BUILT | create = draft. `lifecycleCommand('live')` gated by `_series_go_live_check_p5` |
| 58 | Leave / discard draft | BUILT | `removeCommand()` -> archived (draft -> archived allowed). Split: hard delete is admin only (EXCLUDED) |
| 59 | Copy / duplicate | DEFERRED-slice-2 | `admin_duplicate_event_p5` HAS an owner arm (ER P4 D42: keys name, as_template, copy_dates, shift_days, copy_recurrence). Unused by the Website |
| 60 | Cancel one date | EXCLUDED | post-create (`occurrence.cancel`) |
| 61 | Cancel whole event | EXCLUDED | post-create (`series.cancel_one_off`) |
| 62 | Pause / end run | EXCLUDED | post-create (`series.end_run` / `series.stop_repeating`, `series.set_lifecycle`) |
| 63 | Move / change one date | EXCLUDED | post-create (`occurrence.move_date` / `set_override`) |
| 64 | Web address (`slug`) *(added)* | DEFERRED-slice-2 | owner create key `slug`. Auto-slug trigger fills it when absent |
| 65 | Series default time / duration (`default_local_start_time`, `default_duration`) *(added)* | EXCLUDED | Times live on sessions. See the materialise risk above |
| 66 | Featured (`featured`) *(added)* | EXCLUDED | admin-only promotion, not an owner key |
| 67 | Organiser card slots 1/2 *(added)* | EXCLUDED | admin-only presentation, no owner key |
| 68 | Poster (`poster_url`) *(added)* | EXCLUDED | admin-only. Counts as a cover for go-live. Owners use the cover |
| 69 | Promotion touch override *(added)* | EXCLUDED | admin-only: no owner command for the promotion touch; it is set in the admin app only |
| 70 | Template (`is_template`) *(added)* | DEFERRED-slice-2 | owner reach is via the copy `as_template` key (#59) |
| 71 | Festival meta (`festival_meta`) *(added)* | DEFERRED-needs-admin | no owner key. Arrives with festival work (#3) |

## Prod shape survey (2026-10-30, counts only)

- **Series by format / status (758 total):**

  | Format | Archived | Live | Ended | Draft | Paused |
  |---|---|---|---|---|---|
  | one_off | 635 | 11 | | 4 | 1 |
  | recurring | 12 | 44 | 13 | 8 | 1 |
  | course | 1 | 6 | 8 | 1 | |
  | festival | 5 | 8 | | | |

  Non-archived: 105.
- **Repeat rules (60):**
  - weekly with one weekday: 51 (42 with interval 1, 9 with no interval key). No series has
    several weekdays or every N weeks.
  - monthly `nth_weekday`: 6
  - monthly `day_of_month`: 1 (the 18th; none on the 29th-31st)
  - `weekday_except_last`: 1
  - `custom`: 1
  - Ends: none 45, after_count 11, until_date 3, one rule with no end key.
- **Pages:**
  - Owner/manager logins: 14 have 1 page, 1 has 2+.
  - 49 organiser pages are live.
  - A login with 0 pages is not countable from the tables (any signed-in user).
- **Sessions per series** (program items, 105 non-archived): 0: 9, 1: 20, 2: 28, 3-5: 38, 6+: 10.
- **Venue and cover:**

  | | All 758 | Non-archived 105 |
  |---|---|---|
  | With a venue | 147 | 95 |
  | With a cover or poster | 133 | 93 |

- **Price:** `payment_methods` is set on 0 of 758 series, and 7 have 1+ passes.
- **Series default time:** set on 102 of 105 non-archived series.
- **Drafts:** 1 draft has no occurrence.

## Coverage

**71 rows (63 inventory + 8 added), 71 accounted for, none silently omitted.**

| Verdict | Count |
|---|---|
| BUILT | 30 |
| DEFERRED-slice-2 | 18 |
| DEFERRED-needs-admin | 12 |
| EXCLUDED | 11 |

Split verdicts (counted once, under the first verdict; the other part is named in the row):

- #1 counts as BUILT: the format picker and the slice 1 kinds are built; course (#2) and festival (#3) are DEFERRED-slice-2.
- #13 counts as DEFERRED-slice-2: creating a venue is deferred; the "venue not found" copy in the venue search IS built (`sheets.tsx`).
- #27 counts as BUILT and #40 as DEFERRED-needs-admin.
- #49 counts as DEFERRED-needs-admin: event capacity needs an owner key; Stripe ticket places are DEFERRED-slice-2.
- #58 counts as BUILT: discard (archive) is built; hard delete is EXCLUDED (admin only).

Coverage: 71 rows, 30 built, 30 deferred (with reason: 18 DEFERRED-slice-2 = outside slice 1 scope, no DB change needed; 12 DEFERRED-needs-admin = the missing server command, owner key or column is named in each row), 11 excluded (not part of create, reason in each row), 0 silent
