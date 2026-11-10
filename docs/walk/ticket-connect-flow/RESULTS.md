# Ticket setup to Stripe-connected: audit (report only)

Base: origin/main 502dddf. Inventory: [INVENTORY.md](INVENTORY.md) (row ids like B2.7 refer to it). Method: code reading only. No source, test or migration changed. Paths are under `src/modules/` unless stated.

Goal tested against: "connecting Stripe is the obvious default; an external ticket link stays possible as a small plain text link below the Connect button, never promoted."

## 1. Step trace

### Step 1. Add a ticket (TypeSheet, `organiser/p3/tickets/TypeSheet.tsx`)
- Sees: a 3-step sheet. Step 1 Name + Price (help "Leave empty or 0 for a free ticket.", :295) + Buyer pays box. Step 2 Places + sales window. Step 3 Review.
- Nothing about Stripe on steps 1 or 2. The first mention is at step 3, and only if the series is live and the form is valid (:116).
- Tap: Continue (:203/207) moves on; errors keep the person on the step (:104-110).
- Dead ends / no next action:
  - Paid ticket, series NOT live: no Connect block (:116 needs `ctx.seriesLive`); "Put on sale" greyed with "Put this event live before selling tickets." (ticketModel.ts:223). Correct, but there is no route to Connect from here, and Stripe is not mentioned.
  - Paid ticket, onboarding "switched off" (`not_configured`): `connectBlock` is null (ticketModel.ts:256), so the sheet shows greyed "Put on sale" with `PAYMENTS_WHERE` = "Connect payments in You > Get paid before selling paid tickets." (ticketModel.ts:218; TypeSheet.tsx:243). That is plain text, not a link. On Get paid the person then meets "Payments are not switched on yet" (GetPaid.tsx:151). A dead end by design, but the sheet never says so.
  - Start error from the Connect press: `onboard.note` is not rendered in the sheet (B2.12). The sheet has already closed after the draft saved (TypeSheet.tsx:141-143), so the error only appears if a paid draft row exists with the Connect block (TicketsEntry.tsx:613).
- External link offered here: none.
- Copy pointing at a missing control: `PAYMENTS_WHERE` says "in You > Get paid" (a screen), with no button to go there (TypeSheet.tsx:243).

### Step 2. Connect payments (inline, same sheet)
- Sees (step 3, paid, live, stripe `none`): line "Connect payments to put this on sale" and button "Connect payments" (TypeSheet.tsx:215-229; ticketModel.ts:232-233). With stripe `started` the button reads "Carry on with Stripe" (ticketModel.ts:257). "Save as draft" stays below (:244).
- Tap: saves the ticket as a draft, toast "Ticket saved as a draft. Connecting payments..." (:141), then `onboard.go()` redirects the whole page to Stripe (data.ts:90-93).
- No pre-warning: unlike Get paid ("What Stripe will ask you", "You leave Bachata Calendar for Stripe", GetPaid.tsx:167, 308-312 area), the inline button gives no hint that the page will leave the app or that it takes about 10 minutes (STRIPE_COPY.none.body, ticketModel.ts:76, is not used here).
- Return URL: event page `?tickets=1&stripe=return|refresh` (TicketsEntry.tsx:152; paths.ts:285-290).

### Step 3. Stripe return (banner on the Tickets sheet)
- `stripe=return`: sheet opens, banner "Checking your payment set-up..." with a 3 s poll for 30 s (TicketsEntry.tsx:85-87, 164-199; ticketModel.ts:303). Then:
  - connected + one paid draft: "Payments connected. Put <name> on sale." + "Put on sale" (ticketModel.ts:290-296).
  - connected + several: "Put all on sale" (:297-301).
  - connected + no paid draft and no tickets: "Payments connected. Add a ticket to start selling." with no button (:289; render :421-439). The footer "Add a ticket" is the only next action.
  - still not connected after 30 s: "A few details are still needed." + "Carry on with Stripe" (:304).
