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
