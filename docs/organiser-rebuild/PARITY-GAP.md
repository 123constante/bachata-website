# Organiser R1 -- parity gap (admin editor vs old organiser editor vs R1 vs prod permissions)

- Date: 2026-10-17. Ticket: dt_938bdec512ce. Read-only audit; no code changed.
- Heads audited: website R1 `claude/org-r1-parity` = `claude/org-r1-integrate` e04dea0; website main c36fbaf (old organiser editor); admin main a12a21a6; prod (`stsdtacfauprzrdebmzg`) migration ledger last `20261122370000` (= newest file on admin main, so prod = admin main).
- Appendices: [parity/commands-roles.md](parity/commands-roles.md) (every command x role with prod fn:line and migration file:line), [parity/prod-counts.md](parity/prod-counts.md) (every count with its SQL).

## How to read the citations

| Tag | Means |
|---|---|
| admin `P/` `D/` `E/` `CV/` `L/` | bachata-admin @a12a21a6: `E/`=`components/events/editor-v2/`, `P/`=`E/panels/`, `D/`=`E/date/`, `CV/`=`components/events/canvas/`, `L/`=`lib/` |
| old `EEP ES ER EM SC DP DS UDE API` | website main c36fbaf, `src/modules/organiser/`: EEP=events/EventEditorPage.tsx, ES=events/EditorSheet.tsx, ER=events/EditorRows.tsx, EM=events/eventModel.ts, SC=shared/seriesCommands.ts, DP=dates/index.tsx, DS=dates/DateSheet.tsx, UDE=dates/useDateEditor.ts, API=shared/selfServeApi.ts |
| R1 (plain path) | website e04dea0, under `src/modules/organiser/` |
| `AAW:n` | prod `apply_aggregate_write_p5` body line n; same text at `M21:(604+n)` |
| `M21:n` | admin `supabase/migrations/20261121040000_series_category_derived_from_programme_v1.sql` line n |
| `OPW:n` | prod `organiser_set_occurrence_programme_v1` body line n (gate also at M21:1390) |
| `ST` | `_cmd_occurrence_set_time_p5`, M21:2207-2416 |
| "owner/mgr" | allowed for an organiser member with role owner or manager. **Contributors can run NO event command**: AAW lets them past layer 4 for 4 kinds, then every handler's `_assert_can_edit_series_p5` refuses them (mig `20261109490000_a06_contributor_series_edit_v1.sql:132`). |

Owner command list: `v_owner_kinds` M21:621-626 (upsert, add_date, remove_date, occurrence.set_time, set_lifecycle, occurrence.cancel, occurrence.set_override, skip_date, unskip_date, set_recurrence, stop_repeating, end_run); everything else is `permission_denied: <kind> is admin-only` (M21:680). Owner upsert keys M21:647-651; owner per-date override keys M21:639-640 (`venue_id, city_id, cancellation_reason_label, cover_image_url, ticket_url, description`); format/organiser_ids create-only M21:652-659.

## The table

Verdicts: MATCH / PARTIAL / MISSING-ALLOWED / MISSING-ADMIN-ONLY / DROPPED-BY-DECISION. Two R1 rows also carry **BROKEN-ON-PROD**: R1 sends a command prod refuses today (both wait on the A1 admin migration).

