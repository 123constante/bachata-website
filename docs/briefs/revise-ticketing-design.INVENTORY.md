# INVENTORY: revise ticketing price-steps design (review r1 fix round 1)

Written 2026-11-10 by the revise worker (dt_d5ce36fc31bd). Docs only. Inputs, as fetched:
- `docs/review/ticketing-organisers-r1.md` (branch `claude/review-ticketing-organisers`), findings F1-F11, inventory I-1..I-48, G-1..G-4.
- `docs/briefs/design-ticketing-organisers.md` DRAFT 1 and `docs/briefs/contract-ticket-tiers.md` DRAFT 3 (branch `brief/review-ticketing-organisers`). Line numbers below are in THOSE input copies (before this revision).

Prod probe this session (`stsdtacfauprzrdebmzg`, one SELECT on pg_proc / pg_stat_user_functions, no personal data, no write):
| Function | EXECUTE service_role / anon / authenticated | `prosrc` has `v_type.price_pence` | calls the seam |
|---|---|---|---|
| `ticket_checkout_reserve_v1` | yes / no / no | YES | no |
| `ticket_checkout_reserve_v2` | yes / no / no | YES | no |
| `ticket_checkout_reserve_v3` | yes / no / no | YES | no |
| `ticket_checkout_reserve_v4` | yes / no / no | no | YES |
| `ticket_promo_preview_v1`, `_v2` | yes / YES / YES | YES | no |
| `ticket_types_public_v1`, `_v2` | yes / YES / YES | no (reads `t.price_pence`, I-15/I-16) | no |
| `ticket_sales_summary_v1` / `_v2` | yes, no / no / yes | no | no |
| `_ticket_effective_unit_price_v1(p_type ticket_types, p_occurrence_id uuid)` | no / no / no (owner only) | n/a | (is the seam) |
`pg_stat_user_functions.calls` is 0 for every row: function call tracking is off on prod, so call counts CANNOT close G-1. Confirms review F1/F2.

## A. Design doc (`design-ticketing-organisers.md`, input lines)
| # | Line | Names | Finding |
|---|---|---|---|
| D-1 | 7 | owner rules: date+time UK, removable until it happens, "price rises on <date>", stale page confirm, paid-to-paid, max 3 | F5, F6, F8 |
| D-2 | 11 | `ticket_price_steps` table, `effective_from > now()` written, effective = latest step `<= t` | F5, F7, F8 |
| D-3 | 12 | NEW seam `_ticket_effective_price_v1(type_id, at)`; callers "public list, both reserves, organiser list, buyer confirm" (no preview) | F1, F2, F8, F10 |
| D-4 | 13 | base edit blocked once orders exist (`has_orders`) | F6 |
| D-5 | 14 | free ticket no steps; step may not make 0 | F6, F11 |
| D-6 | 15 | editor UK time; reasons `step_in_past`, `too_many_steps`, `not_paid_ticket`, `out_of_order` | F6, F8 |
| D-7 | 18 | public list `ticket_types_public_v1` "new columns or v2" | F2, F10 |
| D-8 | 19 | `p_expected_unit_price_pence`, `price_changed` reply | F3, F4 |
| D-9 | 20 | "both reserve paths v1 and v2" or retire v1 | F1 |
| D-10 | 21 | promo discount on effective price; OPEN-D1 | F2, F4 |
| D-11 | 22 | Stripe line item from order row (edge source on trust) | F1 (G-1), F4 |
| D-12 | 24-29 | s.3b "NOT landed"; S1a public_v2; S1b per-line; locks; "both reserve functions" | F1, F2, F3 |
| D-13 | 35 | T1 "explicit GRANT/REVOKE incl. service_role" (no list) | F7 |
| D-14 | 36 | T2 reserve integration, public list | F1, F2, F3 |
| D-15 | 37 | T3 editor, UK time | F8, F10 |
| D-16 | 38 | T4 "price rises on <date>" and confirm state | F3, F8 |
| D-17 | 41 | contract rows list | F2, F3, F4, F5, F6 |
| D-18 | 44 | OPEN-D1 fixed code across steps | F4 |
| D-19 | 46 | OPEN-D3 time source `now()` | F8 |
| D-20 | 47 | OPEN-D4 DST, "editor refuses non-existent local times" (no mechanism) | F8 |
| D-21 | 48 | OPEN-D5 bounds 32/37 min (pre-v4) | F9 |
| D-22 | 49 | OPEN-D6 price drop text | F8 |

## B. Contract doc (`contract-ticket-tiers.md`, input lines)
| # | Line | Names | Finding |
|---|---|---|---|
| C-1 | 11 | public v1 hides paused; reserve v1/v2 refusals | F1, F2 |
| C-2 | 17 | W1: "change in BOTH reserves and the public list"; free<->paid "proposed: refuse" | F1, F2, F6 |
| C-3 | 21 | open question "date or date-time, timezone" (closed by Q2) | F5, F8 |
| C-4 | 23-24 | Q2, Q5, Q6, Q7; "effective_from timestamptz in Europe/London" | F3, F5, F6, F8 |
| C-5 | 59 | V-4 price lock `has_orders` | F6 |
| C-6 | 60 | V-5 public list ordered by price | F10 |
| C-7 | 62-63 | V-7 edge calls reserve v1 / v2 (now four versions) | F1 |
| C-8 | 70 | V-9 guard list for new writers | F7 |
| C-9 | 149 | OPEN-6 retire reserve v1 "later" | F1 |
| C-10 | 156 | not verified: fee secret | F4 |

## GAPs
- GAP-1 (= review G-1): which reserve version the prod edge calls. Not closable here: admin repo not in this session, and `pg_stat_user_functions` is empty (tracking off). The revised design makes it a T2 pre-condition with a stated method (design s.3a).
- GAP-2: bodies of reserve v1-v3 and preview v1/v2 beyond the `price_pence` reads (only the `prosrc LIKE` probe above).
- GAP-3 (= G-3): admin migration bodies vs prod (no md5 compare).
- GAP-4: no ACL / DST / boundary claim here was tested; they are design rules for T1-T3.
- GAP-5: no section in either doc named sales summaries, upsert-to-0, or the London DST helper; those rows are NEW sections, not edits.

## Coverage
Sections listed: 22 design + 10 contract = 32. Every F row maps to at least one section edited:
F1 -> design s.2a, s.3a, s.5 T1/T2, contract W1 + V-7 note + OPEN-6. F2 -> design s.2a, s.3c, matrix M-1..M-4. F3 -> design s.3b, matrix M-5..M-8. F4 -> design s.3d. F5 -> design s.1, s.2, editor copy s.5 T3, contract Q-line. F6 -> design s.2b. F7 -> design s.5 T1 ACL list. F8 -> design s.2c. F9 -> design OPEN-D5. F10 -> design s.3c, T3. F11 -> design s.2b invariant.
Coverage: 11 / 11 findings mapped; 32 / 32 inventory sections either edited or superseded by a named new section; 5 GAPs open.
