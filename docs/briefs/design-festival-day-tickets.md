# DESIGN: festival day tickets (GAP-F1)

Status: DRAFT 3, 2026-11-16 (owner answered grace and time zone; author read the door functions, see section 8). No independent review yet. No code. This is a proposal for independent review before any build.
Companion to `docs/briefs/contract-ticket-event-types.md` (owner click 2026-11-16: a festival keeps ONE date row; a per-night ticket names a day inside its span; no per-night date rows).
Facts below were read from prod function definitions and table columns on 2026-11-16 (read-only).

## 1. Facts that shape the design

- A festival is one series with one `event_occurrence_p5` row. Its span is `materialised_start_utc` to `materialised_end_utc` (53 to 127 hours on 9 of 10 live festivals; one has no span).
- `ticket_types` has `occurrence_id`, `kind` ('night' or 'course'), `valid_from`, `valid_to`. `tickets` and `ticket_order_lines` each carry `occurrence_id`. None carries a day.
- `_ticket_night_refusal_v1` refuses a buy when the occurrence is cancelled or `now() >= _ticket_night_end_v1(occurrence)`. For a festival the end is the END OF THE WHOLE SPAN, so a ticket for Friday stays buyable on Sunday.
- `_ticket_check_in_core_v2` scans a non-course ticket exactly once: it sets `tickets.checked_in_at` and the second scan returns `already_in`. A whole-festival pass therefore admits the holder on day 1 and refuses them on day 2. Course tickets scan once per night through `ticket_night_check_ins` (primary key `ticket_id, occurrence_id`); that key cannot tell two days of one occurrence apart.
- 12 ticket types exist on one festival (Ritmo de Bachata, 2027-02-05). No order has been placed on a festival. So nothing sold today is broken by this design; the festival pass door behaviour is a latent defect (see GAP-F2).

## 2. Proposal

### 2.1 One ticket type per festival day (recommended)
The organiser creates one ticket type per day, for example "Friday", "Saturday", "Sunday". Each carries a new nullable column `ticket_types.valid_day date` (a London calendar date inside the festival span). Capacity, price, sales window and sold-out are per type, so per-day capacity needs no new counting. A whole-festival pass is an ordinary type with `valid_day` null.

Why not one type with a buyer-picked day: it needs a per-day counter (today `reserved_count` is per type), a day column on `tickets` and order lines, a picker in checkout, and a hold per day. That is four new places for a bug and a second source of truth for stock.

### 2.2 Buyer view
The public ticket list groups types by `valid_day`: day tiers first in date order, passes beside them. The buyer picks a tier, not a day. No new checkout step. `ticket_types_public_v2` returns `valid_day`; reserve and checkout need no new input.

### 2.3 Refusal
`_ticket_night_refusal_v1` gains: if `valid_day` is set, refuse with `night_ended` once the end of that day has passed. The end of the day is the earlier of the next London midnight plus a grace set per festival (default 6 hours, for late socials) and the span end. DECIDED (owner click 2026-11-16): grace is 6 hours.

### 2.4 Door
- A day ticket (`valid_day` set) is valid only on its day. Scanning on another day returns `wrong_night` (the existing result name), with the day shown on the door screen. It scans once; the existing `tickets.checked_in_at` path is enough.
- A pass (`valid_day` null) must scan once PER DAY. Reuse `ticket_night_check_ins` by adding a `day date` column and changing its primary key to `(ticket_id, occurrence_id, day)`. Existing rows backfill with the London date of their scan.
- `_ticket_door_counts_v2` and `ticket_door_list_v2` filter by the day on the door screen (a day picker defaulting to today).

### 2.5 Organiser editor
The festival ticket panel offers "Add a day ticket". The day chooser lists only the London dates inside the span, so an organiser cannot pick a day outside the festival. A festival with no span shows "Set the festival start and end first" instead of the chooser (1 of 10 today).