| # | capability (plain words) | admin editor (file:line) | old organiser editor (file:line) | R1 screen (file:line) or MISSING | organiser may do it on prod? (RPC + role, file:line) | verdict | recommended default |
|---|---|---|---|---|---|---|---|
| C01 | Event name | P/DetailsPanel.tsx:320 (series.upsert name) | EEP:211; EM:201,213 | events/Details.tsx:117 row, :56 Save; new: flows/new/NewFlow.tsx:140 | Yes, owner/mgr: series.upsert `name` M21:647 | MATCH | keep |
| C02 | About / description | P/DetailsPanel.tsx:521 | EEP:281 -> ES:393-405 | events/Details.tsx:51-52 (About textarea) | Yes: `default_description` M21:649 | MATCH | keep |
| C03 | Event type / format | type read-only P/DetailsPanel.tsx:341; shape E/EventShapeControl.tsx:108 | read-only EEP:227-228; create chip NewEventPage.tsx:162 | create only, 2 cards: flows/new/NewFlow.tsx:88, flows/new/model.ts:17-20 | Format on create only (M21:652-659); change later admin-only | DROPPED-BY-DECISION (D54: Weekly night + One night only) | keep |
| C04 | Dance / music styles | P/DetailsPanel.tsx:532 | EEP:283-287 (8 fixed chips, EM:51) | events/Details.tsx:119 "Music" (free text, comma split) | Yes: `default_music_styles` M21:650 | MATCH (R1 free text, old chips) | keep; consider chips later |
| C05 | Cover picture | P/EventImagesField.tsx:374, set :343, remove :327 | EEP:214-215; events/media.ts:9 | flows/fix/CoverFlow.tsx:52,80 (from Details :126, Home no_cover); new: NewFlow.tsx:282-283 | Yes: `default_cover_image_url` M21:650 | MATCH (replace only, as old) | keep |
| C06 | Gallery photos + video links | P/EventImagesField.tsx:352,454; P/EventVideoUploader.tsx:186; P/EventVideoUrlInput.tsx:101 | EEP:219 -> ES:225-256; EEP:290 -> ES:258-299 | MISSING: sheets exist (events/EditorSheet.tsx:105,138) but Details opens only `venue` (events/Details.tsx:106) and `onUploadGallery` is a no-op (:138) | Yes: `default_gallery`, `default_video_urls` M21:650-651 | MISSING-ALLOWED | build (wire existing sheets) |
| C07 | Venue (all dates) | P/DetailsPanel.tsx:439 (VenuePicker) | EEP:276 -> ES:362-391 | events/Details.tsx:106,136; new: NewFlow.tsx:173 | Yes: `default_venue_id` M21:648 | MATCH (existing venues only, all three) | keep |
| C08 | City | from venue P/DetailsPanel.tsx:467 | from venue ES:369, EEP:143-144 | from venue events/Details.tsx:90 | Yes: `default_city_id` M21:648 | MATCH | keep |
| C09a | Ticket link | P/DetailsPanel.tsx:553 | EEP:298 -> ES:407-417 | events/Details.tsx:119 "Tickets" | Yes: `default_ticket_url` M21:649 | MATCH | keep |
| C09b | Price list (passes: name, price, qty) | P/DetailsPanel.tsx:745-844; P/FestivalPassesEditor.tsx:118 | builder SC:187-215, no UI | MISSING (grep `passes` in events/, flows/ = 0) | Yes: `default_passes` M21:651 (D8) | MISSING-ALLOWED (plan 1.6 drops ticket SALES/payments, not a price list: owner to confirm) | ask owner; default not in R1 |
| C10 | Links (Instagram; website/Facebook/group chat) | group chat P/DetailsPanel.tsx:567-590 only | none (instagram builder SC:200-202 unused) | Instagram: events/Details.tsx:119 | Instagram yes M21:651; website/Facebook/group chat admin-only (AAW:375-377; set_group_chat handler:10) | MATCH (organiser scope; R1 > old) | keep |
| C11 | Co-organisers on the event | P/DetailsPanel.tsx:614 | read-only row EEP:303-304 | MISSING (only create attaches one org: shared/selfServeApi.ts:390; grep `organiser_ids` in events/ = 0) | No: organiser_ids create-only M21:652-659; series.set_organisers admin-only (mig 20261105860000:50) | MISSING-ADMIN-ONLY (R1 also lost old's read-only row; 5 live series have 2+ organisers) | show read-only row |
| C12 | Line-up at series level | CV/ProgramCanvasSessionCard.tsx:1125-1247 (series.set_program) | none | read-only next date only: events/EditorRows.tsx:20-67 | No: series.set_program admin-only (M21:680) | MISSING-ADMIN-ONLY | keep |
| C13 | See + edit the SESSIONS inside one date (class + social) | date mode P/ProgramPanel.tsx:1180; tree L/occurrenceProgramTree.ts:219 | DP:199-228 list; DS:153-289 | dates/index.tsx:214,222 + dates/DateSheet.tsx:169-275, route shell/OrganiserRoutes.tsx:99, linked ONLY from events/EditorRows.tsx:38 (NEXT date) | Yes, owner/mgr: OPW:101-104 (M21:1390); refused multi-day :255-258, cancelled :260, past :263 | PARTIAL: only the next date is reachable | link from every date (see Q1) |
| C14 | Usual start / end time (series) | derived from sessions P/SchedulePanelV2.tsx:1716 | none after create (newEvent.ts:240,258) | start only: events/Details.tsx:119 "Time"; NewFlow.tsx:246 | Yes: `default_local_start_time`, `default_duration_minutes` M21:648 | PARTIAL: no end/length | add optional end |
| C15 | Repeat rule | E/WhenSection.tsx:863-1042 (all patterns) | ES:311-330 weekly one weekday | flows/event/EventStep.tsx:34,44 (change the day); create flows/new/model.ts:36-38 | Yes: series.set_recurrence (member kind M21:630) | MATCH for weekly; other patterns DROPPED-BY-DECISION (D55) | keep |
| C16 | Stop repeating / last date | P/SchedulePanelV2.tsx:1827; E/StopRepeatingDialog.tsx:449-498 | "Listed until" EEP:250-254 -> ES:346-360 (until_date EM:175); Extend EEP:255-259 | flows/event/EventStep.tsx:59-60 (keeps every coming date) | Yes: stop_repeating, set_recurrence until | PARTIAL: no "until date / N dates" choice (old had) | add until choice later |
| C17 | Add a date | P/SchedulePanelV2.tsx:2045 (series.add_date) | none direct (side effect EM:231) | flows/add/Time.tsx:64 add_date, :74 set_time; events/OneEvent.tsx:95 | Yes: add_date (future only AAW:429) | MATCH (R1 > old; 30-day window) | keep |
| C18 | Multi-day festival schedule | CV/ProgramCanvas.tsx:1294, :904, :934 | none | MISSING; refused shared/programmeModel.ts:83 | No: set_program admin-only; OPW refuses multi-day :255-258 | DROPPED-BY-DECISION (3.16 "multi-day festivals: lists only", plan l.248; D54) | keep |
| C19 | Change the time of one date | drawer start+end D/OccurrenceDateDrawer.tsx:281,290 "Shifts every session" :303; per session in full date editor | per session DS:195-206 via OPW; set_time builder SC:247-251 has no caller; span header DP:156-158 | flows/change/Time.tsx:25 (one start), :46 `setTimeCommand(value, null)`; no end, no sessions shown | Yes, owner/mgr: occurrence.set_time (M21:623); ST shifts EVERY session by the delta (M21:2367-2396), end moves only the last-ending session (M21:2397-2411) | PARTIAL: no end time, sessions not shown, no per-session time, no back-to-usual | see Q4 |
| C20 | Move one date to another day | bulk_shift P/SchedulePanelV2.tsx:1692 (custom/one-off only :2176) | one-date event only EM:232-236 | flows/change/Day.tsx:39 sends `occurrence.move_date` (shared/seriesCommands.ts:19,248) | **No handler on prod**: not in v_owner_kinds (M21:621-626) -> `permission_denied ... admin-only` (M21:680). Waits on A1 (D39) | PARTIAL + **BROKEN-ON-PROD** | ship only after A1; else hide row |
| C21 | Different venue for one date | D/OccurrenceDateDrawer.tsx:355 (set_override :129) | DS:345-388; UDE:148-156 | flows/change/Venue.tsx:40,57; also dates/index.tsx:188 | Yes: set_override `venue_id, city_id` M21:639 | MATCH | keep |
| C22 | Line-up (teachers/DJs) of one date | P/ProgramPanel.tsx:1180; D/DateCapsule.tsx:269-397 | DS:226-274, search DS:294-341 | dates/DateSheet.tsx (same page as C13), reach events/EditorRows.tsx:38 | Yes: OPW people_add/remove (teaching/djing, <=12) | PARTIAL: next date only | as C13 |
| C23 | Cancel one date (with reason) | P/SchedulePanelV2.tsx:1547; D/DateCancellationCard.tsx:75 | DS:392-423; DP:296 | flows/cancel/WhichDate.tsx:48, Confirm.tsx:102,122; dates/index.tsx:242 | Yes: occurrence.cancel (member kind M21:630; keys M21:641; future only AAW:414) | MATCH | keep |
| C24 | Take a date off (break week) | P/SchedulePanelV2.tsx:322,338 (skip_date :1480) | DP:238-240,298 | dates/index.tsx:239,298 only (via next-date link) | Yes: series.skip_date (M21:630) | PARTIAL: only the next date; not in Change or Cancel | add to Change "what" |
| C25 | Put back a cancelled / taken-off date | P/SchedulePanelV2.tsx:304, :569 | DS:113-121; DatesTakenOff.tsx:50 | events/OneEvent.tsx:111; flows/cancel/Confirm.tsx:156; events/DatesTakenOff.tsx:62 | Yes: cancel {cancelled:false}; unskip_date | MATCH | keep |
| C26 | Note / picture / ticket link for one date | date mode P/DetailsPanel.tsx:521 (set_override) | keys SC:111-113, no UI | MISSING: keys shared/seriesCommands.ts:113-115; overrideCommand only sent with venue (flows/change/Venue.tsx:40) | Yes: `description, cover_image_url, ticket_url` M21:639-640 | MISSING-ALLOWED | build (Change "what" row) |
| C27 | Scope: this date / this and future / all | E/SaveBar.tsx:172 -> E/ScopeDialog.tsx:283 | none | MISSING | No: series.apply_forward_from admin-only (M21:680) | MISSING-ADMIN-ONLY | keep |
| C28a | New event goes live from the wizard | publish E/SaveBar.tsx:186 | "Send for review" ReviewCard.tsx:55,82-86 | flows/new/NewFlow.tsx:292,312 -> flows/new/model.ts:48 `set_lifecycle live` | **Not today**: owner draft->live not in `_owner_lifecycle_transition_allowed_p5` (prod :11-15; mig 20261108190000:733). A1 adds it (R1-PLAN l.75, l.297) | PARTIAL + **BROKEN-ON-PROD** (D4 requires it) | ship only after A1 |
| C28b | Come back to a draft and make it live | E/LifecycleMenu.tsx:136; blockers E/EventEditor.tsx:1980 | ReviewCard.tsx:82-86 + readiness list :86 | MISSING: Home stale_draft -> One event (jobs/homeJobs.ts:84) which has no live action for a draft (flows/event/eventSteps.ts:45-47) | Same as C28a (after A1) | MISSING-ALLOWED | build |
| C29 | Pause / resume | E/LifecycleMenu.tsx:136 (admin_set_series_lifecycle_v1) | none (SC:236 unused) | flows/event/EventStep.tsx:11-19; events/OneEvent.tsx:133 | Yes: live<->paused (prod :11-15) | MATCH (R1 > old) | keep |
| C30a | End the event | E/StopRepeatingDialog.tsx:179 (series.end_run) | none | flows/event/EndStep.tsx:22 | Yes: series.end_run (M21:630) | MATCH | keep |
| C30b | Archive / discard a draft | E/LifecycleMenu.tsx:136 | none | MISSING (`lifecycleCommand('archived')` no caller) | Yes: draft/live/paused -> archived (prod :11-15) | MISSING-ALLOWED | discard-draft only, low |
| C31 | Reopen an ended event | E/RestoreEndedDialog.tsx:126 | none | copy only shared/eventState.ts:56-57 | No: restore_ended admin-only (mig 20260907200000:206) | MISSING-ADMIN-ONLY (R3-8) | keep |
| C32 | Delete an event | none | none | none | No: admin_delete_series_p5_v1 admin-only (:19) | MISSING-ADMIN-ONLY | keep |
| C33 | Duplicate / copy an event | E/SaveBar.tsx:124 (template) | none | none (grep `duplicat\|copy` = 0) | No: admin_duplicate_event_p5 admin-only (:41) | DROPPED-BY-DECISION (1.6 "copy/repeat event", plan l.34) | keep |
| C34 | Private / unlisted | none | none | none | No RPC for anyone | MISSING-ADMIN-ONLY (nobody has it) | keep |
| C35 | Level (+ age/dress/capacity) | session levels CV/ProgramCanvasSessionCard.tsx:1483 only | session levels DS:210-224 | events/Details.tsx:119 "Level"; dates/DateSheet.tsx:217 | Yes: `default_level` M21:649 | MATCH (no age/dress/capacity anywhere) | keep |
| C36a | Team: add, change role, remove, hand over | none (not in editor) | team/index.tsx:273,283,299,342,380-387 | team/AddSomeone.tsx:54; team/Person.tsx:59-106; flows/handover/Confirm.tsx:29,61 | Yes: organiser_team_* (shared/teamRpcApi.ts:23-50) | MATCH | keep |
| C36b | Contributor role | n/a | team/index.tsx:273 role choice | none | Server keeps it; contributor can edit nothing | DROPPED-BY-DECISION (D41) | keep |
| C37 | Someone-else-changed-it handling | E/VersionConflictBanner.tsx:92 | EEP:134-142; UDE:168-171 | EventConflict: events/Details.tsx:98; flows/change/Time.tsx:28 | expected_version on every envelope | MATCH (no merge; R3-7) | keep |
| C38 | Open the public event page | E/SaveReceiptCard.tsx:245 | card preview EEP:38-50, no link (editorGuards.ts:26 unused) | MISSING (only date card dates/index.tsx:260) | read only, no RPC | MISSING-ALLOWED | build (one link) |
| C39 | List of dates | P/SchedulePanelV2.tsx:2294, filters :2101 | ER:74-121 (upcoming + past, each opens DP) | events/OneEvent.tsx:29-101; flows/change/WhichDate.tsx:243-248; `DatesList` events/EditorRows.tsx:75 has no importer | admin_event_workspace_p5 (100 cap, R3-20) | PARTIAL: no past dates; rows do not open sessions | link rows (Q1) |
| C40 | One date -> weekly (change shape) | E/EventShapeControl.tsx:108; E/ConvertModeDialog.tsx:421 | ES:311-345, EM:218-231 (recurring with no rule only) | MISSING (only Stop repeating; eventModel.ts:176-239 savePlan is test-only) | Partly: set_recurrence on a `recurring` series yes; format change admin-only M21:652-654 | MISSING-ALLOWED | "Make it weekly" on OneEvent, low |
| C50 | Create a new event (wizard) | create mode E/useEditorV2Workspace.ts:1624 | NewEventPage.tsx:158-194 | flows/new/NewFlow.tsx:122,140 | Yes: upsert create AAW:382-396 | MATCH (formats per D54) | keep |
| C51 | Course length (N weeks) | E/WhenSection.tsx:1085-1120 | none | none (course not created, D54; stop disabled eventSteps.ts:48-49) | No: course_total_sessions not an owner key (M21:647-651) | MISSING-ADMIN-ONLY | keep |
| C52 | One session's name / type / start / end on one date | CV/ProgramCanvasSessionCard.tsx:1040,725,912,939 | DS:172-206 (type fixed after save DS:169) | dates/DateSheet.tsx:169-275 (type fixed :170-174) via EditorRows.tsx:38 | Yes: OPW (changing an existing session's type admin-only, OPW:311) | PARTIAL: next date only | as C13 |
| C53 | Session levels on one date | CV/ProgramCanvasSessionCard.tsx:1209 | DS:210-224 | dates/DateSheet.tsx:217 | Yes: OPW `level_keys` | PARTIAL: next date only | as C13 |
| C54 | Add a session to one date | D/DateCapsule.tsx:182 (set_session_delta added) | DP:219-228 | dates/index.tsx:222 | Yes: OPW new sessions | PARTIAL: next date only | as C13 |
| C55 | Remove a session from one date | CV/ProgramCanvasSessionCard.tsx:854 (cancelled); remove_added | DS:277-285, undo DP:215 | dates/DateSheet.tsx:286 | Yes: OPW `removed:true` | PARTIAL: next date only | as C13 |
| C56 | Session room / rooms list | CV/ProgramCanvasSessionCard.tsx:1338-1424; E/RoomTimetableGrid.tsx:803-841 | none | none (grep `room` = 0) | No: OPW has no room keys; series.set_rooms admin-only (mig 20261107900000:36) | MISSING-ADMIN-ONLY | keep |
| C57 | Whole-series programme: sections, timetable grid, parallel, reorder, duplicate | CV/ProgramCanvas.tsx:476-674; E/RoomTimetableGrid.tsx:158-705; CV/SessionCardOverflowMenu.tsx:81-106 | none | none | No: series.set_program admin-only | MISSING-ADMIN-ONLY | keep |
| C58 | Cancel or shift many dates at once | P/SchedulePanelV2.tsx:1653 (bulk_cancel), :1692 (bulk_shift) | none | none | Technically yes: admin_bulk_occurrence_command_p5 :75,:127 admits owner/mgr (Website never calls it) | MISSING-ALLOWED | do not build in R1 (one-by-one covers it) |
| C59 | Open ANY date's session editor | E/EventEditor.tsx:1996; row pencil P/SchedulePanelV2.tsx:293; D/DateScopeBar.tsx:113,128 | every row ER:74-121 opens DP | only next date events/EditorRows.tsx:38; Change "what" has 3 rows, no line-up (flows/change/WhatChanges.tsx:13-15) | Yes: OPW any future, non-cancelled date | PARTIAL | build (Q1) |
| C60 | Copy one date's changes from another date | D/DateScopeBar.tsx:160 | none | none | Partly: the 6 owner override keys | MISSING-ALLOWED | do not build |
| C61 | Put a date back to the usual time / details | D/OccurrenceDateDrawer.tsx:230 (set_time reset); E/EventEditor.tsx:835 | resetTimeCommand SC:251 no caller; usual venue clears override | venue: picking usual venue clears (flows/change/Venue.tsx:40); time: none | Yes: set_time `{reset:true}` validated for owners M21:919-922 | PARTIAL: no time reset | add "Back to usual time" in C19 |
| C62 | Featured flag / promotion log | P/DetailsPanel.tsx:856; P/PromotionPanel.tsx:557-671 | none | none | No: `featured` not an owner key (M21:636-638); promotion RPCs admin_* | MISSING-ADMIN-ONLY | keep |
| C63 | Review / approval step | E/LifecycleMenu.tsx:136 (pending_review, rejected) | ReviewCard.tsx:55 | none | owner draft->pending_review allowed today | DROPPED-BY-DECISION (D4, D57; 4.1) | keep |
| C64 | Undo the last change | D/OccurrenceDateDrawer.tsx:379; D/DateCapsule.tsx:249 | undo before save DP:215,332 | none | organiser_undo_last_change_v1 :38 owner/mgr | DROPPED-BY-DECISION (D49) | keep |
| C65 | Pending-changes tray / discard | E/PendingChangesTray.tsx:187-210; E/SaveBar.tsx:149 | unsaved guard EEP:90, DP:64 | none (each screen sends at once) | n/a | DROPPED-BY-DECISION (D35) | keep |
| C66 | Why a date cannot be edited | P/ProgramPanel.tsx:1130 (date-scope note) | DP:196-198 | shared/programmeModel.ts:78-85 | reader `not_editable_reason` | MATCH | keep |
| C67 | Home to-do list (no dates, draft, no cover, join request) | n/a | home/index.tsx:157,167 | home/index.tsx:30; jobs/homeJobs.ts:108-130 | n/a (navigation) | MATCH (R1 > old) | keep |
| C68 | Edit the organiser page | n/a | pages/OrganiserProfile.tsx:564 | page/index.tsx:49-63; fields edit-in-place/fieldRules.ts:17-31 | Yes: organiser_profile_update_p5_v1 :48 | MATCH | keep |
| C69 | Organiser WhatsApp on My page | n/a | none | Home asks "Show your WhatsApp" (jobs/homeJobs.ts:94-96) but FieldKey has no WhatsApp (edit-in-place/fieldRules.ts:17-31) | **No**: no `*whatsapp*` column on any organiser table and `organiser_profile_update_p5_v1` / `organiser_home_v1` never mention it (prod, 2026-10-17) | MISSING-ADMIN-ONLY + **BUG** (copy points at a control that cannot exist; the step shows for everyone, always) | remove the Home step |
| C70 | Get a page: claim, ask to join, create | n/a | home/onboarding/OrganiserSheet.tsx; API:170,176 | home/onboarding/OrganiserSheet.tsx:91-92; flows/newpage/NewPageFlow.tsx:64; more/index.tsx:89 | Yes: claim_organiser_v1, request_organiser_access_v1, create_organiser_profile_v1 | MATCH | keep |
| C71 | Switch page; support contact | n/a | none found (no `switch/` folder on main) | switch/index.tsx; more/index.tsx:112-114 | n/a | MATCH (R1 only, D7) | keep |

