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

## 3. Course door rule (proposed, owner has not objected; confirm at first course order)

- A course ticket scans once per night. Per-night scans are stored in `ticket_night_check_ins`
  (`ticket_id`, `occurrence_id`, `checked_in_at`, `checked_in_by`); `_ticket_check_in_core_v2`,
  `_ticket_door_counts_v2` and `ticket_door_list_v2` read it and mention courses.
- Status: SUPPORTED in code. Not exercised by any real course order.

## 4. Course refund rule (DECIDED by owner click, 2026-11-16)

- Rule: the organiser decides the refund amount by hand. No automatic pro-rata in v1.
- Today: `ticket_order_mark_refunded_v1` / `ticket_order_charge_refunded_v1` / `ticket_refund_authorise_v1`
  do not mention course and do not read night check-ins. A refund is per order, so the rule needs no build.
- Not verified: a manual part-amount refund on a course order (no course order exists).

## 5. Gaps (each becomes its own follow-up; none is a contract promise)

1. GAP-F1 Festival per-night tickets: a festival with one date has nothing to pick. Needs either multi-date festivals or a defined "night" model. Design first.
2. GAP-C1 Class and workshop: never bought; no walk of the public buy path for a per-date ticket.
3. GAP-C2 Course: no public purchase walked; refund and door never exercised on real data.
4. Closed: course refund rule decided as organiser-decides (section 4). Check a part-amount refund works when a course order first exists.

## 4b. Not verified

- Public buy-page UI filters by event type: not read line by line.
- Whether `ticket_types_public_v2` returns a per-date class ticket correctly: no prod row to read.
- Live email delivery and a fresh door scan: not re-run (needs a paid order on the live Stripe key).

## 6. Audit: how festivals and courses are run today (prod, live series, read-only, 2026-11-16)

### Festivals (10 live)
- A festival is ONE series with ONE date row. The multi-day span lives in the date's start and end times: 53 to 127 hours (about 2 to 5 days). 9 of 10 have a span; one has none.
- Selling today is external: 9 of 10 carry the organiser's own ticket link. Only Ritmo de Bachata (2027-02-05) uses our tickets (12 types).
- Organiser-written `passes` JSON exists on 2 (9 and 3 passes). `festival_meta` holds features, gallery, hotels, languages, music styles, programme and a ticket link.
- Consequence for the contract: "a night" is not a row today. Per-night tickets need a night model inside a one-date festival (GAP-F1). Whole-festival passes fit the data as it is.

### Courses (8 live)
- A course is a weekly-recurring series that ends after a count; `course_total_sessions` equals the number of date rows on all 8 (3 to 16 sessions).
- Selling today: 3 of 8 use an external ticket link, 5 have none. 0 have our tickets. 1 has `passes` JSON.
- Consequence for the contract: our course ticket (`valid_from` to `valid_to`, whole course) maps onto these series. The 5 with no link are the first candidates for in-site selling.

### Decided (owner click, 2026-11-16)
- Festival nights: a festival keeps ONE date row; a per-night ticket names a day inside its span. No per-night date rows. GAP-F1 stays open as a build item: it needs a design (ticket field for the day, buyer picker, door check-in for a day inside one date) before any code.

### Open for the owner (not decided)
- Do organisers want the external ticket link hidden once our tickets are live? Festivals already do this (see `ticket-festival-in-site.md`); courses not designed.
