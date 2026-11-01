# ARC-p3: the rest of the P3 organiser area (replan, 2026-10-27)

Docs only. Written on `claude/p3-arc-plan` from `main` a090c97 (W2a #1057 merged). Flag `organiserP3`
is OFF. Slice order is the owner's and is not reopened here: W0 (merged #1041) -> W1 (merged #1047) ->
W2a (merged #1057) -> W2c (built on `claude/p3-cancel-one-off`, PR #1058) -> W2b dates -> W2d sessions
and line-up -> W3 later. This file replans the DETAIL of each remaining slice.

Sources: `docs/organiser-rebuild/p3/CONTRACT.md` (branch `claude/p3-a0-contract`), mockup C3
(`claude/er-p3-c3-test`), `docs/design/1057.md`, `docs/design/1058.md`, the W2a and W2c briefs, the merged
code under `src/modules/organiser/p3/`, and a read-only look at prod (project `stsdtacfauprzrdebmzg`,
counts and function names only, 2026-10-27).

## 1. Goal and done-state

1. One organiser area at `/account/p3` where an organiser on a phone can see every event and change it
   without the old `/account/o` flows: status, dates, sessions and line-up, then name/details, prices,
   repeat, history and copy (W3).
2. Done for this arc = W2c, W2b and W2d merged, every edit on the event page served inside P3, and the
   remaining "Change it in the current area" links limited to W3 screens, each saying so.
3. Every write goes through the existing envelope (`series_command_p5` / `occurrence_command_p5`, fresh
   idempotency key, `expected_version`), existing builders in `shared/seriesCommands.ts`, refusals via
   `COMMAND_COPY`, one model (`p3/model/`) and one label list (`L`). No second mapping anywhere.
4. Turning `organiserP3` ON: it is a build-time Vite boolean (`VITE_ENABLE_ORGANISER_P3`,
   `src/lib/featureFlags.ts:67`), so ON means a Vercel env change plus a redeploy, for everyone at once;
   there is no per-user switch. Recommended order: a preview deploy with the flag on for the owner's
   phone check (stage 6), then prod. First to see it: the owner's own organiser account; the old area stays
   mounted, so nobody loses a flow.
5. Rollback = set the env back to off and redeploy. No DB state belongs to P3 (P3 writes the same commands
   the old area writes), so rollback needs no data step.

## 2. Remaining slices

Prod owner command allowlist as of 2026-10-27 (`check_owner_command_allowlist_v1` `c_expected`, matched by
`command_dispatch_p5`, all enabled): `occurrence.cancel`, `occurrence.move_date`, `occurrence.set_override`,
`occurrence.set_time`, `series.add_date`, `series.apply_forward_from`, `series.cancel_one_off`,
`series.end_run`, `series.remove_date`, `series.set_group_chat`, `series.set_lifecycle`,
`series.set_organisers`, `series.set_program`, `series.set_recurrence`, `series.set_session_forward`,
`series.skip_date`, `series.stop_repeating`, `series.unskip_date`, `series.upsert`. In dispatch but NOT
owner-admitted (admin only): `occurrence.set_session_delta`, `series.set_rooms`, `series.restore_ended`.
The Website's `OWNER_COMMAND_KINDS` (`shared/seriesCommands.ts:14`) carries 13 of these; `series.set_program`
and `series.set_organisers` sit in `AW1_COMMAND_KINDS` behind `shared/parityGate.ts`; W2c adds
`series.cancel_one_off`. Not yet in the Website at all: `series.set_session_forward`.

Model/effort key: Opus = logic (data, model, commands, matrix tests); Sonnet = screens, copy, handover
docs, screenshots; Fable = review of a guard, RPC or migration only (none of these slices adds one, so
Fable reviews nothing in W2c/W2b/W2d; see section 3 for the admin items it does review).

| Slice | Scope IN | Scope OUT | Screens / sheets (C3 ids) | Commands (all prod-admitted unless marked) | Test matrix shape (prod shapes to survey) | Design Gate stages | Risks | Parallel / serial | Model, effort |
|---|---|---|---|---|---|---|---|---|---|
| W2c cancel one-off (built, #1058, awaiting review/merge) | "Cancel the event" row enabled by `canCancelOneOff`; `CancelEventSheet` with reason picker; toast "Cancelled. Bring it back"; refusal copy for the AD4 tokens | Date sheet on a one-off (no date sheet exists yet; W2b wires it to the SAME sheet) | Status sheet row + `cancelnext` as `CancelEventSheet` | `series.cancel_one_off {reason}` (prod: yes); undo `occurrence.cancel {cancelled:false}` (yes) | one-off x {live ahead, live today before start, today after start, passed, cancelled, paused, draft, no start time, 0 dates, 2 dates} + each other kind (row absent). Prod: 11 live one-offs, 10 with no coming date, 1 paused, 2 drafts (1 with no start time) | 2 (C3 `cancelnext`), 4 (contrast + walk, done in #1058), 5/6 owner | Reason list drift (one list, `fetchCancellationReasons`); `already_cancelled` treated as success | Serial: merge before W2b (W2b mounts its sheet) | Review: Opus high (no guard/RPC); docs Sonnet |
| W2b dates | Date sheet on a Coming row; All dates screen (`events/:id/dates`, filters, "100 of N"); per date: cancel / bring back (recurring, course, custom, monthly), move, change time / reset, skip week / put back, add a date, remove an added date, "Different details this date" (Where, About, Ticket, cover) and "Put this date back to normal"; one-off date row opens the W2c `CancelEventSheet` | Per-date sessions (W2d); per-date name / music / photos / price (W3, see Q3); bulk cancel / shift (`admin_bulk_occurrence_command_p5`, admin-shaped, no C3 sheet); "Copy changes from another date" (out of P3) | `dayown` date sheet, `dtime`, move (`adddate` calendar), `skip`, `resetdate`, `cancelnext` (recurring wording), All dates list | `occurrence.cancel {cancelled, reason}` (yes), `occurrence.move_date {to_date}` (yes), `occurrence.set_time {new_local_start, new_local_end}` / `{reset:true}` (yes), `series.skip_date {occurrence_id}` / `series.unskip_date {date}` (yes), `series.add_date {date}` / `series.remove_date` (yes), `occurrence.set_override` with `venue_id`, `city_id`, `description`, `ticket_url`, `cover_image_url` (yes; keys already in `OWNER_OVERRIDE_KEYS`). Reset to normal = composite of 3 calls (CONTRACT 2), no new command | Kind x date state: {recurring, course, monthly, custom, one-off, festival} x {coming, today, past, cancelled, skipped, moved, own time, own details, added date} x list size {0, 1-3, 4-30, over 30, over 100}. Prod (live+paused): 1543 coming dates; recurring 44 live (26 with over 30 coming, max 57; 3 with a cancelled coming date; 8 with skipped dates); course 6 (2 with no coming date, 1 skipped, 4 with `course_total_sessions`); festival 8 (max 1 coming date); 66 coming dates carry an override row across 10 series (keys: venue_id 59, city_id 59, cover 47, description 45, ticket_url 43, gallery 3, title 1); 0 coming dates with a custom time; 131-date series over the 100 cap (W2a) | 2 (C3 date sheet, `dtime`, `skip`, `resetdate`), 4 (contrast test rows for new tags; walk 390x844 light+dark per state above; metrics.jsonl), 5/6 owner | Date version vs series version (DateStep sends against the date's version; a stale page gets `version_conflict`: reload copy exists). `date_taken` on move. `has_bookings` on skip (copy exists). The "100 of N" cap hides dates the sheet may need (CONTRACT A2 R3; show the cap honestly, never page client-side from a second read). Course re-count after skip is A2 R2 (show "Class n of N" from stored total only). Festivals: `set_time` and `move_date` refused (grey with reason) | Can run in parallel with W2d on disjoint files: W2b owns `p3/screens/DateSheet.tsx`, `AllDatesScreen.tsx`, `p3/data/dates.ts`, `p3/model/dates.ts`, the Coming rows and "All dates" link in `EventPage.tsx`, route `events/:id/dates`. Shared files touched by both (`labels.ts` L, `P3Routes.tsx`, `paths.ts`, `wsFixtures.ts`) are append-only; the second to merge rebases | Opus high (model, data, matrix); Sonnet (sheets, copy, handover). Two review rounds (user-facing) |
| W2d sessions and line-up | Session sheet from a Sessions row: what it is, name, times, room (chips only at venues with 2+ rooms), level, line-up (teacher / DJ / performer); scope "Every date" and "Just this date"; add a session (every date; this date only); remove from every date / from this date; "Not running on this date"; line-up add / remove per scope; the #25 empty-session bug fixed | "From X on" (scope `scopeFrom`) unless Q1 says yes; festival programme (refused for owners, read-only with "Ask us"); rooms editing (`series.set_rooms` admin only); the `mc` role (1 row, no C3 word) | session sheet, line-up sheet, `removeall`, scope picker; per-date session rows in the date sheet (reads `organiser_get_occurrence_programme_v1`) | Every date: `series.set_program {days}` (prod: yes; Website: behind `AW1_COMMAND_KINDS` / `parityGate.ts`, must be opened for P3 only, see Q2). This date: `organiser_set_occurrence_programme_v1` (prod: yes; people_add / people_remove). Line-up search: `organiser_search_people_v1`, cast: `organiser_series_cast_v1` (yes). From X on: `series.set_session_forward {item_id, from_date, patch, dry_run?}` (prod: ADMITTED, see section 3; Website: no builder yet) | Kind x session count x line-up x scope: {recurring, course, one-off, festival (read-only)} x items {0, 1, 2-3, 4+, 16} x {no time, room-bound, level set} x line-up {empty, 1, several, mc role} x scope {every, just this} x date {coming, today, past, cancelled}. Prod (live+paused): recurring 45 series (4 with 1 item, 30 with 2-3, 11 with 4+, max 16; 10 with room-bound items); one-off 12 (1 with 0 items, 1 untimed item, 1 room-bound); course 6 (max 2 items); festival 8 (all 4+, max 14); 194 line-up rows on 111 items; roles teaching 204, djing 77, performing 1, mc 1 | 2 (C3 session + line-up sheets), 4 (contrast; walk per state above), 5/6 owner | `series.set_program` sends the WHOLE programme (`{days}`): a stale read overwrites a concurrent change (`expected_version` catches it: reload copy). It refuses removing an item that has per-date overrides (copy exists). Per-date programme is refused on cancelled, past, multi-day, ended dates (grey with reason). The derived kind (`eventCategory.ts`) changes when session types change: render with the shared word, never a picker | Parallel with W2b (see left): W2d owns `p3/screens/SessionSheet.tsx`, `LineupSheet.tsx`, `p3/data/sessions.ts`, `p3/model/programme.ts`, the Sessions rows in `EventPage.tsx`, the parity-gate opening | Opus high (programme model, save, matrix); Sonnet (sheets, pickers, handover). Two review rounds |
| W3 later | Name and details with ONE save model (tray, leave guard, "Undo my changes" with confirm; #26); Prices; Repeat; History (read) + Undo; Make a copy; create flows (new event, new one-off, new course); per-date name / music / photos / price (#59/#106); socials, video, chat link; "Different on N dates" under Where / About / Ticket (#63) | Change the kind (no command; out of P3); WhatsApp column; festival programme; queued saves (#148) | Name and details, Prices, Repeat, History, copy, `addnew`, `socials`, `chat`, `convert` (toast only) | Live now: `series.upsert` (yes), `occurrence.set_override` + Website keys `title`, `music_styles`, `gallery`, `passes` (prod admits them; `OWNER_OVERRIDE_KEYS` lacks them), `series.set_group_chat` (yes), `organiser_series_history_v1` read (yes, no caller). Gated: Repeat beyond weekly = A2 R1 (NOT landed: `_owner_weekly_rule_problem_p5` still the owner validator); History Undo beyond `series.upsert` = A3 R2 (NOT landed); Make a copy = A3 R3 (NOT landed: `admin_duplicate_event_p5` only) | Every live/draft shape x every field x {untouched, one field, several, invalid URL, long description, passes invalid}; Repeat: weekly only until A2 R1; History rows per audit kind | 2 (C3 edit screens), 4, 5/6; plus a fresh brief per sub-slice | Save-model regressions across every edit screen (one component, matrix per screen); Repeat regeneration semantics; A2/A3 timing | Serial after W2b and W2d (the save model touches every edit screen). Split into W3a details + prices (live), W3b History read + per-date fields (live), W3c Repeat / Undo / copy (after admin) | Opus xhigh for the save model and Repeat; Sonnet screens; Fable reviews the admin migrations only |

Design Gate as used by #1057 and #1058: stage 2 = the C3 reference named per sheet; stage 4 = self-running
checks in the PR (contrast rows in `p3Theme.contrast.test.ts`, a measured 390x844 walk light + dark with
`metrics.jsonl` and PNGs under `docs/handover/<slice>/`, per-job CI table); stages 5/6 = owner screenshot
review and phone check, the orchestrator's. Each slice ships a `docs/design/<pr>.md` with the "matches C3 /
does not and why" table.

## 3. Dependencies on the admin repo (careful lane; list only, never built here)

Checked read-only on prod 2026-10-27. Newer than CONTRACT.md on two points (A1 and part of A2 R3).

| Item | Prod state now | Needed by | Action (admin repo, Fable review) |
|---|---|---|---|
| A1 forward rule (`series.set_session_forward`, table `event_series_program_item_forward_p5`) | LANDED: command admitted for owners, handler takes `{item_id, from_date, patch, dry_run?}`, patch keys `title, start_time, end_time, ends_next_day, level_keys, room, venue_room_id, people`; table exists with 0 rows | W2d "From X on" (Q1) | None to build. Before the Website uses it: read-only confirmation that the public readers and `organiser_series_cast_v1` apply forward rows (the cast function body does not mention forward; the workspace body mentions `program_forward`). A worker must not send a `dry_run` call to check: that is a write RPC |
| A2 R3 workspace reader (`override_keys`, `program_forward`, counts, paging) | PARTLY: `admin_event_workspace_p5` mentions `override_keys` and `program_forward`; the 100-date cap is still there (W2a shows "100 of 131") | W2b "Different on N dates" per field, All dates over 100 | Paging or a higher owner cap is an admin item; until then W2b shows the cap honestly |
| A2 R1 owner Repeat rule widening (monthly, several weekdays, end after N, course counting) | NOT landed (`_owner_weekly_rule_problem_p5` is still the validator; `_cmd_series_set_recurrence_p5` unchanged) | W3c Repeat | Admin migration A2 R1 (M) |
| A2 R2 course re-count after skip, `class_count` | NOT landed (no `class_count` in the workspace body) | W2b course "Class n of N" after a skip | Admin item; W2b shows the stored total only |
| A3 R1 `has_bookings` arm in `_command_failure_code_p5` | NOT landed (body has no `has_bookings`); the Website already matches `^has_bookings` in `COMMAND_COPY` | W2b skip refusal copy | Admin item, small; W2b works without it because the client reads the prefix |
| A3 R2 History Undo for per-date and session commands (`organiser_undo_change_v1`) | NOT landed (`organiser_undo_last_change_v1` is upsert-only) | W3b History Undo | Admin migration A3 (M) |
| A3 R3 Make a copy for organisers (`organiser_copy_event_v1`) | NOT landed (`admin_duplicate_event_p5` only) | W3c | Owner fork F1 first (section 5) |
| `occurrence.set_session_delta` | In dispatch, NOT owner-admitted | nothing in P3 (owner path is `organiser_set_occurrence_programme_v1`) | None |
| `series.collapse_to_one_off` (change the kind) | Not in dispatch | nothing (out of P3) | None |

Website-side mirrors that must move with any of these: `OWNER_COMMAND_KINDS`, `OWNER_OVERRIDE_KEYS`,
the parity matrix test (`__tests__/parity-matrix.test.ts`) and `consistency.render.matrix.test.tsx`, and
the `check-going-rpcs` / contract-check scripts in `db-contract-check.yml` if a new RPC is read.

## 4. Stopping points

- After W2c merges: P3 is usable behind the flag for reading and for every status move (hide, show, put
  live, end it, stop repeating, remove, cancel a one-off). Dates and sessions still link out to the old area.
- After W2b: the earliest point at which P3 replaces the old area for the common weekly jobs (cancel a
  night, move it, change its time, skip a week, add a date, change where / about / ticket for one night).
  Recommended first ON (preview, owner's phone) is here. Left: session and line-up edits, W3.
- After W2d: everything on the event page is edited inside P3. Left: W3 (name/details, prices, repeat,
  history, copy, create). The old area stays for those, each P3 link saying which screen it opens.
- After W3a + W3b: only Repeat beyond weekly, History Undo beyond upsert and Make a copy wait on admin.

## 5. Open questions for the owner (each with a recommended answer)

1. Q1 "From X on" in W2d? The server admits `series.set_session_forward` today, which the contract did not
   expect. Recommend: keep W2d as ordered (Every date / Just this date), and add a small W2d-2 slice for
   "From X on" only after a read-only check that `organiser_series_cast_v1`, the workspace `program_forward`
   and the public event page all apply forward rows (0 rows exist in prod, so nothing has exercised them).
2. Q2 Opening `series.set_program` for P3. It sits behind `parityGate.ts` `AW1_APPLIED` for the old area.
   Recommend: P3 reads the same constant (no second gate) and the W2d PR states the prod evidence
   (`check_owner_command_allowlist_v1` admits it) rather than flipping a new switch.
3. Q3 Per-date name / music / photos / price: W2b (same date sheet) or W3? Recommend W3b: W2b stays the
   "date moves" slice; the four keys need their own copy, the calendar music reader fix (A2 R4) and a
   `OWNER_OVERRIDE_KEYS` mirror update, which deserve one PR.
4. Q4 Bulk cancel / shift in P3? No C3 sheet draws it. Recommend: out of P3; the old area keeps it.
5. Q5 F1 Make a copy for organisers: recommend yes (A3 R3), as the contract says; it is the path to a new
   course season. Not before W3c.
6. Q6 When does the flag go ON, and for whom? Recommend: a preview deploy with the flag on after W2b
   merges, owner's phone only; prod ON after W2d; the old area stays mounted until W3 is done.
7. Q7 Should W2b and W2d run in parallel? They can (section 2 file ownership). Recommend serial as
   ordered unless a second worker is idle: the `EventPage.tsx` row wiring is the one shared seam, and
   one rebase is cheaper than a mis-merge of the tap handlers.

## 6. Not verified

- `docs/handover/p3-w2a-walk` PNGs: names only, not opened. C3.html: sheet ids only (`data-sheet` list),
  not the drawings; C3.md: headings and the open-items list only.
- The W2c branch was read as its diff stat, design record headings and brief, not line by line; PR #1058's
  CI state and review threads were not read (no `gh`; GitHub MCP not used for this).
- Prod function BODIES were not read in full: only names, lengths and keyword presence
  (`override_keys`, `program_forward`, `has_bookings`, `class_count`, `set_session_forward`). Whether the
  workspace's `program_forward` / `override_keys` are the shapes CONTRACT A2 R3 proposes is unknown.
- The public readers for forward rules (A1) were not checked at all; 0 forward rows exist in prod.
- `organiser_get_occurrence_programme_v1` refusal set (cancelled, past, multi-day, ended) was taken from
  CONTRACT 2, not re-read.
- Per-date session override and added-session counts (`event_occurrence_session_override_p5`,
  `event_occurrence_added_session_p5`) were not counted; W2d's shape survey must count them.
- `organiser_series_history_v1` argument shape and row shape: not read (W3).
- Nothing was run: no tests, no build, no browser. This branch changes one Markdown file.