Row counts: 66 rows. MATCH 24 (C15 counted as MATCH), PARTIAL 15 (2 of them BROKEN-ON-PROD: C20, C28a), MISSING-ALLOWED 9, MISSING-ADMIN-ONLY 11 (C69 also a BUG), DROPPED-BY-DECISION 7. R1 does nothing the server reserves for admins except the two BROKEN-ON-PROD sends.

## The sessions question (asked directly)

**What the model is.** A series has a programme tree: day (`date_offset_days`; >0 = multi-day) -> section (kind) -> item (title, type class/party/masterclass/show/competition, start/end London wall clock, level_keys, room, people with role). Every date inherits every item, so "class 20:00-21:00 + social 21:00-02:00" is two items in one day. A date changes them through `event_occurrence_session_override_p5` (per item: times, title, cancelled, people added/removed) and `event_occurrence_added_session_p5` (sessions on that date only). The effective programme of a date = items + overrides + added sessions (`_compute_effective_occurrence_p5`). Prod: **53 of 67 live series have 2+ sessions in one day, 46 mix a class with a party**; max 16 in a day; 55 have people on sessions.

**What the admin editor shows.** Full date editor: every session of the date as a card (P/ProgramPanel.tsx:1180) or a room timetable, each with its own start/end (CV/ProgramCanvasSessionCard.tsx:912,939), saved as `occurrence.set_session_delta`. Quick date drawer: ONE start/end pair seeded from the date's effective start/end (D/OccurrenceDateDrawer.tsx:106-109, inputs :281,:290), the line "Shifts every session on this date. Fine-tune individual sessions in the Full date editor." (:303), and counts only ("N session edits", "+N added sessions", :255-259).