- `stripe=refresh` (link ran out): `arrivedFromStripe` is set for `return` only (TicketsEntry.tsx:158, 190); `refresh` opens the sheet (via `tickets=1`) with no banner and no words. The Get paid screen does explain it (BACK_NOTE, GetPaid.tsx:29-32); the Tickets sheet does not.
- Banner state is in memory (TicketsEntry.tsx:158). A reload drops it; the paid draft row then shows its own switch, which works (B3.4/B3.5), so recoverable.
- "Carry on with Stripe" in the banner: a start error is not shown in the banner (TicketsEntry.tsx:424-437); it surfaces only on the draft row (:613).

### Step 4. Put on sale
- Banner button or the row switch calls `ticket_type_set_status_v1` (ticketsApi.ts:197; TicketsEntry.tsx:254). Success toast "<name>: <SWITCH_LABEL>" (:256). Refusals appear on the row (:259, 616). The onboarding gate sheet opens for a refused Selling (:262).
- From the Add sheet with Stripe already connected: "Put on sale" does upsert then on_sale (TypeSheet.tsx:134-150) and says "Ticket added and on sale." Good.
- Gap: none beyond the above; error mapping (`reasonMessage`) was not audited line by line.

### Step 5. Get paid screens (the other entry points)
- Three different return behaviours for the same Connect action (B4.10):
  - Inline (Add a ticket / row): back to the event Tickets sheet, banner + 30 s poll.
  - Home prompt (GetPaid.tsx:222) and You > Get paid card (:128): back to `you/get-paid`, which only refetches once (:78-80) and says "It can take a minute to show as connected; reload the page if it does not." (:29-32). No poll, no next action after it connects.
  - WhatsApp start screen (:338): own poll 60 s (:264-265, 321-334) and, once connected, "You're ready to sell tickets" + "Add a ticket" (:287-288).
- Connected on You > Get paid: title "Payments connected", body, and no button (GetPaid.tsx:147-168; STRIPE_COPY.connected.action = null, ticketModel.ts:91). The checklist rows are not tappable (:170-181). No route onward to Add a ticket.
- "Add a ticket" on the start screen goes to the event page without `tickets=1` (GetPaid.tsx:304-307) although `P3_TICKET_PATHS.eventTickets` exists (paths.ts:290); with 2+ live events it goes to the Events list. The person must then find the Tickets row.

### Step 6. External ticket link
- Where entered: P3 event editor Details "Ticket link" (`p3/screens/DetailsScreen.tsx:155-158`), placeholder `https://`, no help text. Also the create flow, where "Ticket link" is a peer chip in "How do dancers pay?" (`p3/new/sheets.tsx:157-162`), whose doc comment says "Stripe tickets come later" (:132; stale, tickets exist now). The older `events/EditorSheet.tsx:299-307` says "Where dancers book or buy tickets."; it mounts only from `events/Details.tsx:18` (not part of the P3 path).
- Where shown: event page About row as a raw URL link (`p3/screens/EventPage.tsx:227`).
- Never shown or offered beside Connect (absence at TypeSheet.tsx:215-229, GetPaid.tsx:147-168, TicketsEntry.tsx:607-615).
- Public page: see section 3, rows "link only" and "both".

## 2. Gaps, ranked

Class key: COPY = copy only; SCREEN = screen/logic change in this repo; RPC = needs admin repo.

### Blockers (the goal fails)
| # | Gap | Evidence | Class |
|---|-----|----------|-------|
| G1 | On the public page the external link beats in-site tickets: "Get Tickets" takes the primary slot whenever a link exists, even when the series has types on sale through Stripe. Selling through us is not the default for buyers. | EventStickyActionBar.tsx:96-98, 148-160; BentoPage.tsx:760-770 (buy block is separate and silent until a type is on sale, TicketsBlock.tsx:159) | SCREEN. No RPC: `ticket_types_public_v1` is already read (ticketCheckoutApi.ts:41-42); lift that read so the bar knows. |
| G2 | "Connected but charges not enabled" is the same state as "started": `details_submitted` and `payouts_enabled` are fetched and ignored. An account that finished its details and is waiting on Stripe is told "Stripe still needs a few details" and offered "Finish connecting", an action with nothing left to do: a state with no next action. | ticketModel.ts:68-69, 83-84; ticketsApi.ts:49 | SCREEN + COPY. Columns already readable; no RPC. Saying WHAT Stripe still needs would need the admin `stripe-connect-onboard` function or a status RPC (admin repo, not named in this repo). |

