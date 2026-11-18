# Review: PR #1788 (claude/p2-refund-states): Website reads night_cancelled

- **PR:** 1788
- **Head SHA reviewed:** `a316bcc3dd1e224cb28a41d3de98fdaef93fb015`
- **Brief:** `docs/briefs/review-1788.md` (branch `brief/review-1788`)
- **Scope:** review only. 3 files: `src/modules/tickets/MyTicketsPage.tsx`, `myTicketsModel.ts`, `__tests__/myTickets.matrix.test.tsx`.

## Verdict: **PASS WITH NITS**

The change is correct, small, and safe for older RPC replies. Two nits (N1, N2) are test and coverage gaps. Neither one blocks the merge.

## Checks

### (1) `nightCancelled` set only when true; order-QR deep-equal not affected: PASS
- `parseOrderQr` spreads `...(r.night_cancelled === true ? { nightCancelled: true } : {})`, so the key is absent unless the value is a literal `true`. The existing `orderQr.test.tsx` `toEqual` fixtures (no `night_cancelled`) still deep-equal. Commit a316bcc made exactly this fix.
- `parseMyTickets` always sets `nightCancelled: r.night_cancelled === true`, as a boolean that is never undefined. That is fine because no `MyTicket` deep-equal fixture breaks: the suite is green. The field is typed optional (`nightCancelled?: boolean`), which is looser than needed but harmless.

### (2) Cancelled card is greyed, shows "This night was cancelled", and shows no QR: PASS (flag ON)
- `MyTicketsPage.tsx:50` passes `eventCancelled: t.nightCancelled` into the shared `ticketStatusAt`. `ticketStatus` gives `event_cancelled` precedence over `passed`, after `refunded`.
- `reason = ticketStatusLine('event_cancelled')` = `"This night was cancelled"` (`TICKET_STATUS_COPY`). The card gets `opacity: 0.6`. The `reason ?` branch renders only the status line, so there is no QR, no "Show QR" button and no door code (`ticketQrShown` returns false, so `code = null`).
- Only behind `BUYER_ONBOARDING_ENABLED`. With the flag OFF, status is `'valid'` and a cancelled night still draws the QR, as before. This is consistent with the rest of slice A (the "flag OFF = exactly as before" rollback contract), but it means the feature is invisible in prod until the flag is on.

### (3) Null or undefined `night_cancelled` from older replies cannot crash or hide a valid ticket: PASS
- `=== true` treats a missing value, `null`, `false` or `'true'` as false, so the status falls back to the date rule. Row-validity rules are unchanged, so no row is dropped because of the new field.
- Live check (read-only, prod `stsdtacfauprzrdebmzg`): both `my_tickets_v1` and `my_ticket_order_qr_v1` definitions already reference `night_cancelled`, so the read is live and not speculative.

### (4) Tests cover each shape and fail on unfixed code: PARTIAL (nit N1)
- The new test covers `true`, `false`, absent and `'true'`. Run against main's `myTicketsModel.ts`, it **fails** (1 failed / 57 passed). Good.
- On the PR head, all 920 tests in `src/modules/tickets` pass (28 files).
- **But** reverting only the `MyTicketsPage.tsx:50` wiring leaves **all 920 still green**. No test renders a `MyTicketsPage` card with `nightCancelled: true`. The status, greying and no-QR rendering is covered for the dancer `TicketCard` (`onboardTicketStates.matrix.test.tsx`) but not for `/account/my-tickets`.

## Nits

- **N1 (test gap):** Add a flag-ON render case to `myTickets.matrix.test.tsx`: a row with `night_cancelled: true` and a future date should give `data-ticket-status="event_cancelled"`, `my-ticket-status` text `"This night was cancelled"`, no `my-ticket-qr-box`, no "Show QR code" button and no `my-ticket-short-code`. A flag-OFF case should keep the QR. This is the only test that would fail if line 50 were reverted.
- **N2 (dead field for now):** `OrderQrTicket.nightCancelled` is parsed but nothing reads it yet. `OrderQrBlock.tsx` and the dancer-app `useTicketCard`/`model.ts` still draw the QR for a cancelled night, because the dancer-app part was split out in e45c720 by the dancer-area-isolation guard. Make sure the follow-up slice wires it, and don't call P2 "cancelled night hides QR everywhere" until it does.
- **N3 (typing, optional):** `MyTicket.nightCancelled` could be non-optional `boolean`, since `parseMyTickets` always sets it. Leave it optional only if hand-built fixtures elsewhere need it.

## Not verified
- No browser walk at 390x844 and no prod-shape survey of how many cancelled nights carry live tickets (review-only brief).
- PR CI status was not read: `gh api` is not allowed in this run, so only local vitest was run.