**What an organiser may edit on prod.** Owner/manager only. (1) `occurrence.set_time`: one new start (+ optional end) for a date; the server moves EVERY session by the same delta (M21:2367-2396) and, if an end is given, sets it on the last-ending session only (M21:2397-2411); `{reset:true}` puts the date back. (2) `organiser_set_occurrence_programme_v1`: one date's full session list -- each session's name, start/end, levels, remove, add new, teachers/DJs; not rooms, not changing an existing session's type, not on multi-day/cancelled/past dates. Series-wide programme (`series.set_program`) and `occurrence.set_session_delta` are admin-only.

**What R1 "Change time" does.** One start box seeded from the date's own start (flows/change/Time.tsx:25), sends `set_time(start, null)` (:46). On a class+social night the social moves too, silently: the screen never says it will, never shows the sessions, has no end, no per-session time, and no "back to usual time".

**What "Change time" would need to show** (no server change, no new RPC):
1. Read the date's sessions with the existing `organiser_get_occurrence_programme_v1` (already used by events/EditorRows.tsx for the Schedule card).
2. If 1 session: start + end boxes (end optional; server keeps the length).
3. If 2+ sessions: list them (name, kind, start-end), one "new start" box, and a live preview of every session's NEW times (the same +delta the server applies), plus the line "Every session moves by 1 h". End box labelled with the last session's name.
4. A row "Change one session's time" that opens the per-date session editor for THIS date (route already at shell/OrganiserRoutes.tsx:99).
5. "Back to usual time" when the date has a time change (`resetTimeCommand`, allowed for owners M21:919-922).

