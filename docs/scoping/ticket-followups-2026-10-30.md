# Ticketing follow-ups still open after #1132 #1134 #1135 #1136 #1141 #1144

Scoping only, 2026-10-30. No source edited, no database change made. Every item cites the
handover or file it comes from. Sizes: S under a day, M a few days, L a week or more.
"DB change" means the admin repo (`bachata-admin-11april`) must author a migration or
edge-function change first; this repo owns no migrations.

Read-only checks on prod `stsdtacfauprzrdebmzg` (counts and function bodies only):
2 `ticket_types`, 4 `ticket_orders`, 6 `tickets`, 2 `organiser_stripe_accounts`.
Edge functions `ticket-checkout`, `ticket-refund`, `ticket-email`, `stripe-webhook`,
`stripe-connect-onboard` are all ACTIVE. `ticket_types_public_v1` now matches
`s.id = p_event_series_id OR s.legacy_event_id = p_event_series_id`. No RPC exists that checks a
ticket in by id (the only check-in function is `ticket_check_in_v1(p_qr_token, p_event_series_id)`).

## Already closed (do not re-open)

- Thank-you "Confirmed only when paid": #1121, `docs/design/ticket-thanks-confirm.md`.
- 50p fee removed on the website: #1135, `docs/handovers/ticket-fee-zero-web.md`.
- QR door scanner screen: #1141, `docs/handovers/ticket-qr-door-screen.md`.
- `ticket_types_public_v1` accepting the public event id
  (`docs/handover/ticketing-checkout.md`, "Notes for the orchestrator" 1): fixed in the DB
  (legacy id match in the function body above).
- Legal copy owner confirmation recorded: #1148 (`legalCopy.ts` header).
- Go live wiring: #1144. Not ticketing, but it is the gate before an organiser can sell.

## Open follow-ups

