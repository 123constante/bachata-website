# Inventory: ticket promo codes, organiser section

Brief: `docs/briefs/ticket-promo-codes-organiser.md` (branch `brief/ticket-promo-codes-organiser`).
Written 2026-11-04 before code (owner rule). Live definitions read read-only on prod
(`stsdtacfauprzrdebmzg`, `pg_proc.prosrc`, ACL) the same day.

## Data source (proved on prod, read-only)

| RPC | ACL | DEFINER | Reads | Writes | Gate |
|---|---|---|---|---|---|
| `ticket_promo_list_v1(p_event_series_id)` | authenticated | yes | `event_series_p5.organiser_ids`, `ticket_promo_codes`, `ticket_orders` (counts) | none | none; `not_authorised` unless the caller can manage one of the series' organisers (`_ticket_can_manage_organiser_v1`) |
| `ticket_promo_create_v1(series, organiser, code, kind, value, max_uses?, expires_at?)` | authenticated | yes | `event_series_p5` | INSERT `ticket_promo_codes` | `_require_onboarding_complete_v1` (raises) after the manage check |
| `ticket_promo_update_v1(p_id, p_patch)` | authenticated | yes | `ticket_promo_codes` (FOR UPDATE), `ticket_orders` | UPDATE `ticket_promo_codes` | onboarding gate on every patch EXCEPT exactly `{"active": false}` |

Who writes `ticket_promo_codes`: only these two DEFINER RPCs (`created_by = auth.uid()`).
`ticket_orders.promo_code_id` / `promo_use_released` are written by the buyer checkout (not this section).
Counts 2026-11-04: Stripe accounts 2, series with ticket types 1, promo rows 0, orders with a code 0.

## Fields (list row) -> where shown

| # | Field | Shown | Where |
|---|---|---|---|
| 1 | id | no (key only) | `PromoSection.tsx` row key / testid |
| 2 | organiser_id | no: always the page that made it; listing it adds nothing for a one-page account | GAP G4 |
| 3 | code | yes | row title, sheet title |
| 4 | kind | yes, in words | `discountWords` |
| 5 | value | yes, in words (% or &pound;) | `discountWords` |
| 6 | max_uses | yes | `usesLine` ("of N orders" / "no limit") |
| 7 | used_count | yes | `usesLine` |
| 8 | expires_at | yes, London, full weekday | `expiryLine` |
| 9 | active | yes | switch + state tag |
| 10 | created_at | no: not needed to act | GAP G5 |
| 11 | paid_orders | yes | `paidLine` |

## States -> where shown

| # | State | Shown | What the person can do (copy) |
|---|---|---|---|
| 12 | on | tag "On" | - |
| 13 | turned off | tag "Turned off" | `STATE_NEXT.off` |
| 14 | ended (past expiry) | tag "Ended" | `STATE_NEXT.expired` |
| 15 | used up | tag "Used up" | `STATE_NEXT.used_up` |
| 16 | locked (any order) | sheet: discount disabled | `LOCKED_WHY` |
| 17 | list loading / error / refused / empty | yes | Try again / `LIST_REFUSED` / empty copy |

## Actions and refusals

| # | Action / reason | Shown | Copy |
|---|---|---|---|
| 18 | create | sheet "New promo code" | toast on success |
| 19 | edit (limit, end date; kind/value until used) | sheet | toast; untouched save = no command |
| 20 | turn off / on | row switch | toast |
| 21 | not_authorised | yes | `REASON_COPY` |
| 22 | series_not_organisers | yes | `REASON_COPY` |
| 23 | invalid_code | yes (also pre-checked) | `REASON_COPY` |
| 24 | invalid_value | yes (also pre-checked) | `REASON_COPY` |
| 25 | invalid_max_uses | yes (also pre-checked) | `REASON_COPY` |
| 26 | invalid_expiry | yes (also pre-checked) | `REASON_COPY` |
| 27 | code_taken (create, and update turning on) | yes | `REASON_COPY` |
| 28 | locked_after_use | yes | `REASON_COPY` = `LOCKED_WHY` |
| 29 | invalid_request | yes | `REASON_COPY` |
| 30 | onboarding refusal (raised) | shared gate sheet via `useGatedCopy` | gate copy |
| 31 | network error | yes | `NETWORK` |

## Existing P3 ticketing screens it sits beside

- `src/modules/organiser/p3/tickets/TicketsEntry.tsx:59` `TicketsEntry` (row + tall sheet); toast `say` :103, `late` :139, toast stack :388, `TicketToast` :403. The section mounts in the list view after the types/orders body.
- `TypeSheet.tsx:60` (form fields `p3-field`/`p3-in`, chips `p3-chips`, server error `p3-error` :231) &mdash; the promo sheet copies these.
- `StackSheet.tsx:21` &mdash; the promo sheet IS a StackSheet layer over the tall sheet (portalled, inert under, focus back).
- `RefundSheet.tsx:11` &mdash; same late/alert pattern (`onLate`).
- `gateCopy.ts:5,8` &mdash; not needed: the promo refusals go through `useGatedCopy` (gate sheet).
- `model.ts:44` `TONE_CLASS` &mdash; reused for the state tag.
- `data.ts:51,60` &mdash; the reads; NOT changed (see G1).

## GAPS

- G1: the brief asked for the data hook in `data.ts`. `data.ts` is imported by the Home screen (TicketsSoldTile), so a hook there would put the promo wire in a non-lazy chunk. `usePromoCodes` lives in `promo/promoApi.ts` (lazy chunk only). `data.ts` is unchanged.
- G2: `ticket_sales_summary_v1` `gross_pence` / `discounts_pence` are not shown. The summary parser is `src/modules/organiser/tickets/ticketsApi.ts` and the money lines are in `GetPaid.tsx` / the Home tile, all outside this brief's Files list. Follow-up ticket.
- G3: the server locks kind/value when ANY order carries the code, including released ones; the list exposes only `used_count` (not released) and `paid_orders`. A code whose only order was released shows unlocked; the server answers `locked_after_use` and the sheet shows `LOCKED_WHY`.
- G4: `organiser_id` not shown (a series with two organiser pages would list both pages' codes without saying whose). Also the lint rule `no-legacy-organiser-fields` keeps that key out of new files.
- G5: `created_at` not shown (the server already orders active first, newest first).
- G6: the e2e walk spec is not in `npm run test:e2e:p3` (package.json is outside Files); run by name.
- G7: `scripts/onboarding-write-doors.json` (outside Files) gains the two gated doors and their wrapper: `check-onboarding-write-doors.mjs` reds an unlisted write-shaped RPC, and the live guard already gates 10 doors.

## Coverage

31 rows. 27 shown, 4 not shown with a reason (rows 1, 2, 10, and 30 is shown by the shared gate sheet, counted shown). None silently omitted.