### Should fix
| # | Gap | Evidence | Class |
|---|-----|----------|-------|
| G3 | No small "selling elsewhere?" text link below the Connect button, in the sheet or on a draft row. The external link is a peer in create flow and a plain field in Details, so Connect is not visibly the default. | TypeSheet.tsx:215-229; TicketsEntry.tsx:607-615; sheets.tsx:157-162 | SCREEN |
| G4 | Stripe is first mentioned at step 3 of the sheet. A person choosing a price has no signal that paid tickets need payments connected, and no time hint. | TypeSheet.tsx:116, 295 | COPY (+ small SCREEN) |
| G5 | Three return paths for one action, only two poll; the Home/Get paid path says "reload the page". | data.ts:77-89; GetPaid.tsx:29-32, 78-80, 128, 222; TicketsEntry.tsx:152 | SCREEN |
| G6 | After connecting from Get paid / start screen the next action is weak: Get paid has none; start screen "Add a ticket" lands on the event page, not the Tickets sheet. | GetPaid.tsx:147-168, 304-307; paths.ts:290 | SCREEN |
| G7 | Switched-off dead end: sheet shows a greyed Put on sale pointing at "You > Get paid" as text, and that screen says payments are not on. Nothing in the sheet explains. | TypeSheet.tsx:243; ticketModel.ts:218, 256; GetPaid.tsx:151 | COPY |
| G8 | Stripe start error is invisible in the sheet and in the banner's Carry on; only a draft row shows it. | B2.12; TicketsEntry.tsx:424-437, 613 | SCREEN |
| G9 | Event with both: organiser sees the link in About and a Tickets row, but nothing says two buy paths coexist or which wins. | EventPage.tsx:227, 326; EventStickyActionBar.tsx:148 | COPY (+ G1) |

### Nice
| # | Gap | Evidence | Class |
|---|-----|----------|-------|
| G10 | `stripe=refresh` on the Tickets sheet is silent. | TicketsEntry.tsx:158, 190 | COPY |
| G11 | `nextStep` / `paymentsLink` in ticketModel.ts have no importer outside tests: dead code that could mislead the next change. | ticketModel.ts:715-745 | cleanup |
| G12 | Stale comment "Stripe tickets come later". | sheets.tsx:132 | COPY |
| G13 | Link in About shown as a raw URL; no help text on the Details field. | EventPage.tsx:227; DetailsScreen.tsx:155-158 | COPY |

Database or RPC changes (admin repo): none are required for G1-G13. Optional: if the product wants to tell the organiser what Stripe still needs (G2), that is a change to the `stripe-connect-onboard` edge function or a new status read in the admin repo; not written here.

## 3. Walk table

