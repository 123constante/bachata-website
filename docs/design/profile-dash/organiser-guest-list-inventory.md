# Organiser Guest list: inventory (Step 0, before any drawing)

Brief: `docs/briefs/profile-dash-organiser-guest-list-opts.md` (branch `brief/profile-dash-organiser-guest-list-opts`).
Checked on `origin/main` e27b2f7, 2026-11-12. Paths are under `src/` unless they say otherwise.

**Sources and their limits.**
- **Website:** every row below gives a file:line.
- **Admin app:** this session could not open the admin repo (`bachata-admin-11april`, access denied). So the
  "Admin" rows list what the admin RPCs in the prod database and in `integrations/supabase/types.ts` support,
  not what the admin screens show. That is a GAP in this inventory (G0).
- **Database:** the prod database `stsdtacfauprzrdebmzg` was read with SELECT queries on `information_schema`
  and `pg_proc` only, never a write.

"Shown in" names the design shape that draws the row (both options, unless it says A or B). "Not drawn" always
gives the reason.

## A. What the public event page does today (the dancer side)

| # | Field / state / option | Where | Shown in |
|---|---|---|---|
| 1 | Read RPC `get_event_guest_list(p_event_id)`, cached 10 s | modules/event-page/hooks/useEventGuestList.ts:314,321 | `dancer` (the data the public block reads) |
| 2 | Payload: `enabled, count, entries, config, cutoff_passed, active_count, waitlist_count, capacity_max, waitlist_enabled, spots_left` | useEventGuestList.ts:63-79 | each field is in its own row below |
| 3 | Entry fields published: `first_name`, `created_at`, `status` (active / waitlist); ids are never published | useEventGuestList.ts:11-37 | `normal` rows (name + when added) |
| 4 | Statuses the server keeps but never publishes: `ineligible`, `erased` | useEventGuestList.ts:5-8 | not drawn: there is no organiser action for them; `erased` rows simply leave the list |
| 5 | Submit RPC `submit_guest_list_entry(p_event_id, p_first_name)`, optimistic row, rollback toast | hooks/useSubmitGuestListEntry.ts:73-76,90-98,123-157 | `dancer` (Add my name) |
| 6 | Form: first name only, max 80 chars, "Add My Name"; you can add a friend's name too | modules/event-page/bento/blocks/GuestListBlock.tsx:406-421,487 | `dancer`: replaced by a signed-in button with no free text (owner decision: one entry per account) |
| 7 | No sign-in needed (anonymous submit) | useSubmitGuestListEntry.ts:73-76 (no auth check) | `dancer`: drawn as a signed-in-only button (Careful lane C3) |
| 8 | Names are public: every first name shows as a pill, plus "N dancers on the list" | GuestListBlock.tsx:279-282,350-365 | `dancer`; `teamonly` draws the alternative |
| 9 | Empty state "Be the first on the list" | GuestListBlock.tsx:346 | `dancer` when the list is empty, and the organiser `empty` shape |
| 10 | Duplicate name: case-insensitive check on the client + server `duplicate_name` -> CollisionCard | GuestListBlock.tsx:234-242,261-262; utils/guestListReasons.ts:131-135 | replaced by "one entry per account": `dancerin` shows "You are on the list" and no second button |
| 11 | Cutoff countdown ("Closes Fri 22:00 . 2d 3h left", "Closing in N minutes") | utils/guestListCountdown.ts:191-247,255-292; GuestListBlock.tsx:381-391 | settings "Sign-up closes"; `closed` |
| 12 | Closed state "Guest list is now closed" (server `cutoff_passed`) | GuestListBlock.tsx:394-400,445 | `closed` (organiser can still add names) |
| 13 | Savings: party and class+party prices, strike-through, "Save GBP N" | utils/guestListSavings.ts:325-351; GuestListBlock.tsx:74-98,288-311 | settings "Price on the list" (opens Edit) |
| 14 | "Arrive before {discount_until}" + free-text description | GuestListBlock.tsx:317-336 | settings "Arrive before" + "Note for dancers" (open Edit) |
| 15 | How-to accordion + "See you at the event! Show your name at the door." | GuestListBlock.tsx:438,455-490 | `dancerin` ("Show your name at the door") |
| 16 | Reject reasons: `name_required`, `name_too_long`, `event_not_found`, `event_archived`, `guest_list_not_enabled`, `cutoff_passed`, `capacity_full`, `rate_limited`, `duplicate_name`, unknown, network | utils/guestListReasons.ts:50-60,87-136,143-149; useSubmitGuestListEntry.ts:151 | `full`, `closed`, `off` cover the three an organiser causes; the rest are dancer-only errors and are not drawn here |
| 17 | Capacity and waiting list UI (only in GuestListSection; the live block ignores `spots_left` and waitlist) | useEventGuestList.ts:119-123,146-162; modules/event-page/sections/GuestListSection.tsx:255,373-382,399-402 | places: `full`, settings. Waiting list: **not drawn**, the owner did not ask for it (G6) |
| 18 | `JoinGuestListDialog` wraps GuestListSection; **nothing imports it** | modules/event-page/bento/modals/JoinGuestListDialog.tsx:18-30 | not drawn: dead code |
| 19 | Realtime channel `guest_list:{id}` (INSERT/UPDATE on entries) | hooks/useGuestListRealtime.ts:23-29,67-70,81-103 | `door` (count updates live: "updates as people arrive") |
| 20 | Block hidden when the night is over, or the list is off, or not loaded | modules/event-page/bento/BentoPage.tsx:204-205,279,387,564-573; bento/BentoGrid.tsx:18,76,125 | `off`, `past` (organiser copy says what dancers see) |
| 21 | GDPR erase `/erase/:token` (`dancer_erase_guest_entry_v1`) and export `/export/:token` | pages/EraseGuestEntry.tsx:25,53,88,166-181; pages/ExportGuestEntry.tsx:53,86-90,160; components/AnimatedRoutes.tsx:311-312 | not drawn: a dancer's own data page, not this tab. The new remove-me control (`dancerin`) sits next to it |

