# Handover: organiser Round 4 (white + orange), branch `claude/organiser-r4`

Brief: `docs/briefs/organiser-round4-restyle.md` on `brief/organiser-r4`. Boards: `docs/design/organiser-round4-md/R4*.md` there.

## Done (behind `VITE_ENABLE_ORGANISER_R4`, default off; needs ORGANISER_P3 + ORGANISER_DASH; wins over SHELL_V2)
- `src/modules/organiser/p3/r4/R4Shell.tsx`: 44px "Back to bachatacalendar.co.uk" bar, 48px header (page name opens Switch page, "To do" count badge from the other pages), bottom tabs Home / Events / Tickets / Team. Always light, even when the phone is dark.
- `r4.css`: the style guide (white cards, #E9E9E9 hairlines, no shadows, 8px radius, #C2410C for main action/active tab only). Re-points the p3 tokens, so every reused screen in the frame (Events, Tickets, Team, Switch, one event) takes the look.
- `R4Home.tsx` + `r4Model.ts`: Home through the day (before = title, day pill, Tickets sold tile, Going row, Share this night; night = Tickets sold + Checked in tiles, Open door mode, Who is in; after = Came / Tickets sold of the last night, raffle words, Who came). Every number is a real read (`ticket_door_list_v3`, past-night counts, going read); a stat with no read is hidden.
- Routes: `P3Routes.tsx` index -> R4Home, `tickets` -> the V2 Tickets tab (event chosen by the shared event choice), Team tab -> `/account/p3/you/team`.
- `R4Events.tsx` + `r4EventsModel.ts` (cont1): board R4Events. Add a night (48px, orange), This week (next date within 7 days), Later (further on, undated, or live with nothing coming up), Past nights (finished; tap to expand). Row = name, "Fri 20 Nov, 8pm, place", "N dates coming up" or "Needs a place", status pill (Live green, attention orange, rest grey). Route `events` -> R4Events when R4 is on. Matrix: `r4/__tests__/r4Events.matrix.test.ts` (13 prod shapes from the 2026-11-18 survey + 7-day edge + empty).
- `R4Night.tsx` + `r4NightModel.ts` (cont2): board R4Night at `events/:seriesId` when R4 is on. Title + status pill, "Fri 20 Nov, 8pm, place", repeat words + "N dates coming up", Going (P3NightGoing), Tickets sold / Checked in tiles from `ticket_door_list_v3` (hidden with no read), Raffle row + sheet for the next night (existing raffle read; Coming soon card while ORGANISER_RAFFLE_LIVE is off), rows Tickets / Edit this night (Details screen) / All dates / More settings (the old EventPage, now at `events/:seriesId/all`), Share this night (disabled with reason unless live), Cancel this night (opens StatusSheet straight on its cancel step: reason pick + Keep; disabled with reason when no date to cancel). Matrix: `r4/__tests__/r4Night.matrix.test.ts` (14 prod shapes from the cont2 survey + no-row + repeat line). Walk: `night` case in `walk-r4-shell.spec.ts`.
- cont3 (brief `organiser-round4-cont3.md`): the R4EditNight / R4Cancel / R4Raffle group.
  - `R4EditNight.tsx` + `r4EditModel.ts` at `events/:seriesId/edit` ("Edit this night" on R4Night goes here; a "Description and pictures" row keeps the old Details screen). One form: Name (input, saves), Date + Starts (3fr/2fr, from home_v1, open All dates), Place (venue picker, saves), Ticket price (price list; lock + reason when `pricesLock` says so, else opens Prices; hidden with no prices), Repeats row (repeat words + On/Off, opens More settings), sticky "Save changes" bar above the tabs. The save is the Details save (same plan, scope ask, kept draft); untouched = Save off, nothing sent.
  - `R4CancelSheet.tsx`: "Cancel <name>?", day line, WHY? chips from `cancellation_reasons`, "Cancel this night" (danger, off with "Pick a reason first."), "Keep the night". Sends through `useCancelSend` (extracted from `CancelEventSheet`, which still uses it). Only one-offs can be cancelled (cancelPlan); repeating nights keep the disabled button with its reason.
  - `R4Raffle.tsx` + `r4RaffleModel.ts` at `events/:seriesId/raffle` (R4Night's Raffle row opens it): "<name>, <day>", Open / Entries / Closed / Winner track, Entered tile, Winner tile once drawn, Locked card, "You see how many entered, never who.", "Pick the winner" always off with why, then the one open / close / message move, which opens the existing RaffleSheet (the hard-stop confirmation stays the only write path). ORGANISER_RAFFLE_LIVE off: Coming soon card.
  - Matrix: `r4/__tests__/r4Edit.matrix.test.ts` (9 prod shapes from the 2026-11-18 survey + no row + cancel copy), `r4/__tests__/r4Raffle.matrix.test.ts` (every chip + view only + flag off). Walk: `edit night`, `raffle`, `cancel a one-off night` in `walk-r4-shell.spec.ts` (raffle read mocked in the board shape).
  - Board compare (390x844):
    - R4EditNight: DIFFERS. Layout, fields, order, lock style and save bar match. Date and Starts are links to All dates, not typed in place (a date move goes through the date editor's own command and scope ask). Price lock reason is `pricesLock` (team-set list), not "Tickets have sold at this price" (no read ties a sale to a price). Back is the "<- Back" line under the shell header, not an arrow in the header.
    - R4Cancel: DIFFERS. Sheet layout, title, WHY? chips, disabled red button + "Pick a reason first.", "Keep the night" match. The "62 going will be told, 41 refunded automatically" sentence is hidden: cancelling neither notifies the going list nor refunds tickets (no such function on prod, checked 2026-11-18), so it would be false. A day line stands in. Reasons are the server's list, not the board's five.
    - R4Raffle: MATCHES with RAFFLE_LIVE on and the read mocked (admin #1576 not applied: not seen on real data). Extra under the board: the open / close / "Message us to cancel" move. Flag off (prod today): Coming soon card instead of the track.
  - Review (one round, screens with saves): fixed the missing leave guard on Edit night, the missing "changed somewhere else / Start again", the kept Details/Prices draft not being passed on from R4Night after a gate refusal, and "No date yet" while home_v1 loads. Open UX nit: the raffle move opens RaffleSheet on its view step, so the move is tapped twice before the confirmation.
  - tsc (tsconfig.app.json) run on the final cont3 commit: 0 errors in branch files.
- Tests: `r4/__tests__/r4Model.matrix.test.ts` (10 shapes + tab mapping). Walk: `tests/e2e/walk-r4-shell.spec.ts` (manual list).

## Left (screens from the 19 boards not yet restyled to their own R4 layout)
- R4Compare (simple ranked list) - today the existing CompareNights in the R4 colours.
- R4Raffle on real data: needs admin #1576 applied and ORGANISER_RAFFLE_LIVE on. "Pick the winner" needs a draw command the Website does not have (the draw is admin's), so it is always off here.
- R4Cancel: the told / refunded sentence needs a real notify + auto-refund on cancel first.
- R4EditNight: typing the date / time in place (today they open All dates).
- R4Night: board's "Make a copy" row (no copy command found), Guest list row (needs ORGANISER_GUEST_LIST_LIVE), "Tickets £410 so far" (no money read), "41 of 80" capacity (no capacity read wired) not shown.
- R4Events board's "night 3 of 13" line: no read of a night's index in its series in home_v1; shows "N dates coming up" instead.
- R4Tickets (K-B, one night in focus) / R4Refund / R4EmptyTickets.
- R4Team (T1 grouped by role) / R4AddTeammate: existing Team page; its "< You" back goes to the You hub, which has no R4 tab.
- R4DoorScan / R4DoorSearch (door staff simple screen) / R4DoorInvite: DoorScreen keeps its own look.
- R4EmptyHome: R4Home has an empty face ("No nights coming up" + Add a night) but not the board's exact layout.
- "Things waiting for you" list on Home; Ticket money and Guest list tiles: no read wired here (no money-per-night read found; guest list needs ORGANISER_GUEST_LIST_LIVE, admin #1577 not applied). Reminder row: backend absent, hidden.
- Pill copy: the board says "In 3 days"; the build shows the day word ("Tomorrow", "Friday 20 November").

## Status
PARTIAL (cont3): shell + Home + Events list + R4Night + R4EditNight + R4Cancel sheet + R4Raffle page + walk + tests done. Next group: R4Tickets / R4Refund / R4EmptyTickets, then R4Team / AddTeammate, R4Compare, Door, EmptyHome, waiting list.

## Next steps
1. One PR per screen group above, each reusing `r4.css` classes (`r4-card`, `r4-tile`, `r4-row`, `r4-btn`, `r4-pill-*`).
2. Run the walk: see MANUAL entry in `scripts/check-e2e-spec-coverage.mjs`.