## (a) Ranked: MISSING-ALLOWED and PARTIAL by how often a real organiser needs it

Weighting caveat: today prod has only **4 organiser memberships (all owners), 0 managers, 0 contributors, and 1 live series with an owner/manager member**; 50 active legacy team-roster rows exist but whether any let a user edit is unverified. The counts below describe the 67 live (admin-made) series that organisers would inherit once they claim them -- they measure how common each SHAPE is, not current organiser traffic.

| rank | row(s) | why it matters (prod count) |
|---|---|---|
| 1 | C13, C22, C52-C55, C59 -- per-date sessions/line-up reachable for the next date only | 53/67 live series have 2+ sessions a day; 55 have a line-up; 13 have date-only added sessions, 18 session overrides, 10 per-date line-up changes |
| 2 | C19 + C61 -- Change time hides sessions, no end, no reset | same 53/46; 11 series already carry per-date time overrides |
| 3 | C20 move_date -- BROKEN-ON-PROD | every Move tap fails today with "admin-only" until A1 |
| 4 | C28a / C28b -- go live from wizard (BROKEN-ON-PROD) and come back to a draft | every new event; 6 drafts on prod, 4 older than 7 days (the Home job that sends them to a page with no Go live) |
| 5 | C69 -- "Show your WhatsApp" points at nothing | shown to every organiser on every visit (field never exists) |
| 6 | C26 -- note / picture / ticket link for one date | per-date overrides on live series: cover 25, description 21, ticket_url 11 series |
| 7 | C06 -- gallery / videos | 15 live series have a gallery, 14 have videos |
| 8 | C24 + C39 -- take a date off only via next date; no past dates | 44 live weekly series |
| 9 | C16 -- no "until" for stop repeating | 44 weekly |
| 10 | C14 -- no usual end / length | all series; low pain (server keeps length) |
| 11 | C40 -- one date -> weekly | 9 live `recurring` series have no rule |
| 12 | C38 -- link to the public page | every edit; cheap |
| 13 | C09b -- price list | 3 live series with passes (51 with a ticket link) |
| 14 | C30b -- discard a draft | 6 drafts |
| 15 | C58, C60 -- bulk dates, copy from another date | admin conveniences; recommend not building |

