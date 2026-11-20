# What an organiser can set: event, session, one date (as stored TODAY)

Sources read (read-only): Website `origin/main` 7fb66dfdf (extracted to scratchpad; local checkout is on old branch `feat/event-truth-p1p3`, NOT used), admin `origin/main` 6793ac34f baseline `20261118000000_baseline_prod_schema_v2.sql` plus the 14 later migrations (none adds a column to these tables), the job audit `C:/dev/fast-editor-audit/docs/design/event-editor-job-audit.md`, `src/integrations/supabase/types.ts`. Prod counts (shape only) run 2026-11-19 on stsdtacfauprzrdebmzg.

Key facts:
- One date = `event_occurrence_p5` row. Its own values live in `event_occurrence_override_p5` (1 row per date, `overridden_keys` lists which). Per-date session changes live in `event_occurrence_session_override_p5` (one row per date x series session) and `event_occurrence_added_session_p5` (+ `_people_p5`) for date-only sessions.
- Owner (organiser) writes are allow-listed server-side. Mirror in `src/modules/organiser/shared/seriesCommands.ts`: override keys an owner may send = `venue_id, city_id, cancellation_reason_label, cover_image_url, ticket_url, description, title, gallery, passes`. Every other override column is admin-only today.
- Per-date sessions: owner writer `organiser_set_occurrence_programme_v1` accepts only `type, title, start_time, end_time, ends_next_day, level_keys, removed` + `people_add/people_remove` (roles teaching/djing). Refuses multi-day events, cancelled and past dates.
- Two editors: R1 (`src/modules/organiser/events/`, `flows/`, `dates/`) and P3/R4 (`src/modules/organiser/p3/`, behind `VITE_ENABLE_ORGANISER_P3`; prod value of that env var UNKNOWN, not checked in Vercel). "P3 only" below = not reachable in R1.
- Status: EXISTS = stored and organiser can edit; PARTIAL = stored but organiser cannot edit it (admin only) or only in P3, or column exists but UI never sets it; NEW = data cannot store it.

Prod shape (counts): 769 series, 3374 dates, 155 cancelled dates, 401 date override rows (keys used: cover_image_url 242, description 200, venue_id 191, city_id 186, ticket_url 78, gallery 60, cancellation_reason_label 43, title 17, music_styles 10; passes / organiser_ids / time / level / featured / promo_codes 0), 723 series sessions, 109 per-date session overrides (26 cancelled, 27 with people changes), 46 date-only sessions (11 people rows), 23 ticket types (all kind night; 4 tied to one date via occurrence_id).

## A. Event (`event_series_p5`)

