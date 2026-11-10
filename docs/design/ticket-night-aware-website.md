# S1a Website: buyers choose and pay for a specific night

Brief: `docs/briefs/ticket-night-aware-s1a-website.md` (branch `brief/ticket-night-aware-website`, blob 0ad46cd).

## Prod wire, read back 2026-11-10 (read-only SELECT, project stsdtacfauprzrdebmzg)

`pg_get_function_result`:

- `ticket_types_public_v2(p_event_series_id uuid, p_occurrence_id uuid DEFAULT NULL)` returns
  `TABLE(id, occurrence_id, name, price_pence, currency, status, remaining, sold_out, sales_open_at, sales_close_at, effective_close_at, kind, valid_from, valid_to)` -- matches the brief.
- `ticket_promo_preview_v2(p_series uuid, p_ticket_type uuid, p_quantity int, p_code text, p_occurrence_id uuid)` returns jsonb.

From the function body: rows whose night is refused (`_ticket_night_refusal_v1` not null: past,
cancelled, wrong night) are filtered out; with `p_occurrence_id` NULL a per-night type answers
`remaining` NULL and `sold_out` false. **That NULL is the trap**: the v1 parser read it as 0 = "Sold out".
It now parses as `needsNight`.

## Shape survey (counts only, no personal data)

