# INVENTORY for review r2: ticketing price steps (row 310 follow-up)

Written 2026-11-10 by the r2 reviewer BEFORE judging. Read-only. Sources: Website `origin/main` f0f3b29;
deployed edge `ticket-checkout` v22 (Supabase `get_edge_function`, read-only); prod `stsdtacfauprzrdebmzg`
(pg_proc, pg_default_acl, cron.job, supabase_migrations, counts only; SELECT only, no personal data, no write);
revised design `claude/revise-ticketing-design` aa28318. Admin repo: NOT reachable from this sandbox (G-2, G-3 below).

## A. Prod database (every price / tier / step field and function)
| # | Item | State on prod (2026-11-10) | Price read |
|---|---|---|---|
| J-1 | `ticket_types.price_pence` (base) | 17 types: 15 on_sale paid night, 1 paused paid night, 1 paused free night; 0 course | the only stored price |
| J-2 | `ticket_types.kind` | all `night` | - |
| J-3 | `ticket_price_steps` | ABSENT (`to_regclass` NULL) | - |
| J-4 | `ticket_orders` | 5 (2 expired, 2 paid, 1 refunded); newest 2026-11-09; ALL `hold_expires_at IS NULL` (none via v4) | stores `unit_price_pence`, `total_pence` |
| J-5 | `ticket_order_lines` | every one of the 5 orders HAS lines (incl. pre-v4 orders: line-fill trigger) | stores line `unit_price_pence`, `discount_pence` |
| J-6 | `_ticket_effective_unit_price_v1(p_type ticket_types, p_occurrence_id uuid)` | STABLE, not definer, search_path pinned, EXECUTE: owner only (service_role/anon/authenticated all false); body 30 chars = `p_type.price_pence`; md5 6706fd9f | the seam |
| J-7 | `ticket_checkout_reserve_v1` (6 args) | definer, EXECUTE service_role only; md5 41dbe1df | `v_type.price_pence` |
| J-8 | `ticket_checkout_reserve_v2` (9 args, promo) | same ACL; md5 1680ed1b | `v_type.price_pence` |
| J-9 | `ticket_checkout_reserve_v3` (10 args, +`p_occurrence_id`) | same ACL; md5 21481077; fee 0 when net 0 | `v_type.price_pence` (sub, discount, unit) |
| J-10 | `ticket_checkout_reserve_v4(p_lines jsonb, p_occurrence_id, ...)` | same ACL; md5 a54e9801; the ONLY seam caller in the DB | seam at body line 116 |
| J-11 | v4 body order (line numbers of prosrc) | 80 type locks; 99 night-count lock; 113 unpaid limiter; 116 seam unit; 123-131 promo limiter; 145 code lock; 168 discount; 186 refusal-row INSERT; 197 onboarding; 210 fee; 215/220 capacity; 228 order INSERT; 238 lines INSERT | - |
| J-12 | `ticket_promo_preview_v1` (4 args) | definer, EXECUTE anon+authenticated+service_role; md5 e9861d78 | `v_type.price_pence` |
| J-13 | `ticket_promo_preview_v2` (5 args) | same ACL; md5 882d0e64; total EXCLUDES the fee | `v_unit := v_type.price_pence` |
| J-14 | `ticket_types_public_v1` | definer SQL, EXECUTE anon+authenticated+service_role; md5 2a11debb | `t.price_pence` |
| J-15 | `ticket_types_public_v2` | same ACL; md5 cee0f8da; returns `d.price_pence`, `ORDER BY d.price_pence, d.name` | `t.price_pence` |
| J-16 | `ticket_sales_summary_v1` | EXECUTE authenticated+service_role | `t.price_pence` |
| J-17 | `ticket_sales_summary_v2` | EXECUTE authenticated only | `t.price_pence` |
| J-18 | `ticket_type_upsert_v1(p_payload jsonb)` | EXECUTE authenticated+service_role | `v_type.price_pence` (has_orders block) |
| J-19 | `ticket_order_hold_release_v1` | body read: `no_hold` when `hold_expires_at` NULL; releases only pending and expired holds via `close_unpaid_v1` | none |
| J-20 | `_ticket_effective_close_v1` | STABLE, service_role EXECUTE | none |
| J-21 | default ACL in `public` (pg_default_acl) | tables `arwdDxtm` and functions `X` granted to anon, authenticated, service_role by default (owners postgres AND supabase_admin) | - |
| J-22 | cron.job | `ticket-orders-sweep-5m` (*/5, `ticket_orders_sweep_v1`), email retry, ops health; NO pg_cron row for the `ticket-hold-sweep` edge | - |
| J-23 | supabase_migrations | `ticket_night_aware_v1` (v3), `ticket_mixed_basket_v1` (v4) recorded; `statements` NULL for every recent ticket migration | - |
| J-24 | DB `TimeZone` | UTC | - |
| J-25 | `price_step*`, `ticket_types_manage_v1`, `_ticket_effective_unit_price_at_v1` | absent | - |

