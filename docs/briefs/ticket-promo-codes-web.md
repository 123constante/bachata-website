# Brief: ticket promo codes, Website half (BUILD-visual, careful lane)

Admin PR #1125 (DB + edge) is applied and `ticket-checkout` redeployed BEFORE this runs. Read its handover first: `git fetch origin claude/ticket-promo-codes-db` (admin repo, ask the orchestrator for the text if you cannot reach it). RPCs: `ticket_promo_preview_v1(p_series,p_ticket_type,p_quantity,p_code)` (anon), `ticket_promo_create_v1`, `ticket_promo_update_v1`, `ticket_promo_list_v1` (authenticated). `ticket-checkout` accepts optional `promo_code`; refusals are HTTP 409 `{ok:false,reason}`; free = `{ok:true,order_id,free:true}`.

## Owner decisions (2026-10-29, binding)
- Percent AND fixed amount off. Percent rounds DOWN per ticket. Fixed is pounds off EACH ticket, never below 0; zero total = free order.
- Limits: max uses (counts ORDERS) and expiry date. Code applies to every ticket of that organiser in the order.
- A code for a different event answers "That code isn't valid for this event." Keep the code hint in the field.
- Specific buyer reasons: unknown_code, inactive, expired, used_up, not_for_this_event, no_discount, below_minimum (under 30p), rate_limited. Copy table is in the admin handover; British English, no jargon.
- A `?code=` link pre-fills the code field on the event ticket panel.

## Build
1. Organiser: on the P3 Tickets screen a "Promo codes" section: list (code, discount, used x of max, expiry, active), create sheet (code, percent or fixed, max uses, expiry), turn off/on, edit rules until first use (then locked: say why). Behind `flags.organiserTicketing`. Only owner/manager see it (server decides; do not copy permission logic).
2. Buyer: "Promo code" field on the ticket checkout panel: Apply calls preview, shows new total with the saving; invalid shows the specific reason; checkout sends `promo_code`; free result goes to the free-order end state.
3. `?code=` pre-fill.

## State table (REQUIRED in the PR body and tests, table-driven, one shared mapping)
Screen x state: buyer (no code, valid percent, valid fixed, free result, each refusal reason, rate_limited, offline, slow/double-tap) and organiser (empty list, 1 code, many codes, used/locked, expired, used up, create errors: code_taken invalid_code invalid_value invalid_max_uses invalid_expiry not_authorised). Every state names what the person CAN do next; every disabled control says why; untouched save sends nothing.

## Checks
Real-data shapes read read-only on prod (counts only). Walk 390x844 AND 320x568 dark+light. Design record docs/design/<pr>.md. Every applicable CI step run (on the Dell: `node ~/.claude/bin/dell-run.mjs website <sha> -- <cmd>`). Flags stay as they are; nothing turned on.

## Output
Handover docs/handovers/ticket-promo-codes-web.md with Verified / Not verified. One push at the end, subject ending `[worker-done <ticket>]`. Opus, careful lane, context under 30%.


## Addendum 2026-11-04 (website-18, ticketing lane): facts the worker needs

- Admin #1125 is MERGED. Prod already has ticket_promo_{create,list,preview,update}_v1 (read-only survey 2026-11-04). The deployed ticket-checkout edge function (v8, 2026-10-28) predates promo_code: the lead redeploys it from main before any walk. Do NOT assume the edge accepts promo_code on prod yet; the fakes in tests must model it.
- Website main has no promo.ts and no promo code in src/modules/tickets (checked 2026-11-04). Files to touch: src/modules/tickets/ticketCheckoutModel.ts, ticketCheckoutApi.ts, TicketsBlock.tsx; organiser Promo codes section under src/modules/organiser/p3/tickets/**; new src/modules/tickets/promo.ts (one shared reason-to-copy mapping).
- Booking fee is 0 (src/lib/ticketBookingFee.ts); the preview has no fee.
- Sales summary: show gross_pence as money taken and discounts_pence beside it (list = gross + discounts).
- The handover docs/handovers/ticket-promo-codes-web.md on main is STALE (says RPCs absent); replace it.

## Copied from the admin handover (docs/handover/ticket-promo-codes-db.md)

## What the Website half needs

RPCs (PostgREST):
- `ticket_promo_preview_v1(p_series uuid, p_ticket_type uuid, p_quantity int, p_code text)`, anon.
  `p_series` = series id or public event id. Returns exactly
  `{ok: true, unit_price, discount, total}` or `{ok: false, reason, unit_price, discount: 0, total}`
  (pence; `discount`/`total` are for the whole order). `rate_limited` / `not_found` / `invalid_quantity`
  carry nulls / list price. Uses nothing up; checkout re-validates.
- `ticket-checkout` edge function: add `promo_code` (string, optional, <= 64 chars) to the body.
  Code refusals come back as HTTP 409 `{ok: false, reason}`; `rate_limited` (the checkout limiter or
  reserve_v2's code-refusal limiter, 10 refused codes per email / 30 per IP an hour) is HTTP 429 with a
  `message`; a free result is `{ok: true, order_id, free: true}`.
- Organiser screens (authenticated): `ticket_promo_create_v1(p_event_series_id, p_organiser_id, p_code,
  p_kind 'percent'|'fixed', p_value, p_max_uses?, p_expires_at?)` -> `{ok, id, code}` | reasons
  `not_authorised, series_not_organisers, invalid_code, invalid_value, invalid_max_uses, invalid_expiry,
  code_taken`. `ticket_promo_update_v1(p_id, p_patch)` patch keys `active, expires_at, max_uses, kind,
  value` (null clears expiry/max_uses) -> extra reasons `locked_after_use, invalid_request`.
  `ticket_promo_list_v1(p_event_series_id)` -> `{ok, rows: [{id, organiser_id, code, kind, value,
  max_uses, used_count (counted orders holding a use), expires_at, active, created_at, paid_orders}]}`. Codes: 3..32 of A-Z 0-9 _ -,
  stored upper-case (send any case).

Suggested buyer copy per reason:

| reason | copy |
| --- | --- |
| `unknown_code` | "That code isn't recognised. Check the spelling and try again." |
| `inactive` | "That code is no longer active." |
| `expired` | "That code has expired." |
| `used_up` | "That code has been fully used." |
| `not_for_this_event` | "That code isn't valid for this event." |
| `no_discount` | "That code doesn't take anything off this ticket." |
| `below_minimum` | "With this code the total would be under 30p, which we can't charge. Please contact the organiser." |
| `rate_limited` | "Too many attempts. Please wait a while and try again." |