## B. What the organiser area does today (this repo)

| # | Field / state / option | Where | Shown in |
|---|---|---|---|
| 22 | Stats tile "Guest list sign-ups" (count only, from `organiser_analytics_v2.guest_list_signups`) | modules/organiser/p3/data/analyticsV2.ts:54,111; p3/screens/StatsScreen.tsx:131-134 | kept; the per-night count chip on the night card (`entry`) |
| 23 | Move / delete date guard "N on the guest list cannot be emailed. You may want to tell them yourself." (`date_has_people`) | modules/organiser/p3/model/labels.ts:377-402,406-453 | `cancelled` reuses the fact: names are kept, and the team is told nobody was emailed |
| 24 | "Download guest list" is the **ticket buyers** CSV, not guest-list names | modules/organiser/p3/tickets/SalesReport.tsx:41-48,111; p3/tickets/salesReportModel.ts:93,109,121-146 | not changed; the guest list gets its own "Download names" (`normal`), so two "guest list" downloads no longer clash (G7) |
| 25 | Door check-in: tickets only (`ticket_door_list_v1`) | SalesReport.tsx:38-39,105-107; modules/organiser/p3/door/data.ts:41-100 | `door` (guest names get their own check-in) |
| 26 | "Guest list" row "Coming soon. It will switch on per night, here." + Tell us (picked Events design) | docs/design/profile-dash/organiser-events-option-a.html:338 | `entrysheet` replaces it with the real row |

## C. What the database and admin RPCs support (prod, read-only)