## B. Deployed edge `ticket-checkout` v22 (files: index.ts, _shared/ticketingHandlers.ts, ticketing.ts, ticketingEdge.ts, ticketQr.ts)
| # | Item | Where | Fact |
|---|---|---|---|
| J-26 | Dispatch | ticketingHandlers.ts:200-202 | body WITH `lines` -> `basketCheckout` (v4); WITHOUT -> single path |
| J-27 | Single path reserve | ticketingHandlers.ts:249-268 | calls `ticket_checkout_reserve_v3` with `p_occurrence_id` |
| J-28 | Basket path reserve | ticketingHandlers.ts:460 | calls `ticket_checkout_reserve_v4` |
| J-29 | Fee | ticketingHandlers.ts:262; ticketing.ts:88 | from env `TICKET_BOOKING_FEE_PENCE`, default 0 |
| J-30 | Single Stripe line | ticketing.ts:330-352 | `unit_amount = order.unit_price_pence - discount/qty`, from the ORDER, not the type |
| J-31 | Basket Stripe lines | ticketing.ts:383-410 | per line `unit_price_pence - discount_pence/q`, from order lines |
| J-32 | Session life | ticketing.ts:48 | `CHECKOUT_EXPIRES_AFTER_SECONDS = 32*60` |
| J-33 | Hold sweep | ticketingHandlers.ts:948-989 | `ticket_orders_hold_due_v1` -> `hold_release_v1`; hold 15 min |
| J-34 | No expected-price field | whole edge | no `expected` key anywhere |

## C. Website (`origin/main` f0f3b29)
| # | Item | file:line | Fact |
|---|---|---|---|
| J-35 | Wire body | `src/modules/tickets/ticketCheckoutModel.ts:235-246` | `CheckoutBody` = single shape (`ticket_type_id`, `quantity`, `promo_code?`, `occurrence_id?`); NO `lines`, NO expected price |
| J-36 | Checkout POST | `src/modules/tickets/ticketCheckoutApi.ts:91-125` | posts `CheckoutBody` to `/functions/v1/ticket-checkout` -> edge single path -> **reserve v3** |
| J-37 | Public list | `ticketCheckoutApi.ts:50-57` | `ticket_types_public_v2` |
| J-38 | Promo preview | `ticketCheckoutApi.ts:64-78` | `ticket_promo_preview_v2` only; preview v1 has no Website caller |
| J-39 | Price parse | `ticketCheckoutModel.ts:70` | `pricePence = price_pence` |
| J-40 | Pay total | `src/modules/tickets/TicketsBlock.tsx:207` | preview `appliedTotalPence + feePence`, else `totals().totalPence` |
| J-41 | Promo shown only on paid | `TicketsBlock.tsx:126` | `promoOn = pricePence > 0` |
| J-42 | Free label | `ticketCheckoutModel.ts:233` | `buyLabel`: price 0 -> "Get free ticket" |
| J-43 | Reason copy | `ticketCheckoutModel.ts:303`; `src/modules/tickets/promo.ts:45` | no `price_changed` / `expected_price_required` |
| J-44 | Fee constant | `src/lib/ticketBookingFee.ts:16` | `BOOKING_FEE_PENCE = 0` |
| J-45 | Organiser list | `src/modules/organiser/tickets/ticketsApi.ts:113` | direct `ticket_types` select incl. `price_pence` |
| J-46 | Organiser write | `ticketsApi.ts:184` | upsert payload `price_pence` |
| J-47 | Status move gate | `src/modules/organiser/tickets/ticketModel.ts:251` | `moveBlock` reads `pricePence` |
| J-48 | London helpers | `ticketModel.ts:360-369` | probe (throwaway vitest, not committed): `2027-03-28T01:30` -> `01:30Z` -> back `02:30` (round trip differs); `2026-10-25T01:30` -> `01:30Z` (later, GMT); `2027-03-28T02:00` -> `01:00Z` round-trips; `Intl en-GB Europe/London` of 2026-12-31T23:30Z = "31 Dec", 2027-06-30T23:30Z = "1 Jul" |
| J-49 | Sales window validation | `ticketModel.ts:445-448` | uses `londonInputToIso`, no round-trip check |

## D. Admin app (organiser UI and migration source)
Not reachable (G-2). The organiser ticket UI judged here is the Website's (`src/modules/organiser/tickets/*`, J-45..J-49).

## GAPs
- G-1 CLOSED by J-26..J-28, J-35, J-36: the deployed edge calls v3 for every Website purchase and v4 only for a `lines` body no client sends.
- G-2 Admin app UI and admin repo source: not reachable (`git ls-remote` asks for credentials; out of session scope).
- G-3 PARTLY: prod md5 of every price function recorded above (J-6..J-18); migration `statements` are NULL on prod (J-23), so the source-vs-prod compare needs the admin repo. The DEPLOYED edge source is what G-1 needed and it is read.
- G-4 Phone walk: nothing built.

## Coverage
Items: 49 (J-1..J-49). Judged in the review: 49 / 49. GAPs: 4 (G-1 closed, G-3 partly, G-2 and G-4 open).