## (b) Smallest R1 change that closes each

| row | screen | command / read | new read? | admin RPC change? |
|---|---|---|---|---|
| C13/C22/C52-55/C59 | flows/change/WhatChanges.tsx: 4th row "Sessions and line-up" -> `ORG_PATHS.dateLineup(seriesId, occurrenceId)`; make Coming-date rows on events/OneEvent.tsx open the same | OPW (existing) | no | no |
| C19 + C61 | flows/change/Time.tsx: sessions list + preview + end box + "Back to usual time" (spec above) | `occurrence.set_time` start/end, `{reset:true}` | reuse `organiser_get_occurrence_programme_v1` | no |
| C20 | flows/change/Day.tsx | `occurrence.move_date` | no | **yes: A1 (D39)**; until it lands, hide the row |
| C28a | flows/new/model.ts:48 | `set_lifecycle live` | no | **yes: A1 owner draft->live** |
| C28b | events/OneEvent.tsx + flows/event/eventSteps.ts: "Go live" action when `lifecycle_status='draft'`, disabled with the missing item named | `set_lifecycle live` | readiness (`event_publish_readiness_v1`, plan l.355 says it lacks cover/session rules) | A1 (same) |
| C69 | jobs/homeJobs.ts:94-96: delete the `show_whatsapp` step (or keep it only once a column + update key exist) | none | no | only if the owner wants the field: new column + profile-update key |
| C26 | flows/change/WhatChanges.tsx rows "Note / ticket link / picture this date only" | `occurrence.set_override {description \| ticket_url \| cover_image_url}` | no | no |
| C06 | events/Details.tsx:106,138: open the existing gallery/video sheets; implement onUploadGallery | `series.upsert default_gallery / default_video_urls` | no | no |
| C24 | WhatChanges row "Take this date off" on rule dates | `series.skip_date` | no | no |
| C39 | events/OneEvent.tsx: "Past dates" collapsed list (DatesList already exists, unimported) | none | no | no |
| C16 | flows/event/EventStep.tsx stop step: "until" choice | `set_recurrence` until / `stop_repeating` keep-list | no | no |
| C14 | events/Details.tsx "Time" row: optional end | `default_duration_minutes` | no | no (verify the effect on sessions first, see (d)) |
| C40 | events/OneEvent.tsx: "Make it weekly" for `recurring` + no rule | `series.set_recurrence` | no | no |
| C38 | flows/Done.tsx + events/OneEvent.tsx: "See it live" link | none | no | no |
| C09b | events/Details.tsx "Prices" row | `default_passes` | no | no (owner decision first) |
| C30b | events/OneEvent.tsx draft: "Discard draft" | `set_lifecycle archived` | no | no |
| C58, C60 | not recommended | -- | -- | -- |

