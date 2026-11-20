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

## Left (next steps)
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
