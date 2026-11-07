# Brief: after Stripe, the Tickets sheet says what happened and offers one tap to put the ticket on sale
Brief-version: 2
Branch: claude/ticket-connect-return
Lane: normal, Sonnet. Website only, no migration, no workflow, no calendar-protected file, no checkout/RPC change. Reuse existing hooks only (useStripe, useStartOnboarding, setTicketStatus via the existing move).
Serves: an organiser who adds a paid ticket, presses Connect payments, finishes Stripe and comes back. Today (since #1481) they land on the Tickets sheet list with the draft row and a switch that is enabled once Stripe reads as connected; nothing tells them what happened or what to do next, and Stripe can read "started" for a short while after they return.

## What main lacks
- A status banner at the top of the Tickets sheet, shown only when the person arrives with `stripe=return`, driven by ONE pure mapping (stripe state x number of paid drafts) that says one thing: CHECKING (the existing "Checking your payment set-up" copy while polling), READY with drafts ("Payments connected. Put <ticket name> on sale." plus ONE button "Put on sale" per paid draft, or "Put all on sale" when there are 2 or more), READY with no drafts ("Payments connected. Add a ticket to start selling."), STILL NEEDS ("A few details are still needed." plus the existing Carry on with Stripe button) -- grep: connectReturnBanner
- Polling after `stripe=return`: refetch the Stripe state every 3 seconds for at most 30 seconds or until it reads connected, then stop; unmount stops it (reuse the Get paid screen's polling approach in src/modules/organiser/p3/tickets/GetPaid.tsx) -- grep: connectReturnPoll
- The banner never appears on a plain visit, after the params are dropped and a reload, for a free-only list, or for a non-manager -- grep: connectReturnBanner in a table-driven test file

## Files
src/modules/organiser/tickets/ticketModel.ts
src/modules/organiser/p3/tickets/TicketsEntry.tsx
src/modules/organiser/p3/tickets/__tests__/ticketConnectReturn.test.tsx (new)
docs/handover/ticket-connect-return.md (new)

## What to build
1. In ticketModel.ts export `connectReturnBanner({ arrivedFromStripe, stripe, role, drafts })` returning null or `{ kind: 'checking'|'ready_drafts'|'ready_none'|'needs_more', line, actions }`; ONE mapping used by the sheet. Copy is plain words for a non-technical organiser, no jargon.
2. TicketsEntry.tsx remembers `arrivedFromStripe` in a ref/state before the existing effect drops the URL params, polls as above, and renders the banner above the list. The Put on sale button calls the SAME move the Selling switch calls (no new write path); after success the banner is replaced by the normal list state.
3. Tests (red first, table-driven): every stripe state (none, started, connected) x drafts (0, 1 paid, 2 paid, free only) x role (owner, manager, contributor) x arrived (yes/no) gives the expected banner or none; polling stops at 30 s or connected and on unmount (fake timers); Put on sale uses the existing move and shows no banner after; an untouched sheet sends nothing.
4. Handover: say what you could not verify: a real Stripe return and the 390x844 walk (the sign-in walk is the lead's). Tap targets explicit px (>= 44), no sideways scroll at 390.