## (c) The test that would have caught it -- a parity matrix the repo keeps

File: `src/modules/organiser/__tests__/parity-matrix.test.ts` (table-driven vitest; names only). One source table `PARITY` = this doc's rows: `{ id, capability, verdict, r1Screen, command, payloadKeys, reachableFrom[] }`. Every MATCH/PARTIAL row names the R1 screen module and the command builder it must call.

```
describe('organiser parity matrix', () => {
  describe.each(PARITY.filter(isBuilt))('$id $capability', (row) => {
    it('R1 screen module exists and exports a route in OrganiserRoutes')
    it('the screen sends exactly row.command with only row.payloadKeys')
    it('row.command is in the owner allowlist snapshot (v_owner_kinds) -- else BROKEN-ON-PROD')
    it('payload keys are a subset of the owner key snapshot (upsert / override / cancel)')
    it.each(row.reachableFrom)('reachable from %s (Home, One event, Change what, Coming-date row)')
  })
  describe.each(PARITY.filter(isMissingAllowed))('$id $capability', () => {
    it.todo('listed as MISSING-ALLOWED: fails when the owner decision table gains a D-number for it')
  })
  describe.each(PARITY.filter(isDropped))('$id', (row) => {
    it('cites a D-number that exists in R1-PLAN.md')
  })
  describe.each(SESSION_SHAPES)('date shape %s', (shape) => {   // 1 session; class+social; 3+ with rooms; added-only; overridden time; multi-day; cancelled; past
    it('Change time shows every effective session of the date')
    it('Change time preview equals the server shift (start + delta for each session)')
    it('Change time offers an end box and Back to usual time when has_time_override')
    it('Change what offers Sessions and line-up for any editable date, not only the next')
    it('Coming-date row opens the per-date session editor')
    it('multi-day / cancelled / past shows the not-editable reason, no Save')
  })
  describe('copy points only at controls on screen', () => {
    it.each(HOME_JOBS)('home job %s routes to a screen that has the field it names')   // catches show_whatsapp
    it('every draft surface offers Go live or names what is missing')                  // catches C28b
  })
})
```