| # | Field / option | Where | Shown in |
|---|---|---|---|
| 27 | `event_series_p5.has_guestlist` (series on/off) | types.ts:3492 | `off` / switch; a per-night switch needs occurrence level (Careful C1) |
| 28 | `event_series_p5.guest_list_capacity_max` (series places) | types.ts:3490 | settings "Places"; `full` |
| 29 | `event_series_p5.waitlist_enabled` | types.ts:3524 | not drawn (G6) |
| 30 | `guest_list_config` keys: `cutoff_time`, `description`, `discount_valid_until` (read by the client as `discount_until`), 4 price keys | types.ts:3491; useEventGuestList.ts:39-47 | settings rows (#11, #13, #14) |
| 31 | `event_guest_list_entries`: `id, event_id, event_id_p5, occurrence_p5_id, first_name, status, is_permanent, qr_token, created_at, deleted_at, deleted_reason` | types.ts:2300-2313 | rows; `qr_token` -> QR check-in (`qr`). **No user id, no checked-in time, no "added by" column** (Careful C2, C4, C5) |
| 32 | `is_permanent` entries (on every night of the series) | types.ts:2300-2313 | "Every week" names in `normal` and `door` |
| 33 | Standing names list (`guest_list_standing_names`) + per-event exclusion (`guest_list_standing_exclusions`), `admin_*_guestlist_standing_*` RPCs | types.ts:4564,4593,12472,12964,13326,14136,14421 | not drawn: an admin-wide list, not an organiser's. Organisers get "Every week" names instead (G5) |
| 34 | `admin_get_event_guest_list_config_v1`, `admin_save_event_guest_list_config_v1(p_event_id, p_has_guestlist, p_config, p_capacity_max, p_waitlist_enabled)` | types.ts:12928,14104 | settings sheet (organiser version needed: Careful C1, C6) |
| 35 | `admin_list_guest_list_entries_v1(p_event_id, p_occurrence_id)` | types.ts:13321 | the list itself (organiser version: Careful C6) |
| 36 | `admin_manual_add_guest_list_entry_v1(p_event_id, p_first_name, p_occurrence_id)` | types.ts:13735 | `add` sheet |
| 37 | `admin_soft_delete_guest_list_entry_v1(p_entry_id, p_reason)` / `admin_restore_guest_list_entry_v1` | types.ts:14545,14024 | `remove` sheet + Undo toast |
| 38 | `admin_promote_waitlist_guest_list_entry_v1`, `_promote_waitlist_v1` | types.ts:13881,11791 | not drawn (G6) |
| 39 | `admin_reveal_guest_phone_v1` + `guest_entry_phone_view_audit_v1` (phone reveal is audited) | types.ts:4476,14033 | **not drawn on purpose**: entries have no phone column, and the owner asked for names only. Phones stay admin-only (G3) |
| 40 | `_guest_list_door_headcount_v1(p_event_id, p_bucket)` | types.ts:11122 | `door` header count (n of N in) |
| 41 | Close notify (`guest_list_close_notified_v1`, `guest_list_claim_close_notify_candidates_v1`), 21 rows | types.ts:4535,15745 | not drawn: who it notifies is not readable without the admin repo (G0) |
| 42 | Retention: `purge_old_guest_entries_v1`, `guest_entry_purge_archive_v1`, erasure tokens | types.ts:4432,4514,16447 | `past`: "Names are deleted N days after the night" is **not** drawn because the window is not known (G4) |
| 43 | Occurrence quarantine (`m3_guest_list_occurrence_quarantine`) | types.ts:5001 | not drawn: a migration leftover |
| 44 | Contract checks `check_guest_list_contract_v1`, `check_guest_entries_contract_v1` | types.ts:14730-14731 | not drawn (CI only) |

## D. Owner decisions 2026-11-12 (new, nothing in code yet)

| # | Decision | Shown in |
|---|---|---|
| 45 | Per-night on/off switch | `off`, `entrysheet`, settings |
| 46 | Signed-in dancers add themselves | `dancer` |
| 47 | Organiser adds names | `add` |
| 48 | Organiser removes names | `remove` |
| 49 | Door check-in | `door` |
| 50 | Places (quota) | `full`, settings |
| 51 | Self sign-up link | `link` sheet |
| 52 | QR check-in | `qr` sheet |
| 53 | Names are public + "Your name will be visible on this list" on the button | `dancer` |
| 54 | One entry per account | `dancerin` |
| 55 | Remove-me control | `dancerin` |
| 56 | Privacy-risk alternative: names only the team sees (a marked variant, not a substitute) | `teamonly`, `dancer&v=team` |
| 57 | Guest list lives inside each night; tab bar unchanged; reached from the night card | `entry`, `entrysheet` |
| 58 | Contributor sees the list but cannot change it, and is told why | `contributor` |

## GAPs

- **G0** The admin repo was not readable here, so the admin screens themselves are not cited (only the RPCs are). Close-notify behaviour (#41) is unknown.
- **G1** Organisers have no guest-list UI at all today: no switch, no list, no add or remove, no check-in, no settings.
- **G2** The public sign-up is anonymous with free text, so "one entry per account" and "remove me" have nothing to key on (no user id column).
- **G3** There is no phone column on entries, but the phone-reveal RPC and its audit table exist. Not drawn.
- **G4** The retention window for names after a night is unknown here, so it is not promised in copy.
- **G5** The standing (VIP) names list is admin-wide, so organisers cannot manage it. Not drawn.
- **G6** The waiting list (flag on for 6 of 6 series, but 0 waitlist entries in prod) has no UI on the live block. Not drawn: the owner did not ask for it.
- **G7** "Download guest list" on Tickets exports ticket buyers. Its name clashes with this list's own download.

## Coverage count

**58 rows.** 45 are shown in the designs (in a shape, sheet or settings row); 13 are deliberately not drawn,
each with its reason in its row: #4, #16 (the dancer-only reasons), #18, #21, #29, #33, #38, #39, #41, #42,
#43, #44, and #24 (left unchanged, reason given). No row is silently omitted.