| detail | stored where | can it differ per date TODAY? | where organiser edits it today | status |
|---|---|---|---|---|
| Name | event_series_p5.name | yes: event_occurrence_override_p5.title (owner key) | R1 events/Details.tsx (name row); P3 p3/data/details.ts. Per date: P3 only, p3/screens/DateFieldSheets.tsx | EXISTS (per-date name P3 only) |
| Description / about | default_description | yes: override.description | R1 events/Details.tsx (about); per date R1 flows/change/Detail.tsx ("Note for this date only") | EXISTS |
| Venue | default_venue_id (+ default_city_id set from venue) | yes: override.venue_id + city_id | R1 events/Details.tsx + EditorSheet.tsx; per date R1 flows/change/Venue.tsx and dates/index.tsx (useDateEditor.ts) | EXISTS |
| Start time / length | default_local_start_time, default_duration | yes: override.custom_local_start_time / custom_local_end_time (via occurrence.set_time) | R1 events/Details.tsx (time); per date R1 flows/change/Time.tsx; P3 p3/data/dates.ts PLAN.time | EXISTS |
| First date / repeat rule / end | default_start_date, recurrence_rule (owner: weekly, one weekday), removed_dates, ended_on | n/a (shapes the date list); one date can move: event_occurrence_p5.occurrence_date (occurrence.move_date) | R1 events/Details.tsx ScheduleCard + EditorRows.tsx, eventModel.ts savePlan; take off: flows/change/TakeOff.tsx | EXISTS |
| Pause / end event | lifecycle_status, ended_on | no (event-wide) | R1 events/LifecycleActions.tsx | EXISTS |
| Ticket link | default_ticket_url | yes: override.ticket_url | R1 events/Details.tsx (tickets); per date R1 flows/change/Detail.tsx ("Ticket link for this date only") | EXISTS |
| Price list (display only, not sold) | passes (jsonb, max 10, owner keys id/name/price/currency/description) | yes: override.passes (owner key; 0 rows on prod) | P3 only: p3/screens/PricesScreen.tsx; per date p3/screens/DateFieldSheets.tsx, p3/r4/R4EditNight.tsx. None in R1 | PARTIAL (P3 only) |
| Sold tickets (types, price, capacity, sales window) | ticket_types (event_series_id, occurrence_id nullable, name, price_pence, capacity, sales_open_at/close_at, status, kind night/course, valid_day) + ticket_price_steps | column yes: ticket_types.occurrence_id (4 of 23 on prod) | P3 only: p3/tickets/TypeSheet.tsx, PriceSteps.tsx, p3/r4/R4Tickets.tsx via tickets/ticketsApi.ts (ticket_type_upsert_v1). New types are always sent with occurrence_id null (tickets/ticketModel.ts buildUpsert); who set the 4 per-date ones: UNKNOWN | PARTIAL |
| How to pay | payment_methods | no: no override column | R1 events/PaymentEdit.tsx | EXISTS |
| Music styles | default_music_styles | column yes: override.music_styles (10 rows) but NOT an owner key | R1 events/MusicEdit.tsx (series only) | EXISTS series / PARTIAL per date (admin only) |
| Level | default_level | column yes: override.level, not an owner key | none found (default_level is an owner upsert key, but no UI sends it; grep) | PARTIAL |
| Flyer / cover | default_cover_image_url | yes: override.cover_image_url | R1 flows/fix/CoverFlow.tsx (cover route from Details.tsx); per date R1 flows/change/Detail.tsx ("Picture for this date only") | EXISTS |
| Poster (separate column) | poster_url | no override column; not an owner key | none found | PARTIAL (admin only) |
| Gallery | gallery | yes: override.gallery (owner key) | R1 events/Details.tsx (gallery sheet); per date P3 only DateFieldSheets.tsx | EXISTS (per-date P3 only) |
| Videos | video_urls | no override column | R1 events/Details.tsx (videos sheet) | EXISTS (series only) |
| Instagram | instagram_url | no override column | P3 p3/data/details.ts (audit: absent from R1 Details) | PARTIAL (P3 only) |
| Group chat link | group_chat_url (series.set_group_chat) | no | P3 p3/data/details.ts | PARTIAL (P3 only) |
| Website / Facebook / TikTok / livestream | website, facebook_url, tiktok_url, livestream_url | no | none (not owner keys) | PARTIAL (admin only) |
| Organisers of the event | event_series_organiser_p5 (+ organiser_ids) | column yes: override.organiser_ids, NOT an owner key (0 rows) | R1 events/SeriesOrganisers.tsx (series.set_organisers) | EXISTS series / PARTIAL per date |
| Event kind | format (one_off/recurring/festival/course, set at create), category (derived from sessions), type (generated) | no | create only: events/NewEventPage / flows/new (audit); category never sent | EXISTS (create only) |
| Guest list on/off, cap, waitlist | has_guestlist, guest_list_capacity_max, waitlist_enabled, guest_list_config | no per-date config column (entries are per date in event_guest_list_entries; not checked further) | P3 p3/guestlist/ (not verified) | UNKNOWN editor |
| Raffle | raffle_preset_id (has_raffle generated) | no | P3 p3/r4/R4Raffle.tsx (not verified) | UNKNOWN editor |
| Featured / promo codes (jsonb) | featured, promo_codes | columns yes: override.featured, override.promo_codes, not owner keys | none (admin) | PARTIAL (admin only) |

## B. Session (series programme: `event_series_program_item_p5`, inside day > section)

Organiser editor (series-wide): R1 events/ProgrammeSeries.tsx + programmeSeriesModel.ts, sends series.set_program (whole tree; AW1_APPLIED = true). Festival programme is read-only there (audit).

| detail | stored where | can it differ per date TODAY? | where organiser edits it today | status |
|---|---|---|---|---|
| Title | program_item.title | yes: session_override.title | series: ProgrammeSeries.tsx; per date: R1 dates/index.tsx + DateSheet.tsx (organiser_set_occurrence_programme_v1); P3 p3/screens/SessionSheet.tsx | EXISTS |
| Type (class / masterclass / party / performance) | program_item.type | yes: session_override.type | same as Title | EXISTS |
| Start / end time | program_item.start_time, end_time | yes: session_override.start_time / end_time | same as Title | EXISTS |
| Levels | program_item.level_keys (class/masterclass only) | yes: session_override.level_keys | same as Title | EXISTS |
| People (teachers, DJs; MC/performer read-only) | event_series_program_people_p5 (profile_id, profile_type, role, level, sort_order) | yes: session_override.people_added / people_modified / people_removed | series: ProgrammeSeries.tsx (role, level); per date: dates/index.tsx (dates/peoplePicker.ts), add/remove only | EXISTS (per-date person level not organiser-editable: writer takes profile_id+role only) |
| Cancel one session on one date | n/a | yes: session_override.cancelled (26 rows) | per date: dates/index.tsx "removed" -> cancelled=true | EXISTS |
| Session cancel reason | n/a | column: session_override.cancellation_reason_label, not in organiser writer | none | PARTIAL (admin only) |
| Room | program_item.room, venue_room_id | column yes: session_override.room / venue_room_id, not in organiser writer | none (passed through unchanged by ProgrammeSeries) | PARTIAL (admin only) |
| Style / theme / track | program_item.style, theme, track_id | columns yes on session_override, not in organiser writer | none (passed through) | PARTIAL (admin only) |
| Section (party / classes block) and its label | event_series_program_section_p5.kind, label_override | no per-date override; date-only session carries added_session.section_kind | series: ProgrammeSeries.tsx (section kind) | EXISTS series / NEW per date |
| Day of a multi-day event | event_series_program_day_p5 (day_index, date_offset_days, label) | no | none for organiser (multi_day refused) | PARTIAL |
| Order / parallel | sort_order, parallel_group_id | no per-date order for series sessions; added sessions have sort_order | ProgrammeSeries.tsx (order); parallel passed through | EXISTS series |
| Session ticket / price | none | no: ticket_types has no program_item column | none | NEW |