### T1. The buyer has no QR code to show at the door
- Missing: no QR is rendered anywhere. The deployed `ticket-email` function sends plain text,
  `Ticket N: <qr_token>` per ticket (verified in the function body). The thank-you page shows
  no ticket. Source: `docs/handovers/ticket-qr-door-screen.md` ("What the buyer's QR encodes:
  nothing yet"). The scanner already accepts a bare 64-hex token or a URL carrying it
  (`parseCode`), so any QR form works unchanged.
- Files: website: `src/modules/tickets/TicketThanksPage.tsx`, `ticketCheckoutModel.ts`
  (thank-you copy), a new QR renderer; admin: `supabase/functions/_shared/ticketingHandlers.ts`
  (email body) plus an email-safe image.
- DB change: none for the token (`tickets.qr_token` exists). **The thank-you page cannot show
  tickets without a database change**: `ticket_order_public_status_v1` returns only status,
  ticket_count, event_title, event_date, and is anon-callable by order id, so returning tokens
  there would make a guessable-by-link secret public. Showing tokens on the page needs a new,
  safer read. The email QR needs only an edge-function change (admin repo).
- Size: M (email) / L (on-page with a new read).
- Collides with: T2 (same email and order read), `ticket-email` owned by admin repo.

### T2. Shorter code for typing at the door
- Missing: typing a 64-character code is slow. Source: `ticket-qr-door-screen.md` "Left / next".
- Files: `src/modules/organiser/p3/door/model.ts` (`parseCode`), `DoorScreen.tsx`.
- DB change: yes. A short human code on `tickets` and `ticket_check_in_v1` accepting it.
  The handover says this is out of scope without one.
- Size: M. Collides with: T1 (what the email prints), T3.

### T3. Check in from the Tonight's list
- Missing: list rows are read-only status chips because no check-in-by-id RPC exists.
  Source: `ticket-qr-door-screen.md` "Left / next" and design record "Departures from the mockup".
- Files: `src/modules/organiser/p3/door/DoorScreen.tsx`, `data.ts`, `model.ts`, door tests.
- DB change: yes (new RPC, or an id parameter on `ticket_check_in_v1`). Not verified whether
  the list rows already return a ticket id (`ticket_door_list_v1` body not read for that).
- Size: S website once the RPC exists. Collides with: T2.

### T4. Real-phone verification of the door camera and the checkout
- Missing: a real camera scan is NOT verified (Chromium fake device only)
  (`ticket-qr-door-screen.md`). A real Stripe checkout and the issued email are NOT verified
  (`ticketing-checkout.md`, "Not verified"). Prod has only 2 ticket types, 4 orders.
- Files: none; this is a walk. Needs a preview origin: `TICKET_PREVIEW_ORIGIN` is unset so
  previews show Buy disabled (`ticketing-checkout.md` note 3), and checkout only completes on
  the production origin.
- DB change: no (config only: the preview-origin secret). Size: S. Collides with: flags (Q3).

### T5. Server flip of the booking fee secret
- Missing: `TICKET_BOOKING_FEE_PENCE` must be 0 on the checkout function or Stripe charges 50p
  more than the page shows (`ticket-fee-zero-web.md`, "Left / next" 1). I cannot read secrets,
  so whether it was flipped is **not verified**.
- Files: none here. DB change: no (edge-function env, admin side). Size: S.
  Collides with: nothing, but it is a money correctness item and should come first.

### T6. Retire the old `/account/tickets` screens
- Missing: deletion of the old organiser module once the P3 walk passes. Source:
  `docs/handover/p3-wt-ticketing.md` "Deleting old /account/tickets". Still present on main:
  `src/modules/organiser/tickets/{TicketRoutes,TicketsHome,SeriesTickets,TypeSheet,RefundSheet,parts,paths}`,
  `AnimatedRoutes.tsx:57,270`, `catchallClientPaths.ts:51`.
- Keep `ticketModel.ts`, `ticketsApi.ts` and their tests (P3 reuses them). Then move the
  copy swap (`p3Words`, `OLD_PAYMENTS_WHERE`) into `ticketModel.ts`.
- Stripe return links minted by old screens point at `/account/tickets?...` and would land on
  NotFound afterwards. DB change: no, but the `stripe-connect-onboard` return/refresh URLs are
  passed by the client (`ticketsApi.ts:241`), so no server change. Size: M.
  Collides with: any P3 ticketing work (same files), T7.

### T7. Open reviews and decisions on the P3 ticketing PRs
- Missing: fix-1 and fix-2 code were never independently reviewed
  (`p3-wt-ticketing.md` fix 1 / fix 2). Open owner calls there: R6 (toast outside the
  dialog), the `/app` bundle budget (374 KB, measured 373.7 on main in `p3-wt-fix3.md`, so
  possibly resolved: re-measure), the `phone-qa` 25-minute timeout.
- Fix-3 leftovers (`p3-wt-fix3.md`): toasts can sit over the tall sheet's Close; N1 names a
  late refused rename by the typed name.
- Files: `src/modules/organiser/p3/tickets/TicketsEntry.tsx`, `TypeSheet.tsx`, `p3.css`.
- DB change: no. Size: S each. Collides with: T6.

### T8. Public order-status polish
- Missing: the failed state links to the homepage, not the event, because the RPC returns
  no event id (`docs/design/ticket-thanks-confirm.md`, "Known gap").
- Files: `TicketThanksPage.tsx`, `ticketCheckoutModel.ts` (`thanksCopy`).
- DB change: yes (add event id to `ticket_order_public_status_v1`, admin repo). Size: S.
  Collides with: T1.

### T9. Checkout hardening items the review left to the server
- Missing, from `docs/handover/ticketing-checkout.md` "Left to orchestrator" and
  `ticketing-checkout-fixes.md` "Left / next":
  a cancelled Stripe session holds tickets and the buyer's rate allowance for 32 minutes
  (close the pending order on the cancel URL); no idempotency key on `ticket-checkout`, so a
  timed-out request may leave a pending order holding stock;
  series-wide types on a weekly series carry no date (note 2: "any night" or per-occurrence
  only?); "not yet / closed" uses the phone's clock (nit 15).
- Files: website: `ticketCheckoutModel.ts`, `TicketsBlock.tsx`; the rest is
  `ticket-checkout` in the admin repo.
- DB change: yes for the first three (edge function and possibly `ticket_orders`). Size: M-L.
  Collides with: T4 (test it for real first).

### T10. Smaller organiser items
- Manual "Mark sold out" is no longer offered; say if it should come back
  (`ticketing-organiser-ui.md` note 2). Partial refunds and a per-date ticket picker remain
  out of scope (same file, "Left / next steps"). Link from footer/terms to the full terms of
  sale, if wanted (`ticketing-checkout.md`, "Left / next").
- Files: `p3/tickets/TypeSheet.tsx`, `RefundSheet.tsx`, `src/modules/tickets/legalCopy.ts`,
  footer. DB change: partial refunds yes (`ticket-refund` is whole-order); others no.
  Size: S (terms link, sold-out), L (partial refunds, per-date picker).
  Collides with: T6.

### T11. Go-live flags
- Missing: turning `publicTicketing` and `organiserTicketing` on is a Vercel env change, not
  code (`featureFlags.ts:71,75`). Prod has them off. Sequence matters: T4 and T5 first.
  Also `organiserDetail` decides whether "View my page" works after Go live
  (`docs/handovers/p3-golive-wiring.md`, "Fix later").
- DB change: no. Size: S.

## Not found, not invented

- "Promo" and "fee" items beyond the above: `src/hooks/usePublicPromoCodes.ts` and
  `src/pages/PromoCodes.tsx` are the partner promo-code feature (`get_public_promo_codes`),
  not ticketing. No ticketing promo-code or discount feature appears in any handover, so none
  is listed. If the owner means ticket discount codes, nothing is specified yet (Q5).

## Proposed build order

1. T5 (confirm fee secret = 0) and T4 (phone walk on a preview origin): cheap, and they
   protect money. Needs the preview-origin secret set.
2. T7 (re-measure bundle, independent review of fix-1/2) before any new P3 ticketing code.
3. T1 email QR (admin edge function, M), then T8 together with the order-read change if the
   owner wants the on-page ticket.
4. T3 and T2 together in one admin migration plus one website PR (door).
5. T6 old-screen deletion, after the owner's walk passes.
6. T9 server hardening, then T11 flag flips.
7. T10 as the owner decides.

## Questions only the owner can answer

1. Has `TICKET_BOOKING_FEE_PENCE` been set to 0 on the checkout function? (T5)
2. Should buyers get a QR in the email only, or also on the thank-you page? (T1: the page
   needs a new, safer read.)
3. Is the owner's phone walk of organiser ticketing done, so old `/account/tickets` can go?
   (T6)
4. Do you want a short typed door code, and is a database change acceptable for it and for
   list check-in? (T2, T3)
5. Did "promo" mean ticket discount codes? If so there is no spec. (Not found, above)
6. Weekly series: are series-wide ticket types "any night" or per-night only? (T9)
7. Should manual "Mark sold out" come back, and are partial refunds wanted? (T10)
8. When do the two ticketing flags and `organiserDetail` go on in Vercel? (T11)
9. R6 (alert toast outside the dialog for screen readers): accept as is? (T7)
