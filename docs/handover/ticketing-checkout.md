# Handover: S4 buyer checkout (Website)

Branch `claude/ticketing-checkout` (from main 143f9cc). Brief: branch
`brief/ticketing-checkout`, `briefs/ticketing-checkout.md`. Journey map, contract and
shape survey: [`docs/ticketing-buyer-journey.md`](../ticketing-buyer-journey.md).

## Done

- New flag `publicTicketing` (`VITE_ENABLE_PUBLIC_TICKETING === 'true'`), OFF by default,
  copied from the `organiserTicketing` mechanism (own entry, no dependency on S3). Flag off:
  no Tickets block (BentoPage's lazy import never fires) and no `/tickets/thanks` route.
  `src/modules/tickets/__tests__/flagOff.test.ts` pins it.
- `src/modules/tickets/`:
  - `ticketCheckoutModel.ts`: the ONE mapping: row availability (on sale / N left / sold
    out / not open yet / closed), stepper cap min(20, remaining), totals (subtotal, "+ 50p
    booking fee per ticket", total; free = no fee), Buy disabled reasons, request body,
    reply parser, plain-English copy + way forward for every server reason, thank-you copy.
  - `ticketCheckoutApi.ts`: `ticket_types_public_v1` read; `ticket-checkout` POST via fetch
    (anon key or session token; a gateway 401 on a stale token retries once as a guest).
  - `orderStorage.ts`: order-id hand-off across the Stripe redirect (success_url is passed
    to Stripe verbatim, so the id rides sessionStorage and the thank-you page moves it into
    `?o=`).
  - `TicketsBlock.tsx` (under the bento grid on a bookable night; hidden when past,
    cancelled, paused or ended; per-occurrence types only on their own night),
    `TicketThanksPage.tsx` (`/tickets/thanks?o=`), cancel state on the event page
    (`?tickets=cancelled`, stripped from the URL once read).
  - `legalCopy.ts`: DRAFT terms of sale + privacy paragraph. **Needs owner approval by click
    before the flag goes on anywhere real.**
- Contract read from the DEPLOYED `ticket-checkout` source (v3), not assumed.
- Code review: round 1 (high) 10 findings, 8 fixed, 2 answered (DB-side id note; catchall
  200 while the flag is off follows the S3 `/account/tickets/*` precedent). Round 2
  (medium) 9 findings, all fixed. The round-2 fixes are themselves unreviewed.

## Notes for the orchestrator (DB / admin side, not files here)

1. **`ticket_types_public_v1` must accept the public event id.** It is keyed on
   `event_series_p5.id`; the event page only has `COALESCE(legacy_event_id, id)` and
   `event_view_p5` does not return the series uuid. 59 of 69 live series differ, so the
   block stays hidden on them until the RPC also matches `public_event_id`.
2. Series-wide ticket types on a weekly series carry no date: an order is not tied to the
   night the buyer was looking at. Decide whether series-wide types are "any night" or
   should be per-occurrence only.
3. `TICKET_PREVIEW_ORIGIN` is unset, so previews show Buy disabled with "Checkout only works
   on bachatacalendar.co.uk". Not worked around, per the brief.

## Left / next steps

- Owner approves `legalCopy.ts` wording (PR body lists it).
- Fix note 1 on the DB side, then flip the flag on a preview for a phone test (checkout
  itself can only complete on the production origin).
- A link from the footer/terms page to the full terms of sale, if the owner wants one.

## Verified / Not verified

See the PR body for the per-job CI table. Summary:

Verified:
- Shape survey on prod (read-only, counts): 0 ticket_types / orders / stripe accounts;
  series lifecycle live 69, ended 21, paused 2, draft 4, archived 653; public id differs
  for 59 live series. RPC and edge-function source read live.
- Unit: tickets suite 193 tests (model matrix every status x window x free/paid x
  remaining; screen matrix every row state x free/paid, stepper caps, every disabled
  reason, every error reason x organiser known/unknown, cancel, thank-you, per-night).
- Browser walk at 390x844 against a local dev server (flag on, real prod event data, ticket
  RPC and checkout faked): block, capped form (7 left -> qty 7, total 91.00), sold_out
  error, cancelled state, thank-you, preview-origin disabled reason. No horizontal scroll,
  no tap target under 44px in the block.

Not verified:
- A real checkout (Stripe test mode) or a real free order: prod has no ticket types, and
  only the production origin may complete checkout.
- The webhook-issued email arriving.
- Desktop widths.