Latino Flava (the brief's example) is **`ended` with 0 ticket types** in prod, so it cannot be
called meaningfully. The survey used every live series that has ticket types instead:

| Series (live) | Night asked | Rows | kind | occurrence_id | remaining | sold_out | effective_close_at |
|---|---|---|---|---|---|---|---|
| Coco Loco (weekly, 53 nights, none past) | next night (a) | 3 | night x3 | null (series-wide) | 50 | false | 2026-11-11 19:15 UTC (= sales_close_at) |
| Coco Loco | 2nd night | 3 | night x3 | null | 50 | false | same fixed close |
| Coco Loco | NULL (d) | 3 | night x3 | null | **NULL** | false | same |
| Coco Loco | cancelled (c) | -- | -- | -- | -- | -- | Coco Loco has no cancelled night |
| Bachata Playground (weekly, 70 nights) | past night (b) | 0 | -- | -- | -- | -- | types are `paused` |
| Bachata Playground | future night | 0 | -- | -- | -- | -- | types are `paused` |
| Ritmo de Bachata Festival (1 night) | its night | 12 | night x12 | null | 10 / 100 / 200 | false | per type |
| Ritmo de Bachata Festival | NULL | 12 | night x12 | null | NULL | false | per type |

Facts: only kind `night` exists in prod today (no `course` row); no night has sold out, so
`remaining` / `sold_out` do not yet differ per night in live data (the function computes them per
night: `capacity - _ticket_held_v1(t, night)`). Past and cancelled nights could not be shown
with live rows (no series with live types has one); per the function body they answer zero rows.
The test matrix carries these shapes (`src/modules/tickets/__tests__/nightAware.matrix.test.tsx`).

## Design (ONE chosen)

Same Tickets block and sticky bar; the night is carried, not chosen, on this page. The page's
night is `?occurrenceId` or the snapshot's next night (BentoPage already resolves it).

- Read: `fetchPublicTicketTypes(seriesId, occurrenceId)` -> v2; key `['public-ticket-types', seriesId, occurrenceId]`,
  shared by `TicketsBlock`, `EventTicketsPage` and the sticky-bar probe (`InSiteTicketProbe`, now given the night) -- one fetch, so the bar and the block cannot disagree.
- Rule (`availability`): server `sold_out` -> Sold out; no-night per-night row -> **Choose a night**; `effective_close_at` (falls back to `sales_close_at`) for Closed. `typesForNight` stays as a safety filter.
- No night on screen: rows show "Choose a night"; no Buy, no form; the line "Choose a night to buy tickets." and a **See the dates** control (closes the Tickets page and scrolls to the Dates tile). Quiet bar: "Choose a night".
- Promo preview: `ticket_promo_preview_v2` with the night. Checkout body: `occurrence_id` whenever the page has a night (course tickets too; the server decides).
- Refusals `wrong_night`, `night_required`, `night_cancelled`, `night_ended`, `not_course_night`: own copy each, each says "You have not been charged" and names the next step; way forward **Choose another night** (to the dates), and the types list is re-read.
- Course row (kind `course` with `valid_from..valid_to`): "Valid every Tuesday from Tuesday 3 November 2026 to Tuesday 15 December 2026, once each night." built from the data, full weekday names.

Alternatives noted, not chosen: (1) a night picker inside the Tickets page -- duplicates the Dates
tile and needs the occurrence list in the tickets chunk; (2) hiding night-kind types on a no-night
page -- leaves the buyer with no way forward.

Accessibility: the new control is a 44px-min underline button in body text colour (same tokens as the
existing way-forward buttons, contrast >= 4.5 on `--bento-surface-raised`); no new fixed widths, so no
sideways scroll at 390px. Empty/loading/error: loading and no-rows render nothing (unchanged); every
refusal has a control; the no-night state has a control.

## Fix round 1 (review FIX-1..3): the night list moves INTO the Tickets page

The review found the "Dates tile" target above never renders on a page that sells tickets: BentoPage
only shows `dates` for `format='course'` with more than one night, and prod sellers (2026-11-10,
read-only) are two weekly parties (53 future nights each, snapshot window 52) and one festival (one
night). The "alternative not chosen (1)" above is therefore the design now.

**Chosen: a night list inside the Tickets block** (`src/modules/tickets/NightPicker.tsx`).

- Source: `snapshot.occurrences` (BentoPage passes it to `EventTicketsPage` as `nights`; the page maps
  it with the one pure function `nightOptions`): future (London date >= today), not cancelled, not
  `isPast`, soonest first, at most 8, label "Tuesday 10 November 2026" (full weekday, ICU-free) plus
  the wall-clock start time (none when `hasTimedSession === false` or the start is a bare date).
  The night on screen (the one just refused) is left out.
- Shown when a night is the only way forward (a `needs_night` row and nothing buyable here) or after
  any of the five night refusals. Each row is a 48px button that navigates to `?occurrenceId=<id>`
  on the same page (replacing the history entry, other params kept, a stale `tickets=cancelled`
  dropped). The event page reloads for the new night, so the Tickets overlay unmounts during the
  load and remounts on that night (BentoPage keeps `ticketsOpen`); anything typed into the form is
  lost (follow-up). A prop-only night change also clears the old refusal and pick.
- Every control lands on it: the sticky bar's "Choose a night" now OPENS the Tickets page (which shows
  the list); the block's quiet-bar "Choose a night" is a working button that scrolls the list into
  view (FIX-2: it was disabled); the refusal's "Choose another night" scrolls the list into view and
  the refusal stays on screen above it.
- Copy: the five refusals now end "See the other nights below." (`night_required`: "See the nights
  below."), never "the dates list"; what is below is either the list or the empty state.
- Empty state (festival after a refusal; or every night past/cancelled): no heading, "No other nights
  are listed for this event." + a 44px "Contact the organiser" link (or "Check back later.").
- Mixed list (a buyable row plus a `needs_night` row; v2 cannot produce it with a night, review N4):
  no list, Buy for this night stays the one action.
- The rows are snapshot nights, not a per-night stock read: a listed night can still turn out sold
  out or not yet on sale; that night's page then says so (quiet bar). Follow-up in the handover.
- N1: the Stripe cancel URL carries the resolved night (`?occurrenceId=`) even when the page URL did
  not. N2: `promoKey` includes the night, so a preview for night A is never shown for night B.

Alternatives noted, not chosen: (a) navigate straight to the next future night -- wrong for a
`night_ended`/`wrong_night` buyer who wants a specific night, and silent about which night was picked;
(b) render the Dates tile for every format -- a page-wide layout change outside this money-path fix;
(c) the list on the event page rather than in the Tickets page -- the sticky bar would then need its
own list and the two could disagree.
