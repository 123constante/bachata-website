# Design record: in-site tickets on festival pages (ticket-festival-in-site)

Owner words: "I want to influence people to use only my ticketing method." Ritmo first.
Extends `docs/design/ticket-lead-in-site.md` (event pages) to `src/pages/FestivalDetail.tsx`.

## Prod shape survey (read-only, 2026-11-11)
| lifecycle | festivals | occurrences each | ticket types | organiser link | passes JSON |
|---|---|---|---|---|---|
| live, Ritmo | 1 | 1 (future) | 12, all series-wide (`occurrence_id` null, kind `night`): 6 buyable now, 6 not yet open; Stripe charges enabled | yes | none |
| live, future | 4 | 1 | 0 | yes | 1 of 4 |
| live, past | 4 | 1 | 0 | yes | 1 of 4 |
| archived | 5 | 1 | 0 | 3 of 5 | 2 of 5 |
No festival has per-night (`occurrence_id` set) types, none is sold out / closed / paused today, and every festival has exactly ONE occurrence.

## Chosen
The festival page reuses the event page's whole in-site path, no second ticket system:
- The sticky bar (`EventStickyActionBar`, already shared) gets `inSiteTicketing`, the festival's night (`occurrenceId`), `onOpenTickets` and `onTicketingLive`. Its lazy `InSiteTicketProbe` reads `ticket_types_public_v2` under the same query key the buy block uses.
- The night is the snapshot's one occurrence (`festivalNightId`). Series-wide types (the whole-festival pass shape, Ritmo) answer for it directly; a per-night type with no night reads `needs_night` and the bar says "Choose a night", which opens the tickets page with its NightPicker.
- `ticketingLive` = probe said `buy` for that night. Live: our "Buy tickets" in the bar, the hero CTA, the pass cards and the end CTA; the organiser's link is nowhere on the page. Not live (sold out, closed, not yet, no types, fetch failed, 4s timeout): the page is exactly as before (bar quiet with its reason and "Tickets elsewhere"; hero/pass/end keep her link, else "Tickets TBA").
- Buy opens the event pages' `EventTicketsPage`, through a tiny lazy wrapper (`src/modules/tickets/FestivalTicketsPage.tsx`) that supplies the programme hooks, so the tickets module stays out of the festival page's first-load graph.
- Suppressed for ended, cancelled and paused festivals (`festivalInSiteTicketing`); an ended festival still has no ticket CTA at all.
- JSON-LD offers (`festivalJsonLdOffers`, fix round finding 2/4): live -> one offer per LIVE buyable ticket type (name, price from the wire, GBP, our url), never the organiser's passes (different list, different prices); this also covers a live festival with no passes. Not live -> her passes with her link (unchanged). The live types come from the probe via #1556's `liveOffers` path (ported verbatim: identical hunks in EventStickyActionBar, InSiteTicketProbe, ticketCheckoutApi, ticketOfferUrl). Ended: no offers (builder policy, unchanged).

## Alternatives recorded
- Replace the passes grid with the inline `TicketsBlock`: rejected, festivals' organiser `passes` JSON and our ticket types are different lists; swapping the grid would hide her passes when quiet. Live cards just open our page.
- ~~Hide her link on the hero/pass/end while the probe is pending: rejected~~ REVERSED in the fix round (review finding 3): while the probe is pending (flag on, bookable festival) the hero and end CTA render a same-size INVISIBLE placeholder (no layout shift) and pass cards render without a link. Her link returns once the probe answers (quiet, no types, fetch failed, 4s timeout). Consequence: with `publicTicketing` on, server HTML of a bookable festival no longer contains her link in those three places.
- Probe with no night (`occurrenceId` null): rejected, a per-night type would read `needs_night` on a one-night festival.

## Open (owner)
- Same as event pages: server HTML and non-JS crawlers keep her URL in JSON-LD; the client flips to ours once the probe resolves.
- "None when closed": read as cancelled/paused (no in-site offer). A sales-closed festival keeps her link in offers, matching event pages.
- Stripe test-mode order on Ritmo is the lead's step after merge (needs `publicTicketing` on in the preview and a test card).
