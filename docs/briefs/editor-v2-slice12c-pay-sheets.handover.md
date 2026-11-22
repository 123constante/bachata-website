# Editor v2 slice 12c handover (pay sheets + one-off Tickets row)

Files: `PaySheets.tsx` (new: DoorSheet, LinkSheet, HowPaySheet), `TicketsV2.tsx` (TicketsLoaded owns sheets, writes, toast), `NightCard.tsx` (one-off row), `copy.ts` (block named `ticketsPay`, because `V2.tickets` already exists as the row label), `__tests__/paySheets.test.tsx` (10 tests). The one-off row is in NightCard, so no 5th-file swap.

| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 27 | Tickets (Prices and how dancers pay) | one-off night card -> Tickets screen | prototype (row only when `onOpenTickets` is passed and format is one_off) |
| 93 | Sell tickets here | selling state + toast Undo (re-opens paused types; no types = local selling flag) | prototype |
| 94 | Pay at the door (inline / How sheet), nothing sold | clears link, pauses on-sale types, toast + Undo | prototype |
| 97 | add a link / Change the link / Add a link | Link sheet | prototype |
| 98 | Done (Link) | error "Add a link" when empty; else toast + Undo | prototype |
| 99 | Change the usual price | Door sheet | prototype |
| 100 | Done (Door) | toast + Undo (weekly "Saved for every <day>", one-off "Saved") | prototype |
| 101 | Change how dancers pay / Change | How dancers pay sheet | prototype |
| 88-90, 95, 96 | Stripe, Switch sheet | PENDING 12d | PENDING 12d |

Decisions to know:
- Something sold (or the sales read not loaded): `payDoor` is a no-op, and `link` is a no-op in `here` mode. 12d builds the "Switch how dancers pay?" sheet.
- Link saved while mode is `here` and nothing sold: on-sale types are also paused, so the screen really shows link mode (brief said "pauses nothing"; in door/link mode nothing is paused).
- Door price bad input shows "Enter a price like 8 or 8.50."; a team-shaped price list (not owner-editable) shows "This price list can't be changed here." and writes nothing.
- Writes that touch ticket types use `saveNow(..., {noUndo:true})` for the series part and a local toast whose Undo reverses both.

Verified: `npx vitest run src/modules/organiser/p3/v2`: 22 files, 281 pass. tsc run on HEAD: 0 errors. `npm run check:mojibake` clean.
Not verified: 390x844 walk, pre-ship, /code-review, prod data-shape survey, the real `ticket_type_set_status_v1` RPC (mocked in tests). No PR (per brief).
