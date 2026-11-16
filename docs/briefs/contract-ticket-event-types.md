# CONTRACT: ticketing by event type (festival, class/workshop, course, party)

Companion to `docs/briefs/contract-ticket-tiers.md` (DRAFT 5). Written 2026-11-16.
Owner decisions are from click answers on 2026-11-16. "Today" is read-only prod
(project stsdtacfauprzrdebmzg) and function definitions on 2026-11-16, no writes.
Status: DRAFT 1. A row marked GAP is a decision not yet supported; it is NOT a promise.

## 1. Prod shape (live series, 2026-11-16)

| Type | Live series | Avg dates per series | Max |
|---|---|---|---|
| party | 47 | 36.9 | 133 |
| class | 8 | 28.4 | 77 |
| course | 8 | 6.4 | 16 |
| festival | 10 | 1.0 | 1 |
| workshop | 0 | n/a | n/a |

Ticket types in prod: 19, all `kind = night`, all series-wide (`occurrence_id` null).
12 on festivals (one organiser), 7 on parties. 0 course tickets. 0 on classes.
Real orders: 3 (2026-11-07), all party/festival-night shape.

## 2. Rules (owner decision / today / verified)

| Type | Owner decision | Today in code and data | Verified in prod |
|---|---|---|---|
| Party | One ticket per night; series-wide or per date. | Supported. `ticket_types_public_v2`, reserve v5, checkout v28 have no event-type check; gate is live series + organiser. | YES: 3 paid/refunded orders, email sent, QR scanned. |
| Festival | Whole-festival passes AND per-night tickets on the same festival. Buyer picks a night for a per-night ticket. | Passes: supported (Ritmo, 12 types). Per-night: the ticket model supports `occurrence_id`, but every live festival has exactly ONE date, so there is no second night to attach. | Passes: types exist, no order seen from a festival page. Per-night: NO. |
| Class | One ticket per session date (drop-in). Buyer picks the date. No block ticket. | `occurrence_id` per date is supported by the model; classes average 28 dates. Public buy path has class/workshop branches (unit tests only). | NO: never sold. |
| Workshop | Same as class. | Same as class. No live workshop series. | NO. |
| Course | Whole course only (decided 2026-11-09). Price steps allowed. | `kind = course` needs `valid_from`/`valid_to` and no `occurrence_id` (DB CHECK). Editor and price steps walked 2026-11-16 on a draft. | Organiser side: YES (draft ticket, step set and removed). Public buy and real order: NO. |

## 3. Course door rule (proposed, owner to confirm)

- A course ticket scans once per night. Per-night scans are stored in `ticket_night_check_ins`
  (`ticket_id`, `occurrence_id`, `checked_in_at`, `checked_in_by`); `_ticket_check_in_core_v2`,
  `_ticket_door_counts_v2` and `ticket_door_list_v2` read it and mention courses.
- Status: SUPPORTED in code. Not exercised by any real course order.

## 4. Course refund rule (proposed, owner to confirm)

- Today: `ticket_order_mark_refunded_v1` / `ticket_order_charge_refunded_v1` / `ticket_refund_authorise_v1`
  do not mention course and do not read night check-ins. A refund is per order, not pro-rata.
- Proposal: a part-way course refund is decided by the organiser as a manual amount; no automatic pro-rata in v1.
  Confirm with the owner before any build.

## 5. Gaps (each becomes its own follow-up; none is a contract promise)

1. GAP-F1 Festival per-night tickets: a festival with one date has nothing to pick. Needs either multi-date festivals or a defined "night" model. Design first.
2. GAP-C1 Class and workshop: never bought; no walk of the public buy path for a per-date ticket.
3. GAP-C2 Course: no public purchase walked; refund and door never exercised on real data.
4. GAP-R1 Course refund has no part-way rule (section 4).

## 4b. Not verified

- Public buy-page UI filters by event type: not read line by line.
- Whether `ticket_types_public_v2` returns a per-date class ticket correctly: no prod row to read.
- Live email delivery and a fresh door scan: not re-run (needs a paid order on the live Stripe key).
