# Ticketing: buyer journey (S4, Website)

Brief: branch `brief/ticketing-checkout`, `briefs/ticketing-checkout.md`. Flag:
`publicTicketing` (`VITE_ENABLE_PUBLIC_TICKETING === 'true'`), OFF by default. While
off, `/event/:id` renders exactly as before and `/tickets/thanks` has no route.

## Journey (390x844 screens)

| # | Screen | Where | What the buyer sees |
|---|--------|-------|---------------------|
| 1 | Tickets block | `/event/:id`, under the bento grid | One row per type on sale: name, price (or "Free"), "N left" / "Sold out". |
| 2 | Order form | same block, after picking a type | Quantity stepper (1 to min(20, remaining)), total lines: tickets subtotal, total (no booking fee since the owner order of 2026-10-29; the "+ fee per ticket" line shows only if `BOOKING_FEE_PENCE` is ever non-zero again); email (required), name (optional), terms checkbox, one Buy button with the reason it is disabled. |
| 3 | Error | same block | Plain-English line for the server reason + a way forward (try again / pick another ticket / contact the organiser). |
| 4 | Stripe | Stripe hosted checkout (paid only) | Not ours. |
| 5 | Thank you | `/tickets/thanks?o=<order_id>` | Paid: "Payment received, your tickets are being emailed". Free: "Your free tickets are on their way". Never claims issuance (the webhook issues). |
| 6 | Cancelled | `/event/:id?tickets=cancelled` | A note above the block: "Checkout cancelled, you have not been charged", form ready to retry. |

Hidden (no block at all): flag off, the series is ended / paused, the night shown is past
or cancelled, the RPC fails or returns no types. A type that is `sold_out` shows "Sold out"
and cannot be picked.

## Wire

- Read: `ticket_types_public_v1(p_event_series_id)` (anon EXECUTE). Called with the page's
  PUBLIC event id. See "DB note" below.
- Write: edge function `ticket-checkout` (verify_jwt): POST with `apikey` + `Authorization:
  Bearer <session token or publishable key>`. Contract read from the deployed source
  (version 3): body `{ ticket_type_id, quantity, buyer_email, buyer_name?, success_url,
  cancel_url }`; replies `{ ok, order_id, checkout_url }`, `{ ok, order_id, free: true }`
  or `{ ok:false, reason, message? }`.
- `success_url` is passed to Stripe verbatim (no order-id template), so the client sends
  `https://<site>/tickets/thanks` and keeps the order id in sessionStorage; the thank-you
  page reads `?o=` first, then that. Free orders navigate to `/tickets/thanks?o=<id>&free=1`.
- Redirect URLs must be https on `bachatacalendar.co.uk` / `www.`. On any other origin
  (Vercel previews, localhost) the Buy button is disabled with the reason "Checkout only
  works on bachatacalendar.co.uk": `TICKET_PREVIEW_ORIGIN` is unset, so a preview cannot
  complete checkout, and we do not work around it.

## Shape survey (prod, read-only, counts, 2026-10-27)

- `ticket_types`: 0 rows (no statuses, no free, no per-occurrence types). `ticket_orders`: 0.
  `organiser_stripe_accounts`: 0. So the block renders nowhere on prod today even with the
  flag on.
- `event_series_p5` lifecycle: live 69, ended 21, paused 2, draft 4, archived 653.
- `public_event_id <> id`: 120 series, **59 of the 69 live**.
- RPC returns only `on_sale` / `sold_out` types of a `live` series; `remaining` =
  `greatest(capacity - reserved_count, 0)`; currency column exists (GBP only, Q10).

## DB note for the orchestrator (not a file here)

`ticket_types_public_v1` is keyed on `event_series_p5.id`, but the event page only knows
the public id (`COALESCE(legacy_event_id, id)`), and `event_view_p5` does not return the
series uuid. For 59 of 69 live series the call answers no rows, so the block stays hidden
there. Fix on the DB side (as `src/modules/event-page/CLAUDE.md` says for
`series_level_summary_p5_v1`): let the RPC accept the public id
(`WHERE s.id = p OR s.public_event_id = p`). No Website change is needed after.

## Design gate

Stages 1-3 satisfied by reuse: bento tokens (`--bento-surface-raised`, `--bento-fg`,
`--bento-fg-muted`, `--bento-accent`, `--bento-hairline`), the same raised card used by the
"This event has ended" note, compact density (`p-3`, `text-sm`), px tap targets >= 44.