| State | What the screen does today | Cite |
|-------|---------------------------|------|
| No Stripe account yet (`none`) | Step 3 of Add a ticket (paid, live): "Connect payments to put this on sale" + "Connect payments"; tap saves a draft and leaves for Stripe. Free ticket: Put on sale works. Home prompt "Get paid for tickets" + Connect. Get paid: tag "Not connected", "Connect payments", "About 10 minutes, once." | TypeSheet.tsx:215-229, 140-143; ticketModel.ts:71-78, 232-233; model.ts:135-142; GetPaid.tsx:35-39, 147-168 |
| Stripe started, not finished (`started`) | Button reads "Carry on with Stripe"; title "Finish connecting payments"; body "Stripe still needs a few details..." After a return: banner "A few details are still needed." + Carry on, after a 30 s poll. | ticketModel.ts:79-85, 257, 304; TicketsEntry.tsx:164-179 |
| Connected, charges not enabled | Identical to the row above: the mapping cannot tell them apart (any row without `charges_enabled === true` is `started`). Same "few details" copy and "Finish connecting"; no waiting state. | ticketModel.ts:68-69; ticketsApi.ts:49 |
| Connected and enabled | `connectBlock` null; Put on sale enabled in the sheet; draft rows get a working switch; banner after return offers Put on sale. Get paid: "Payments connected", no button. Start screen: "You're ready to sell tickets" + Add a ticket (event page, not the Tickets sheet). | ticketModel.ts:256; TypeSheet.tsx:231-241; ticketModel.ts:289-301; GetPaid.tsx:147-168, 287-288, 304-307 |
| Event with ticket link only | Organiser: Tickets row "None yet · Add a ticket"; About row shows the URL. Public: sticky "Get Tickets" is primary; no in-site block (no type on sale). | model.ts:177-182; EventPage.tsx:227; EventStickyActionBar.tsx:98, 148; TicketsBlock.tsx:159 |
| Event with both | Organiser: Tickets row with chips plus About link; no word about the overlap. Public: in-site block renders and the sticky "Get Tickets" external pill still holds the primary slot; two buy paths, the external one led. | EventPage.tsx:227, 326; BentoPage.tsx:760-770, 841-845; EventStickyActionBar.tsx:96-98 |

## 4. Follow-up slices (max 4; briefs not written)

| # | Branch | Goal | Files | Lane | Model |
|---|--------|------|-------|------|-------|
| S1 | claude/public-ticket-lead | When the series has a type on sale, the in-site buy path leads on the public page and the external link drops to a small text link (G1, G9). | event-page/bento/BentoPage.tsx, EventStickyActionBar.tsx, modules/tickets/ticketCheckoutApi.ts (lift the public types read), tests | normal (user-facing: two review rounds) | Sonnet |
| S2 | claude/stripe-waiting-state | Split `started` into "needs details" and "waiting on Stripe" using the already-fetched columns, with a real next action for each (G2). | organiser/tickets/ticketModel.ts, p3/tickets/GetPaid.tsx, TicketsEntry.tsx, TypeSheet.tsx, matrix tests | normal | Sonnet |
| S3 | claude/connect-sheet-default | Stripe named at price entry, error shown in sheet and banner, small "Selling elsewhere? Add a ticket link" text link under Connect that opens Details, switched-off wording (G3, G4, G7, G8, G10, G12). | p3/tickets/TypeSheet.tsx, TicketsEntry.tsx, ticketModel.ts (copy consts), p3/new/sheets.tsx (comment) | normal | Sonnet |
| S4 | claude/getpaid-next-action | One return path with polling for every Connect press, and "Add a ticket" opens the Tickets sheet (`?tickets=1`) (G5, G6). | p3/tickets/GetPaid.tsx, data.ts, paths.ts, TicketsEntry.tsx | normal | Sonnet |

## Verified / Not verified

Verified (by reading origin/main 502dddf, file:line above): the full organiser path from Add a ticket to Put on sale, the three Get paid entry points, the Stripe return handling, every place the external link is entered or shown, the public sticky bar and buy block.

Not verified:
- No signed-in browser walk and no phone (390x844) check; what the organiser sees is inferred from code.
- No production data: how many accounts sit in `started` with `details_submitted = true` was not surveyed (G2 severity depends on it).
- Admin app internals not read; admin-side facts are limited to the RPC/table/function names the Website calls. Whether `stripe-connect-onboard` returns an error or a usable link for a details-submitted account was not checked.
- `reasonMessage` mappings and the onboarding gate sheet (F-11) were not audited line by line.
- Feature flags (`organiserTicketing`, `publicTicketing`, featureFlags.ts:74, 78) were assumed on; their prod values were not checked.
- `tsc` not run (no source changed).
