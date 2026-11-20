# Brief: Organiser Event Editor v2, slice S1 (event page, night screen, save bar)

Class: BUILD-visual. Lane: normal. Branch: `claude/editor-v2-s1`. One PR. No money in this slice.

## Goal (3 lines)
1. Behind `VITE_ENABLE_ORGANISER_EDITOR_V2`, replace the R4 night hub and Edit night with the v8 editor: one event page and one night screen.
2. All edits wait behind one save bar (Undo + Save), with the unsaved-changes sheet on leave. Cancel a night and cancel the event act at once.
3. Weekly (`format = recurring`) and one-off (`format = one_off`) events only. Every other format, and flag OFF, keeps today's screens byte for byte.

## Read first
- Prototype: scratchpad `event-editor-v2.html` (62 KB: Grep, then Read by offset). Screens `event` (renderEvent ~line 256) and `night` (renderNight ~line 316). Save bar ~line 153.
- `~/.claude/plans/DESIGN-REGISTRY.md` rows 61-70. The owner pick in a row beats this brief.
- Critique: scratchpad `editor-v2-v7-critique-round2.md`, findings 6, 7, 8, 11, 12, 13, 14, 15.
- `src/modules/event-page/CLAUDE.md` and `.claude/rules/*.md`. Source files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`.

## Files
- `src/lib/featureFlags.ts`: add `organiserEditorV2: import.meta.env.VITE_ENABLE_ORGANISER_EDITOR_V2 === 'true'` with the comment "Turn on with VITE_ENABLE_ORGANISER_EDITOR_V2=true (Vercel env) -- no code change". The name is not on main yet (closed PRs #1861/#1862 used it for a different idea; do not copy them).
- `src/modules/organiser/p3/shell/P3Routes.tsx`: on `events/:seriesId`, mount `R4EditorGate`. It renders the v2 event page when the flag is on and the format is recurring or one_off, else `<R4Night />`. Add `events/:seriesId/night/:occurrenceId` (v2 only; flag off = route absent, falls to `*`).
- `src/modules/organiser/p3/shell/paths.ts`: add `eventNight(seriesId, occurrenceId)`.
- New under `src/modules/organiser/p3/v2/`: `EditorGate.tsx`, `EventPageV2.tsx`, `NightV2.tsx`, `SaveBar.tsx`, `editorModel.ts` (pure: draft, change list, write plan, order), `copy.ts` (all owner copy), and tests in `__tests__/`.
- `scripts/check-e2e-spec-coverage.mjs`: add the env line for the new walk spec, as #1860 did.
- New e2e spec `e2e/organiser-editor-v2.spec.ts`, added by name to `npm run test:e2e`.
- Do NOT edit `R4Night.tsx`, `R4EditNight.tsx`, `EventPage.tsx` or any shared sheet. Import them.

## Reuse (do not rebuild)
- Form, kept draft and leave guard: `useEditForm`, `useKeptEdit`, `useSaveRun`, `useLeave`, `GuardedBack` from `p3/screens/EditTray`. `keepDraft` / `dropKept` from `p3/onboarding/keptDraft`.
- Writes: `series_command_p5` / `occurrence_command_p5` via `shared/seriesCommands.ts`. Name, about, venue: `detailsPlan` from `p3/data/details`. Per-night overrides: `occurrence.set_override` keys `title`, `description`, `venue_id`, `city_id`, `cover_image_url`, `gallery`. Per-night sessions: `organiser_set_occurrence_programme_v1` via `p3/data/sessions.ts`.
- Venue: `useVenueOptions` + `VenueList` + `useVenueCity`. Team: the #737 team picker and `SeriesOrganisers` data. Music: `p3/data/details` music field. Repeat: `RepeatSheet` logic and `p3/data/dates`. Status: `StatusSheet` commands `set_lifecycle` paused / live, `end_run`.
- Cancel night: `R4CancelSheet` command path (`occurrence.cancel`, reason from `cancellation_reasons`). Cancel event (one-off): `cancelPlan` in `p3/data/eventPage.ts` (`series.cancel_one_off`; bring back = `occurrence.cancel {cancelled:false}`).
- Share: `nightLinkOf`, `captionOf`, `whatsappHref` from `p3/dash/shareLinks.ts`. Guest list: `R4GuestList`. Gate: `WorkspaceGate` from `p3/screens/EventPage`.

## Screen contents
Event page (`event`):
- Card "The event": Name, About, Music, Venue. Weekly: Repeat + "Change repeat". One-off: Date + "Change date" (no repeat row, no dates list). Then Who runs it.
- Programme: "Add a session". Line "Teachers and DJs are set inside each session."
- Tickets section: draw the frame only, with an S2 placeholder slot. Flag on in S1 shows today's `TicketsEntry` inside it, unchanged. S2 replaces it.
- Pictures and videos: Flyer, Gallery, Videos.
- Upcoming dates (weekly only): "Tap a date to change just that night." Tags Cancelled / Ended / Changed. Show 6, then "Show more dates". Empty: "No upcoming dates. Change repeat to add some."
- Rows: Guest list link, Pause or end event, Cancel the event / "Event cancelled: bring it back" (one-off only, see open item 1).
Night screen (`night`):
- Top: "<date>" and a "Cancel this night" link. Info line "Changes here are for <date> only." Cancelled: box "This night is cancelled." and "Bring this night back".
- Share this night: Copy link + Share. "Copy changes from another date".
- Rows "Name for this night", "About this night" (max 2000), Venue, Picture. Each shows "Usual" or "Changed for this night" with "Back to usual". Long labels sit above the value (finding 11d).
- Tickets card: frame only, S2 fills it. "Guest list for this night".
- Sessions that night: each has "Cancel", tags "Cancelled for this night", "This night only", "Changed for this night". "Add a session for this night only". A cancelled session offers "Bring back", which only un-cancels (finding 14c).
Save bar: change summary + Undo + Save. "Saving&hellip;" and disabled while running. On partial failure the bar stays and names what failed ("Not saved: <part>. Try again."). Write order: event-wide first, then night overrides, then sessions.
Unsaved sheet: "You have unsaved changes" with Save / Throw away changes / Keep editing. Also on tab change and browser back.
Cancel sheets: "Dancers see Cancelled and your reason." "This takes effect straight away." Buttons "Cancel this night" / "Keep this night". Cancel runs at once, outside the save bar. If the bar holds changes, ask to save first. The sold-tickets line belongs to S2: S1 shows none.
Pause/End: "Dates stop showing until you make it live again." / "No new dates after today. Upcoming dates show Ended." Act at once with "Are you sure?".

## Rules from findings
- 6: a sheet with changed fields does not close on outside tap. Only X / Done close it, and X asks "Throw away what you typed?".
- 8: real venue search and the #737 person search, no stand-ins. Show "No results".
- 11: top bar small line is one line with ellipsis. An 80-character name must not be cut.
- 12: toasts sit above the save bar, max 2 lines ("Undone: Repeat and 7 more"), at least 4 s.
- 13: a greyed row greys only its title. The helper line stays full strength.
- 14a: Who runs it keeps at least 1 organiser. Ask before removing yourself. 14b: removing a session warns "N dates have their own changes to this session. They will be removed."
- 15: a session end at or before its start saves as ends next day. A repeat's last date must be today or later and fall on the repeat weekday.
- Per-night sessions: the writer refuses multi-day, cancelled and past dates. Disable with a reason line, never send.
- Per-night roles: the writer takes only `teaching` and `djing`. Do not offer per-night dancers (open item 4).
- Tap targets: every button, row, chip X, "Back to usual" and link at least 44px high, in px (phone html font is about 13.5px).
- JSX uses `&mdash;` `&hellip;` `&rsquo;`. No raw Unicode punctuation.

## Flag behaviour
- OFF: `events/:seriesId` renders `R4Night` exactly. `/edit`, `/all`, `/details`, `/prices`, `/dates` unchanged. No new route. Unit test: render the route table with the flag off and assert R4Night mounts. Bundle: the v2 code is lazy and not pulled on first load.
- ON + other format (festival, course, etc.): today's screens. ON + recurring / one_off: v2. Old sub-routes stay reachable by URL.

## NOT in scope
- Tickets screen, Sell here / Stripe / door / link, early bird, per-night ticket, sold or money numbers, refund lines: S2.
- Display price list (`passes`): not drawn in v2 (open item 5). Do not delete data or the old `/prices` screen.
- Per-date start time edit and "Take this date off": knowingly removed (rows 61/67). Old screens keep them.
- Festivals, courses, multi-day. Raffle, door, history, money tiles: keep today's links in a "More" row only if open item 8 says so; otherwise list at preview.
- Any DDL, migration or admin repo change. No edit to `dialog.tsx` or the calendar files.

## Acceptance
- `npm run test:unit` green with new model tests: change list, write order, partial failure, ends next day, last-date rule, keep-1-organiser.
- `npm run lint`, `npm run pre-ship` green. Run `/code-review` once on the save-plan and guard code only.
- Walk at 390x844 on prod-shaped data. Prod: 83 recurring, 653 one-off series. Max 54 future dates. 308 recurring/one-off with no programme. 200 override descriptions over 140 chars. Use a weekly event with more than 6 future dates, a one-off, a cancelled night and an 80-character name.
- Keep-list check (today's R4Night, blocks merge): back link, title, pill, when, repeat, money tiles, raffle row, Edit this night, Description and pictures, All dates, More settings, Share this night, Cancel this night with reasons, guest list, refund block. Each item is drawn in v2, listed in open items, or marked knowingly removed in the PR body.
- Flag OFF screenshot equals main. PR body has "Verified on real data" and before/after phone shots.

## Order
S1 first. S2 starts after S1 merges (it fills the S1 Tickets frame and the night Tickets card, and adds money lines to the save bar and cancel sheet).

## Decisions (owner clicks 2026-11-20; registry row 'EVENT EDITOR v2 RECON ANSWERS' is binding)
1. Weekly 'Cancel event' = bulk-cancel ALL upcoming dates (reason, buyers emailed line only if TICKET_STATUS_EMAILS is on). No 'Bring it back' for weekly. One-off keeps cancel_one_off + bring back.
2. Cancel reasons = ONLY 'Venue not available' and 'No reason'. PREREQUISITE (admin repo, MIGRATE, done BEFORE this PR merges): those two rows exist in cancellation_reasons. Read the list from the table; do not hard-code ids. Until they exist, flag stays off.
3. Instagram field HIDDEN. Group chat link row stays (Links row on event page). WhatsApp paid option is NOT in this slice (separate look round).
4. Per-night dancers: night screen shows teachers and DJs only. Dancers per night comes later (admin writer change first); do NOT store dancers per night here.
5. Display price list (`passes`) STAYS for door / other-site events (their 'Prices' list as today, shown on the event page); selling-here events use tickets (S2).
6. Raffle, door, who's coming, history, money tiles, refund block STAY on the hub (R4Night) exactly as today; v2 replaces only the edit screens.
7. Buyer-emailed line: render only when TICKET_STATUS_EMAILS is on (check how the client can know; if it cannot, omit the line and list it in the PR body).
