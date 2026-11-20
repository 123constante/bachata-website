# Handover: Organiser Event Editor v2, slice S1 (branch claude/editor-v2-s1c)

Brief: `docs/briefs/editor-v2-s1.md` on `brief/editor-v2-s1c`. Status: **PARTIAL** (smallest working build; context gate reached).

## Interpretation taken
Owner decision 6 (binding) says the R4Night hub stays exactly as today and v2 replaces only the edit screens. So the
gate sits on `events/:seriesId/edit` (R4EditNight's route), NOT on `events/:seriesId`. Flag on + recurring/one_off
(and no festival_id) = v2 event page; otherwise R4EditNight. `events/:seriesId/night/:occurrenceId` exists only with the flag on.

## Done
- `flags.organiserEditorV2` (VITE_ENABLE_ORGANISER_EDITOR_V2), `P3_PATHS.eventNight`, routes (lazy, flag-gated).
- `p3/v2/editorModel.ts` (pure): change list, summary, write plan + order (event-wide, then nights; sessions slot = order 2,
  unused yet), partial-failure runner with per-step keys kept across a retry, ends-next-day, last-date rule,
  keep-1-organiser, session-removal warning, per-night sessions off reasons, date tags, upcoming list, Usual/Changed.
- `copy.ts` (all lines), `SaveBar.tsx` (save bar, Undo, Saving..., "Not saved: <part>. Try again.", unsaved sheet, toast 4.5 s).
- `EventPageV2.tsx`: The event card (Name, About, Venue edit through the save bar via `detailsPlan`; Music, Repeat/Date,
  Who runs it link out), Programme, Tickets frame with today's `TicketsEntry`, Pictures, Upcoming dates (6 + Show more,
  tags, empty line), Guest list / Pause or end rows, one-off Cancel the event (R4CancelSheet; off with "Save or undo
  your changes first." while the bar holds changes).
- `NightV2.tsx`: date + Cancel this night (reasons read from `cancellation_reasons`, acts at once), cancelled box +
  Bring this night back, Share (Copy link / Share), Name/About for this night with Usual / Changed / Back to usual
  (`occurrence.set_override`), Venue/Picture state, Tickets frame (S2 slot), sessions disabled with reason.
- Tests: `p3/v2/__tests__/editorModel.test.ts` (21), `routes.flag.test.tsx` (flag off: R4Night + R4EditNight, no night route).
- Walk spec `tests/e2e/organiser-editor-v2.spec.ts` (4 pass at 390x844), listed in the e2e coverage MANUAL map with its env line.

## Done in continuation A (brief docs/briefs/editor-v2-s1c-cont-a.md, items 1, 2, 4, 7)
- **One save bar (7):** `v2/editorDraft.ts` holds ONE draft per event in memory, shared by the event page and every night;
  `v2/useEditor.tsx` builds the change list + write plan (event-wide 0, night overrides 1, sessions 2) for both screens.
  Moving between `events/<id>/edit` and `events/<id>/night/<occ>` keeps the draft and never asks (`v2/scope.ts`
  `sameV2Editor`, one line added to EditTray's router blocker); leaving that pair asks (unsaved sheet). Night Back is a plain link.
- **Night override values (2):** read with `event_view_p5` (`fetchDateDetail`, existing); Name/About show the saved
  per-night value; typing back to it is no change; emptying it = Back to usual.
- **Venue and Picture per night (1):** VenueList sheet -> `venueOverridePatch` (city follows venue; picking the usual venue
  clears it); picture upload via `uploadFlyer` (same checks as DateSheet), Save waits while it uploads. Both go into the night's
  `set_override` step.
- **Sessions per night (4):** `organiser_get_occurrence_programme_v1` list with Cancel for this night / Remove (added) /
  Bring back, the removal warning (`removeSessionsConfirmCopy().consequence`) under a newly cancelled session, reader's
  not-editable reason shown; saved as plan order 2 via `organiser_set_occurrence_programme_v1` (full payload).
  The runner chains the occurrence version (prod: the programme writer checks and bumps `event_occurrence_p5.version`),
  including across a retry. `NIGHT_ROLES` now includes `dancing`.
- Event page Programme card lists the series sessions (each links to today's screen).
- Tests: `p3/v2/__tests__/editorModel.s1c.test.ts` (15). Walk spec: 5 pass at 390x844 (new: one save bar across screens,
  night venue, session cancel; shots `night-s1c.png`, `event-s1c-savebar.png`).

## Left (next steps)
- Items 3, 5, 6 below (next round, per brief).
- Line-up editing per night (add a teacher/DJ/dancer to a session for one night): roles list allows `dancing`, but the
  picker (`organiser_search_people_v1`) and per-night people editing are not built; "Add a session for this night only"
  still links to today's screen.
- Removal warning on the EVENT page (removing a series session that N dates changed, `removeSessionWarning`) is not shown:
  the event page has no remove button yet (rows link to today's screen) and needs a per-session count of date changes.
- Picture input is the native file control (looks plain at 390); style it with the design shot when it lands.
- A live weekly with >100 dates exists in prod (1): workspace returns 100; a night beyond them shows "not on the event any more".
- The e2e fake versions a night's programme apart from its occurrence (prod is one version); the walk therefore changes
  venue and sessions on different nights. Unit tests cover the chained version.
- Flag-OFF vs main screenshot proof NOT taken (context gate); routes.flag.test covers flag-off routing.
- `npm run pre-ship`: red only on things already red on main: the typecheck ratchet (141 vs baseline 106, main is also 141), live-DB contract tests, integrityCouldNotRun, addPage.matrix and no-social-word. The smoke e2e was skipped as a result, so it is NOT run.
- `npm run lint`: only `check:no-social-word` red, pre-existing on main (3 hits in tickets tests not in this branch).

## Left from the first round (unchanged numbering)
1. Venue and Picture per night: edit (VenueList / upload) — rows show state only.
2. Night override VALUES are not in admin_event_workspace_p5 (only override_keys): read them (date detail read) so the
   inputs show the current per-night value.
3. Music, Repeat sheet, Who runs it (#737 picker + keep-1 / remove-self asks wired to `removeOrganiser`), Flyer/Gallery/Videos,
   Pause/End "Are you sure?" sheets — currently link to today's screens.
4. Sessions: session list, per-night sessions via `organiser_set_occurrence_programme_v1` (teaching/djing only), Cancel /
   Bring back, removal warning; plug into write plan order 2.
5. Weekly "Cancel event" = bulk cancel all upcoming (decision 1). Copy changes from another date. Links row (group chat).
   Display price list (decision 5).
6. Finding 6 (sheet with typed fields ignores outside tap; X asks "Throw away what you typed?") not done.
7. One save bar across event page + night: today each screen has its own bar; leaving with changes asks.
8. Cancel reasons: decision 2 prerequisite (two rows in cancellation_reasons) is an admin-repo job; flag stays off until then.
9. `/code-review` once on save-plan + guard code; `npm run lint`, `npm run pre-ship`; prod shape survey; flag-OFF screenshot vs main.

- PR: #1865. Head before this note: 0e3e905. tsc run on 0e3e905: 0 errors in branch files.

- Continuation A: PR #1865 updated. tsc run on 8844afc: 0 errors in branch files (tsconfig.app.json total 141 = main).
- Preview: the Vercel check on PR #1865 for the head of claude/editor-v2-s1c (flag off on preview).

## Fix round (brief docs/briefs/editor-v2-s1c-fixround.md, review of ce1c1e5)
Tests: `p3/v2/__tests__/editorModel.fixround.test.ts`, written first; 5 failed on the unfixed code.
- **1 + 2 (fixed):** new pure `runHeld` + `SaveHold` (editorModel). The hold keys each step by its content (`stepSig`),
  not by its place in the plan. Steps that landed are never sent again, even after a refetch drops or reshapes the plan,
  and their keys are reused. A retry starts from the series version and occurrence versions the landed steps left,
  not from the prop. `useV2Save` keeps the hold in a ref.
- **3 (not reproducible, dropped):** prod `occurrence_command_p5` -> `apply_aggregate_write_p5` -> `_command_result_ok_p5`
  returns `{ok, data, new_version, audit_id}` (read-only check, 2026-11-20). An idempotent replay returns the stored
  payload, which has the same shape. A test pins that shape; it passed on the unfixed code, so nothing was changed.
- **4 (fixed):** `knownDraft(draft, ws.dates)` in useEditor. A night no longer on the event is neither counted
  (dirty / save bar) nor sent.
- **Nit, flag gate (fixed):** EditTray now calls `v2KeepsDraft` (scope.ts), which is false while the flag is off. scope.ts is a
  5th file, outside the brief's list of 4 files. `sameV2Editor` lives there and the gate needs the flag.
- **Nit, busy (fixed):** `useV2Save` has a synchronous `running` ref, so a double tap cannot start two runs.
- **Nit, leave go() re-block (not reproducible, dropped):** under the data router, `go` is `blocker.proceed()`, which does
  not run shouldBlock again. Without it, `requestLeave` asks only when there is no router guard, and `navigate` has no blocker.
  EditTray's own leave sheet uses the same order (`onUndo(); go()`).
- Branch merged with origin/main (it was behind).
- tsc run on ca2eefd: 0 errors in branch files (`tsc -p tsconfig.app.json`; 160 errors overall, all pre-existing).
  Vitest on p3: 7654 pass. Walk: 5/5 at 390x844. PR #1865 body updated; both label checks exit 0.
- Not verified: `/code-review` of the fix round, a full pre-ship/lint, a real phone, CI on the final head (running when pushed).
- Next: owner review of PR #1865, then round B (picture input styling, line-up per night, event-page removal warning).

## Match the prototype: event page (brief docs/briefs/editor-v2-match-proto-event.md)
Done (EventPageV2.tsx, v2.css, copy.ts, `__tests__/eventPage.proto.test.ts`, walk spec; editorModel/SaveBar/useEditor untouched):
1. Header: chevron back (GuardedBack restyled), grey "Events" over the event name, state pill from `r4EventRowOf` (same mapping as the Events list and hub). The shell's exit line and page header are hidden while the v2 event page is on screen (`:has(.v2-page)` in v2.css). No "Edit event" title.
2. THE EVENT: grey caps label above the card; 44px rows with label / one-line value (ellipsis) / chevron. Name and About open a sheet holding the inputs (with Done); Venue opens the existing VenueList sheet; Music and Who runs it (names from `fetchOrganiserPages`) open today's screens. No text boxes on the page.
3. Repeat: "Every Friday" over a grey "Last date Friday 25 December" (`repeatParts`), orange underlined "Change repeat". No wrapped sentence.
4. PROGRAMME: bold start time over grey "to" end time, title (untitled sessions use the type word), "Class · people · level" line; late (before 06:00) sessions sort last; orange "Add a session"; footnote under the card.
5. Prototype greys, card edges and px sizes (14/15/13/12px, 44px rows).
6. Save bar only after a real change (typing the same name back shows nothing, walked). Bar restyled by CSS only: summary + Undo link, full-width Save. Leave sheet: Save / Throw away changes / Keep editing; the sheet's Close is hidden by CSS.

Side by side with the prototype (390x844, shots `docs/design/editor-v2/shots/event-proto.png`, `event-proto-lower.png`, `event-savebar.png`, `unsaved.png`, `event-name-sheet.png`). Remaining differences:
- Repeat row: two lines (rule + last date) where the prototype shows one short line; the second line truncates next to "Change repeat" at 390.
- Music, Who runs it, Flyer/Gallery/Videos, Repeat, Add a session and session rows still open today's screens, not prototype sheets (round 3 items).
- Tickets card is today's TicketsEntry (S2 slot), not the prototype's "Sell tickets here" block.
- Name/About sheets use the shared Sheet header with a "Close" link (prototype: grab handle and an x).
- Bottom card has "Guest list" (prototype "Guest list link"); weekly "Cancel the event" row not shown (bulk cancel not built).
- Prototype "Upcoming dates" shows all dates; build shows 6 + "Show more dates".
- Night screen unchanged (next brief).

Prod shapes (read-only, 2026-11-20): weekly/one-off statuses live/draft/paused/ended/archived; names up to 53 chars; About up to 3628 chars; 375 series with sessions, up to 32 per series, 231 with no end time, 241 with no title, titles up to 349 chars; up to 11 people on one session. All handled by one-line ellipsis rows / type-word fallback / no "to" line.

Checks: vitest p3/v2 54 pass; walk spec 6/6 at 390x844 (flags SELF_SERVE, P3, DASH, EDITOR_V2); eslint on touched files 0 errors; check:mojibake clean.
tsc run on 21ab2a7: 0 errors in branch files (tsconfig.app.json total 141 = main).
Not verified: `/code-review` of this round; full `npm run pre-ship` / `npm run lint`; a real phone; preview with the flag on (flag off on preview).
Next: night screen brief (docs/briefs/editor-v2-match-proto-night.md); then the round-3 sheets listed above.

## Match the prototype: one-night screen (brief docs/briefs/editor-v2-match-proto-night.md)

Files: `NightV2.tsx`, `v2.css`, `copy.ts`, `__tests__/eventPage.proto.test.ts`, walk spec. `editorModel.ts`, `SaveBar.tsx`, `useEditor.tsx` untouched. Flag still default off.

Done (brief items 1-8):
1. Header: chevron back (to the v2 event page, keeps the draft), event name over "<date> only", red "Cancel this night" top right (disabled with a reason line while the night has unsaved changes). Grey info box "Changes here are for <date> only."
2. Share this night: two small side-by-side outlined buttons, Copy link and Share. **"Copy changes from another date" left out**: S1 has no reader for another date's own changes in the editor draft, so it would be a control that cannot work.
3. Separate cards with grey caps labels: "Name and about" (Name for this night / About this night rows), "Venue", "Picture". Each row: label, value, small "Usual" (or orange "Changed for this night" tag + Back to usual), chevron. Name and About open a sheet with the existing input.
4. Picture: no raw file input on screen; the row is a `<label>` for a visually hidden (still keyboard-focusable) file input, 52px tall.
5. Sessions card: start time over "to" end time, title, "Type . people" line, orange "Cancel" per row, orange "Add a session for this night only" footer, footnote "Tap a session to change its title, time, level or people." A cancelled session shows struck-through time/title and "Bring back" in the same row.
6. Guest list: own card, "Guest list for this night" over "Link for <date> only", chevron.
7. Cancelled: red-bordered box "This night is cancelled. Dancers see Cancelled and your reason: <reason>" (reason from event_view_p5 cancellation_reason_label; "Dancers see Cancelled." when none) + "Bring this night back"; everything below Share is dimmed and not tappable.
8. Tickets: prototype card with the existing placeholder line. **Real per-night ticket rows are a later slice (S2).**

Remaining differences to the prototype (side by side, 390x844, shots `docs/design/editor-v2/shots/night-proto*.png`, `night-cancelled.png`, `night-name-sheet.png`):
- Tapping a session (and "Add a session for this night only") opens the full settings page (`/all`, per-date sheets there), not an in-place session sheet as in the prototype.
- Guest list row goes to the event hub, not a per-night guest-list sheet with the link.
- No "Copy changes from another date" button (see 2).
- Tickets card shows the placeholder, not ticket rows / ticket link / "Add a ticket for this night only".
- The prototype's "Ticket link" row is not on the night screen.
- Share shows disabled where the browser has no share sheet (desktop Chromium); phones show it enabled.
- The picture row shows "Picture for this night" / "Usual flyer" words, no thumbnail (prototype has none either on the row).

Walk: `tests/e2e/organiser-editor-v2.spec.ts`, all three flags on (plus DASH), 6/6 passed locally.