Fixtures: `SESSION_SHAPES` built from the prod survey (53/46/16-max/added/overridden/multi-day 7). The owner-allowlist snapshot is a JSON copy of `v_owner_kinds` + key arrays from M21:621-659, refreshed by a contract script (`scripts/check-*.mjs`) so a server change reddens the matrix.

## (d) Verified / Not verified

**Verified (opened the line in the repo, 2026-10-17):**
- R1 e04dea0: flows/change/Time.tsx:25 (one start), :46 (`setTimeCommand(value, null)`); flows/change/WhatChanges.tsx:13-15 (3 rows, no line-up); shell/OrganiserRoutes.tsx:99 (`/lineup` = DatePage); events/EditorRows.tsx:38 (next date only), :75/:84 `DatesList` with no importer; shared/seriesCommands.ts:19,248 + flows/change/Day.tsx:39 (`occurrence.move_date`); jobs/homeJobs.ts:84,94-96; edit-in-place/fieldRules.ts:17-31 (no WhatsApp key); flows/event/eventSteps.ts:40-50 (no live action for a draft); events/Details.tsx:106,117-119,138; dates/index.tsx:239,298; flows/change/Venue.tsx:40; flows/add/Time.tsx:64,74; flows/event/EndStep.tsx:22; flows/new/model.ts:48; shared/programmeModel.ts:78-85.
- Old c36fbaf: DS:195-206 (per-session Starts/Ends); DP:156-158 (span header); UDE:145-157 (venue override), :165 (programme writer); SC:247-251 (`setTimeCommand`/`resetTimeCommand`, grep: no caller); home/onboarding/OrganiserSheet.tsx exists.
- Admin a12a21a6: D/OccurrenceDateDrawer.tsx:106-109, :162-182, :255-259, :281/:290 inputs, :303 copy; P/SchedulePanelV2.tsx:1545-1549 (cancel); P/ProgramPanel.tsx:1128-1131, :1180.
- Server (migration text = prod per ledger): M21:621-634 owner + member kinds, :636-659 key arrays, :680 admin-only refusal, :919-922 reset, :1388-1392 OPW gate, :2207-2416 set_time shift + end rule.
- R1-PLAN lines 33-37 (1.6), 72 + 75 + 297 (owner lifecycle, A1), 242 (D39), 248 (3.16), 252 (D41), 275 (4.2), 394 (D49), 471-472 (D54/D55), 474 (D57).
- Prod read-only counts re-run this session: live gallery 15, video 14, Instagram 17, recurring-without-rule 9, drafts 6 (4 > 7 days); no `*whatsapp*` column on any organiser table; the 4 organiser functions above never mention WhatsApp. Other counts from the server inventory (SQL in parity/prod-counts.md).

**Not verified:**
- Prod function-body line numbers (AAW:n, OPW:n, handler :n) were taken from the server inventory, not re-read; their migration-file twins were spot-read for AAW.
- Whether `series.upsert default_local_start_time` (R1 Details "Time") changes anything on a series whose times come from programme sessions (53 of 67) -- if not, that row is a silent no-op. Needs a read of `_cmd_series_upsert_p5`.
- Whether any of the 50 active legacy `organiser_team_members` rows lets a real user pass `_assert_can_edit_series_p5`.
- Old-editor citations other than those listed above, and admin citations other than those listed above, come from the inventories (not re-opened).
- No browser walk; no test run; nothing tested on E2E.
