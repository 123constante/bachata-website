# Walk P-SERIES (390x844, production build, route-mocked fake)

Production build (`VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build`) served by
`node scripts/_serve-build.mjs --port 4173`; Playwright reused that server
(`reuseExistingServer`) and the `tests/e2e/helpers/organiserFake.ts` fake, plus a per-series
`admin_event_workspace_p5` patch for stored passes. Clock fixed at Thu 8 Oct 2026. Script:
`tests/e2e/walk-p-series.spec.ts` (not in the gate list).

The organiser shell scrolls an inner container, so a full-page shot stops at 844px: `NN-name.png`
is the top, `NN-name-b.png` the same screen scrolled to the bottom.

## Screenshots

- 01-draft-one-event(-b).png -- draft One event: lifecycle card, Go live OFF with "Needs the next platform update. Before then, add a venue and a cover picture.", See it live OFF with reason, Discard draft.
- 02-draft-discard-confirm(-b).png -- after tapping Discard: in-page "Discard this draft?", Discard draft / Keep it (bottom in -b).
- 03-live-one-event-see-it-live(-b).png -- live weekly (Friday Bachata): See it live as a link with the external icon (-b).
- 04-details-rows(-b).png -- Details of a live event: Ends, Prices, Gallery ("2 photos"), Videos rows.
- 05-details-gallery-sheet(-b).png -- Gallery sheet: 2 tiles with remove buttons, Add photos, Done.
- 06-details-videos-sheet(-b).png -- Videos sheet: link box + Add, Done.
- 07-details-edit-ends.png -- ?edit=ends: start hint, time box, the consequence line, Save off "Nothing changed yet".
- 08-details-edit-prices-empty.png -- ?edit=prices with no prices: "No prices yet. Add a price so dancers know what entry costs.", Add a price.
- 09-details-prices-team-readonly(-b).png -- passes with tier/type/quantity: Prices row "2 prices", no chevron, reason underneath.
- 10-do-stop-last-date.png -- ?do=stop on a weekly series with 4 coming Tuesdays: "Which is the last date?", line "4 dates stay...".
- 11-norule-one-event-make-weekly-row.png -- recurring, recurrence_rule null, 2 dates: "Make it weekly" row.
- 12-do-weekly(-b).png -- ?do=weekly: weekday picked from the dates (Saturday), "Listed until" choices, button off "Pick how long it is listed".
- 13-do-weekly-day-chosen(-b).png -- same after tapping Saturday.
- 14-new-cover-save-as-draft.png -- wizard cover step: A1 note and "Save as draft" (off: no photo).

No horizontal scroll, no mojibake, no clipped text and no control visibly under 44px in any shot.

## Defects

1. **14 -- button and reason disagree, and no way out without a photo.** The button reads
   "Save as draft" but its off-reason says "Choose a photo to go live." -- and the A1 note just above
   says it will NOT go live. With A1 off, `LeaveLink` ("Save as draft and leave") is hidden, so an
   organiser without a photo has no control on this step except Back, although the draft already
   exists. `src/modules/organiser/flows/new/NewFlow.tsx:320` (reason string) and `:321`
   (`{A1_APPLIED && <LeaveLink />}`).
2. **09 -- repeated, dead-end reason.** "This price list was set up by the Bachata Calendar team, so it
   can't be changed here. Ask the Bachata Calendar team." names the team twice and says "Ask" with no
   way to ask on screen. `src/modules/organiser/events/seriesExtras.ts:108`.
3. **01 -- copy points at controls not on this screen.** Go live's reason says "add a venue and a cover
   picture", but One event has no Venue/Cover control (they are on Details, behind the title row).
   `src/modules/organiser/events/lifecycleModel.ts:39` (goLiveReason).
4. **06 -- Videos sheet has no empty-state line** (Gallery has "No photos yet. Add a few from past
   nights."); an empty sheet is just a box with a placeholder. `src/modules/organiser/events/EditorSheet.tsx:147-178`.
5. Minor: the See it live reason "Dancers can see it once it is live" has no full stop while the Go live
   reason above it has one. `src/modules/organiser/events/lifecycleModel.ts:12`.
6. Minor: 07's consequence line says "open it from Coming dates", a list on One event, not this screen.
   `src/modules/organiser/events/seriesExtras.ts:68`.

## Not verified

Real prod data (mocked fake only); a real phone; the header title in 10 truncates
("Stop repeating - Tuesday Bac...") as designed, not judged.

## Fixed in this slice (red-first; screenshots 01 and 14 re-taken after the fix)

- **1 (14):** off-reason is now "Choose a photo first." while A1 is off (`coverStepReason`), and "Save as draft and leave" shows whenever the main button is off (`offerLeave`), so the step is never Back-only. `flows/new/model.ts`, `NewFlow.tsx`; e2e `organiser-events.spec.ts` copy updated.
- **3 (01):** the reason ends "... in Details." and the card carries an "Open Details" link (`org-life-details`) right under it. `lifecycleModel.ts`, `LifecycleActions.tsx`.
- **4 (06):** empty Videos sheet says "No videos yet. Paste a video link below to add one." (`org-video-empty`). `EditorSheet.tsx`.
- **5, 6:** See it live reason ends with a full stop; the Ends note says "Coming dates on the event".
- **2 (09): NOT changed** -- "Ask the Bachata Calendar team." is the module-wide convention (organiserStatus, programmeModel, selfServeErrors, teamErrors all end that way; tests pin it). The support contact is on More. Left for the owner to decide.

Red output (before the fix): 6 failed -- go-live reason `/in Details\.$/`, `org-video-empty` missing, `coverStepReason`/`offerLeave` not functions, See it live no full stop, Ends note. After: organiser module 101 files, 2992 passed.
