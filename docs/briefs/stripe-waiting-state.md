# Brief: stripe-waiting-state (ticketing S2, gap G2) -- Website, normal lane, Sonnet

Four lines
1. For: organisers selling tickets who have connected Stripe but cannot take card payments yet.
2. They can: tell "Stripe needs more details from me" apart from "I am done, Stripe is checking me", and each state shows a real next action.
3. Worked if: a table-driven matrix covers every Stripe account shape x every screen that shows the Stripe state, and no screen offers an action with nothing left to do.
4. Out of scope: any DB/RPC/edge-function change (we cannot say WHAT Stripe still needs), the public event page, copy outside these states.

Read first: docs/walk/ticket-connect-flow/RESULTS.md on branch claude/walk-ticket-connect-flow (gap G2, walk table rows "started" and "Connected, charges not enabled"), docs/design/connect-sheet-default.INVENTORY.md (merged #1491; build on it, do not undo it).

Problem: `ticketModel.ts` (~lines 68-85) maps any account without `charges_enabled === true` to `started`. `details_submitted` and `payouts_enabled` are fetched by `ticketsApi.ts` (~:49) and ignored. So an organiser who finished every form and is waiting on Stripe is told "Stripe still needs a few details" and offered "Finish connecting": an action with nothing left to do.

Build
- One shared mapping in ticketModel.ts: add a state "waiting" (details_submitted true, charges_enabled not true) separate from "started" (details not submitted). Every screen reads that one mapping: Tickets sheet step 3 connect block, draft row, return banner, Get paid screen, Home prompt. No second copy.
- "started": keep "Carry on with Stripe" (real next action).
- "waiting": copy says Stripe is checking the details, usually quick, you will be able to sell as soon as it is done; real next action = "Check again" (refetch status) and a plain "Open Stripe" link to carry on there if they want. No "Finish connecting".
- Put on sale stays disabled for paid tickets in both states, with the reason shown.
- Behaviour on return banner polling stays as is; after the 30 s poll "waiting" shows the waiting copy, not "A few details are still needed".

Design record: docs/design/stripe-waiting-state.md + INVENTORY first (every screen that shows the Stripe state, file:line, coverage count at the end). Compact layout, explicit px for tap targets (html is ~13.5px on phones: use h-[48px] not h-12), >=44px taps, English British, full weekday names.

Definition of done: matrix test written FIRST and run red on the unfixed code; every Stripe shape (none, started, waiting, connected, loading, switched off) x paid/free x arrival (none, return, refresh) x screen; npx tsc --noEmit; npm run check:mojibake; vitest src/modules/organiser; PR body from `node ~/.claude/bin/pr-body.mjs` with Verified / Not verified (say honestly that no live-event walk was done if so). Push early checkpoint; branch claude/stripe-waiting-state; one push.
