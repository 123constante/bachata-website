# Brief: getpaid-next-action (ticketing S4, gaps G5 + G6) -- Website, normal lane, Sonnet

Four lines
1. For: organisers who press Connect payments from Get paid, the Home prompt or the start screen (not only from inside Add a ticket).
2. They can: come back from Stripe to ONE return path that checks their status the same way every time, and then take a real next step: Add a ticket opens the Tickets sheet.
3. Worked if: a table-driven matrix covers every Connect entry point x every return kind (return, refresh, none) x every Stripe state, and no entry point tells the person to "reload the page" or leaves them with no next action.
4. Out of scope: any DB/RPC/edge change, the public event page, the Add a ticket sheet itself (S3, merged #1491) and the waiting state mapping (S2).

Read first: docs/walk/ticket-connect-flow/RESULTS.md on branch claude/walk-ticket-connect-flow (G5, G6, walk table), docs/design/stripe-waiting-state.md and docs/design/connect-sheet-default.INVENTORY.md (merged work: build on it, do not undo it). main has S2 merged before you start: use its shared Stripe-state mapping in ticketModel.ts; do not make a second one.

Problem (cite from main): three return paths exist for one action and only two poll: data.ts (~:77-89), GetPaid.tsx (~:29-32, 78-80, 128, 222; says "reload the page"), TicketsEntry.tsx (~:152). After connecting from Get paid or the start screen the next action is weak: Get paid has none once connected; the start screen "Add a ticket" lands on the event page, not the Tickets sheet (paths.ts ~:290, `P3_TICKET_PATHS.eventTickets` already opens it with `?tickets=1`).

Build
- One shared return handler (refetch status, 3 s poll for 30 s, then the S2 states) used by EVERY entry point: Get paid, Home prompt, start screen, Tickets sheet banner. Delete the "reload the page" copy.
- Connected from Get paid: a clear next action "Add a ticket" that opens the Tickets sheet of the right event (use `P3_TICKET_PATHS.eventTickets(seriesId)`; if the person has several events, go to the events list with the reason; if none, say they need an event first with a link to create one).
- The start screen "Add a ticket" opens the Tickets sheet (`?tickets=1`), not the bare event page.
- Every empty or blocked state says what the person CAN do; no copy points at a control that is not on screen.

Design record docs/design/getpaid-next-action.md + INVENTORY first (every Connect entry point and every return landing, file:line, coverage count at the end). Explicit px tap targets (h-[48px], html is ~13.5px on phones), >=44px, British English, full weekday names.

Definition of done: matrix test written FIRST and run red on the unfixed code; shapes: Stripe none/started/waiting/connected/loading/switched off x entry point x return kind x events (none, one, many, none live); npx tsc --noEmit; npm run check:mojibake; vitest src/modules/organiser; PR body via `node ~/.claude/bin/pr-body.mjs` with Verified / Not verified (state honestly what was not walked). Early checkpoint push, one final push; branch claude/getpaid-next-action.