### 2.6 Refunds
Unchanged. A refund is per order and the organiser decides the amount (contract section 4).

## 3. Enforcement (where the rule lives)
- `ticket_type_upsert_v1` rejects a `valid_day` outside the span and any `valid_day` on a non-festival series. A DB CHECK cannot read another table, so a constraint trigger is needed. (The course dates rule on `ticket_types` is a CHECK constraint, not a trigger, and `ticket_types` has no other trigger today, so there is no existing trigger pattern to copy.) The guard needs positive, negative, fidelity and non-vacuity cases.
- A guard `check_ticket_festival_day_v1` asserts every day type has a `valid_day` inside its occurrence span on live data.

## 4. Build slices (each its own PR, in order)
1. Migration: `ticket_types.valid_day`, the span trigger, upsert and public-list changes. No UI. Review class: risky (RPC, guard, ACL).
2. Migration: `ticket_night_check_ins.day` and the per-day pass scan, door counts and list. Review class: risky.
3. Website: organiser day-ticket panel behind a new flag; buyer grouping behind a new flag. Not risky (UI); needs a 390x844 walk.
4. Walk on a hidden live test festival owned by the walk test org: buy a day ticket and a pass, scan both on two days with a stubbed clock.

## 5. Gaps this design does NOT close
- GAP-F2 (latent today): a pass scans once for the whole festival. It is closed by slice 2.
- Per-day capacity for a pass: a pass counts once against its own capacity, not against each day. Open.
- A festival that moves its dates after tickets exist. A moved day leaves day tickets pointing outside the span. Needs a rule (block the move, or void and refund). Open.
- Time zone: DECIDED (owner click 2026-11-16): all day maths uses `Europe/London`; a festival abroad uses London calendar days. The 6 hour grace absorbs a 1 to 2 hour offset.

## 6. Not verified
- No festival order exists, so none of the door behaviour above has run on a festival.
- `ticket_types_public_v2` was not read for how it would carry `valid_day`.

## 7. Questions for review
- Is one-type-per-day acceptable to organisers who already sell 12 types on one festival, or does it multiply the tier list too far?
- Is changing a primary key on `ticket_night_check_ins` safe against its readers (`_ticket_door_counts_v2`, `ticket_door_list_v2`)?

## 8. Author's read of the door functions (2026-11-16, read-only prod, corrects earlier sections)

- `_ticket_door_night_ok_v1(kind, valid_from, valid_to, ticket_night, door_night)` returns true for a non-course ticket when `ticket_night` is null or equals the door night. A festival has one night, so a day ticket would pass on EVERY day. The design must change this function: add a `valid_day` and a door-day argument. It is called by `_ticket_check_in_core_v2`, `_ticket_door_counts_v2` and `ticket_door_list_v2`, so all three change signature together (slice 2, not slice 1).
- `_ticket_door_counts_v2` counts `in_count` for a non-course ticket from `tickets.checked_in_at`. With a per-day pass scan that count is wrong for passes; passes must count from `ticket_night_check_ins` for the chosen day, like course tickets do today.
- `ticket_night_check_ins`: 0 rows in prod, exactly three readers (`_ticket_check_in_core_v2`, `_ticket_door_counts_v2`, `ticket_door_list_v2`), no views, no RLS policies, no triggers except the walk read-only deny pair. Changing the primary key breaks nothing outside those three, and no backfill is needed. Each reader joins on `(ticket_id, occurrence_id)` and would double count once a second day exists, so each must also filter by day.
- ACL: the 2027-03-22 migration (20270322200000) grants `authenticated` SELECT on `ticket_types` by column name. A new `valid_day` column is NOT readable until a grant names it. Slice 1 must add the grant and a test that `authenticated` can read it. Whether `anon` should read it follows `ticket_types_public_v2` (not yet read).
- Still not read: `ticket_types_public_v2`, `ticket_type_upsert_v1`, `ticket_door_list_v2` bodies.
