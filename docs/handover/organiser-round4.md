# Handover: organiser Round 4 (white + orange), branch `claude/organiser-r4`

Brief: `docs/briefs/organiser-round4-restyle.md` on `brief/organiser-r4`. Boards: `docs/design/organiser-round4-md/R4*.md` there.

## Done (behind `VITE_ENABLE_ORGANISER_R4`, default off; needs ORGANISER_P3 + ORGANISER_DASH; wins over SHELL_V2)
- `src/modules/organiser/p3/r4/R4Shell.tsx`: 44px "Back to bachatacalendar.co.uk" bar, 48px header (page name opens Switch page, "To do" count badge from the other pages), bottom tabs Home / Events / Tickets / Team. Always light, even when the phone is dark.
- `r4.css`: the style guide (white cards, #E9E9E9 hairlines, no shadows, 8px radius, #C2410C for main action/active tab only). Re-points the p3 tokens, so every reused screen in the frame (Events, Tickets, Team, Switch, one event) takes the look.
- `R4Home.tsx` + `r4Model.ts`: Home through the day (before = title, day pill, Tickets sold tile, Going row, Share this night; night = Tickets sold + Checked in tiles, Open door mode, Who is in; after = Came / Tickets sold of the last night, raffle words, Who came). Every number is a real read (`ticket_door_list_v3`, past-night counts, going read); a stat with no read is hidden.
- Routes: `P3Routes.tsx` index -> R4Home, `tickets` -> the V2 Tickets tab (event chosen by the shared event choice), Team tab -> `/account/p3/you/team`.
- Tests: `r4/__tests__/r4Model.matrix.test.ts` (10 shapes + tab mapping). Walk: `tests/e2e/walk-r4-shell.spec.ts` (manual list).

## Left (screens from the 19 boards not yet restyled to their own R4 layout)
- R4Compare (simple ranked list) - today the existing CompareNights in the R4 colours.
- R4Events / R4Night / R4EditNight / R4Cancel / R4Raffle (raffle inside each night, "Pick the winner" disabled before doors close) - existing P3 Events/EventPage screens in R4 colours.
- R4Tickets (K-B, one night in focus) / R4Refund / R4EmptyTickets.
- R4Team (T1 grouped by role) / R4AddTeammate: existing Team page; its "< You" back goes to the You hub, which has no R4 tab.
- R4DoorScan / R4DoorSearch (door staff simple screen) / R4DoorInvite: DoorScreen keeps its own look.
- R4EmptyHome: R4Home has an empty face ("No nights coming up" + Add a night) but not the board's exact layout.
- "Things waiting for you" list on Home; Ticket money and Guest list tiles: no read wired here (no money-per-night read found; guest list needs ORGANISER_GUEST_LIST_LIVE, admin #1577 not applied). Reminder row: backend absent, hidden.
- Pill copy: the board says "In 3 days"; the build shows the day word ("Tomorrow", "Friday 20 November").

## Status
PARTIAL: shell + Home + walk + tests done; the screen groups under "Left" are next. tsc run on the final branch head: 0 errors in branch files.

## Next steps
1. One PR per screen group above, each reusing `r4.css` classes (`r4-card`, `r4-tile`, `r4-row`, `r4-btn`, `r4-pill-*`).
2. Run the walk: see MANUAL entry in `scripts/check-e2e-spec-coverage.mjs`.
