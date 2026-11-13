# Handover: T4 buyer price steps (ticket dt_10a82b54b334)

Brief: `origin/brief/ticket-t4-buyer:docs/briefs/ticket-t4-buyer-price-steps.md` (sha 488f380c).
Branch `claude/ticket-t4-buyer`. Flag `VITE_ENABLE_TICKET_PRICE_STEPS` (`flags.ticketPriceSteps`), default OFF.

## Done
- `src/modules/tickets/priceSteps.ts`: fee rule (`net > 0`), expected total, basket body, `price_changed` parse, confirm state, step line (en-GB, Europe/London).
- `ticketCheckoutApi.ts`: v3 read when the flag is on (default follows the flag so the probe, the tickets page and the block share one RPC under one cache key); `postTicketCheckout` takes the basket body.
- `ticketCheckoutModel.ts`: `nextPricePence` / `nextPriceAt` parsed only when a v3 row carries them (v2 shape unchanged); `price_changed` replies keep `raw`.
- `TicketsBlock.tsx`: basket body with `expected_unit_price_pence` + `expected_total_pence` = the pay-button total; card line "Price rises/changes on ..."; `price_changed` copy + "Price changed, confirm" (resends the NEW values); `expected_price_required` copy + "Reload page"; unreadable `price_changed` gives the generic retry copy.
- Tests: `__tests__/priceSteps.matrix.test.tsx` (fee mocked to 50p). Mutants proved red: pre-discount total (6 red), fee on net 0 (7 red), old values resent after confirm (3 red).
- Walk at 390x844 and 360x640 on prod event c530d694 (real v3 rows, 0 steps) and the same with a step fixture injected; checkout always intercepted (no real order).
- Independent review (subagent): nothing blocking; findings 1, 3 and 6 were fixed in this PR, while 2, 4 and 5 are left as low, display-only or test-only.

## Left / next
- Flip the flag in Vercel only after edge `ticket-checkout` v5 path is confirmed live (brief says v23 has it).
- Low review notes not fixed: the promo note text can show the old saving while a confirm is held; a total-only `price_changed` shows the old unit in the subtotal row.
- No course rows on prod: the course case is covered by a fixture only.
