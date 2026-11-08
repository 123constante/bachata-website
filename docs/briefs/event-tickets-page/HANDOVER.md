# HANDOVER: event-tickets-page (PARTIAL, continuation 2)

## Done
- Slices a-c (earlier): inventory, chips, symbols, venue read, Tickets page opened from the sticky bar.
- (1) Programme block on the Tickets page: `programmeModel.ts` (time order, TBC last, plain type without level, max 4 then "See full programme" which closes the page and scrolls to the schedule tile via new `data-block-id` on BentoGrid). Reads the same cached queries as the Schedule tile. Length chip now falls back to the programme.
- (2) Fixed amber bottom bar (#FF9900, dark button, total + summary, disabled reason in the sub line) in TicketsBlock; quiet dark-green bar for sold out / not open / closed / unavailable (`ticketBars.ts`); quantity pill. ticketCheckoutModel.ts untouched.
- (3a) Thanks page: per-ticket QRs now swipe (scroll-snap), "1 of N" counter.
- (4) Tests: `programme.matrix.test.tsx`, `ticketBars.matrix.test.ts`; all tickets and event-page unit tests pass.

## Left / blocked
- (3b) My tickets find-by-email: NOT built. It needs a backend that emails or looks up tickets for a signed-out buyer (an edge function or RPC); none exists and the brief forbids DB changes. A form that cannot work would be a fake. Needs an admin-repo decision first.
- The "paused" quiet state shows as "Tickets unavailable" only when the types list is empty; there is no per-type paused status on the client today.
- Item 5 (admin RPC fields) stays with the lead.
- 390x844 walk and screenshots not done in this cloud run.

## Not verified
No browser walk, no e2e, no live Stripe, no prod data survey run. See PR body for checks run.

Checks: tsc 0 errors in the whole project; `npm run lint` 34 of 34 links green; `npm run check:mojibake` clean; vitest src/modules/tickets and src/modules/event-page all pass.