## C. One date (`event_occurrence_p5`)

| detail | stored where | can it differ per date TODAY? | where organiser edits it today | status |
|---|---|---|---|---|
| The date | occurrence_date | yes (it is the date) | add: flows/add/AddFlow.tsx; move: occurrence.move_date (P3 PLAN.move; one-off via eventModel savePlan); take off: flows/change/TakeOff.tsx (series.skip_date -> removed_dates) | EXISTS |
| Time | override.custom_local_start_time / end_time | yes | flows/change/Time.tsx | EXISTS |
| Venue (+city) | override.venue_id, city_id | yes | flows/change/Venue.tsx, dates/index.tsx | EXISTS |
| Name | override.title | yes | P3 DateFieldSheets.tsx only | PARTIAL (P3 only) |
| Note / description | override.description | yes | flows/change/Detail.tsx | EXISTS |
| Picture / cover | override.cover_image_url | yes | flows/change/Detail.tsx | EXISTS |
| Photos | override.gallery | yes | P3 DateFieldSheets.tsx only | PARTIAL (P3 only) |
| Ticket link | override.ticket_url | yes | flows/change/Detail.tsx | EXISTS |
| Price list (display) | override.passes | yes | P3 DateFieldSheets.tsx, R4EditNight.tsx only | PARTIAL (P3 only) |
| Sold tickets for this night only | ticket_types.occurrence_id | yes (column) | no organiser UI sets it on create | PARTIAL |
| Cancel date + reason | event_occurrence_p5.lifecycle_status = 'cancelled' + override.cancellation_reason_label | yes | flows/change/WhatChanges.tsx -> cancel; flows/cancel/CancelFlow.tsx; one-off: series.cancel_one_off; dates/index.tsx | EXISTS |
| Sessions this date (change / cancel / add date-only) | session_override_p5, added_session_p5 (+ _people_p5) | yes | dates/index.tsx + DateSheet.tsx; P3 SessionSheet.tsx | EXISTS |
| Copy changes from another date | (writes overrides) | n/a | flows/change/Copy.tsx | EXISTS |
| Music styles / level / organisers / featured / promo codes for this date | override.music_styles, level, organiser_ids, featured, promo_codes | columns yes, not owner keys | none | PARTIAL (admin only) |
| Videos / payment / Instagram / links for this date | none | no override column | none | NEW |

## The six prototype assumptions

1. Per-date venue: YES, exists. override.venue_id + city_id (191 prod rows). Organiser edits it in R1 (flows/change/Venue.tsx, dates/index.tsx). No schema needed.
2. Per-date people: session line-up YES (session_override.people_added/removed/modified, added_session_people; organiser can add/remove teachers and DJs per date via organiser_set_occurrence_programme_v1). Event organisers per date: column override.organiser_ids exists but owners cannot write it. Schema needed: none for line-up; for organisers per date only an admin allow-list change (add organiser_ids to owner override keys, admin repo). Per-date person level: writer change only.
3. Per-date tickets and prices: ticket LINK yes (override.ticket_url, R1). Display price list yes (override.passes, P3 only). Sold tickets per night: column ticket_types.occurrence_id exists, but organiser UI never sets it; no schema needed, only UI/RPC use. Per-session tickets: NEW, would need a program_item_id (or added_session_id) column on ticket_types plus checkout rules.
4. Per-date programme/classes: YES. session_override_p5 (title, type, times, levels, cancel, people) and added_session_p5 (date-only sessions). Organiser edits in R1 dates/. Not for multi-day events, cancelled or past dates (writer refuses). Per-date room/style/theme: columns exist, organiser writer does not accept them (writer change, no DDL). Per-date section/day structure: NEW (would need section/day override columns or table).
5. Per-date poster/text: YES. override.cover_image_url, description, title, gallery (title/gallery P3 only). `poster_url` (separate series column) has no per-date column: NEW if the prototype means that field (add poster_url to event_occurrence_override_p5 + key set function + owner allow-list). Per-date videos: NEW (add video_urls to override table).
6. Per-date cancel: YES. event_occurrence_p5.lifecycle_status 'cancelled' + override.cancellation_reason_label (155 cancelled dates); per-session-per-date cancel via session_override.cancelled. Tickets of a cancelled night stay valid (admin 20261118054330 note); refunds are a separate R4 flow.

UNKNOWN: prod value of VITE_ENABLE_ORGANISER_P3 (not checked); who created the 4 per-night ticket types; guest list and raffle editors (not opened).
