# Design record: our ticketing leads when live (ticket-lead-in-site)

Owner words (2026-11-11): "I want to influence people to use only my ticketing method." Silent to the organiser; no fee or discount change.

## Chosen
Per night, hide the organiser's external ticket link while our Buy is buyable now (`ticketingLive` = `siteBarState` is `buy`). Sold out, closed, not yet open (`quiet`) and no types (`none`) are not live, so the link shows (quiet bar keeps its disabled reason, "Tickets elsewhere" link under it). JSON-LD offers use the event page URL while live, the external link otherwise.

## Alternatives recorded
- Keep a small "Tickets elsewhere" text link while live (previous behaviour, I8): rejected, owner wants ours only.
- Hide the link for the whole series when any type is ever on sale: rejected, strands buyers on nights that are not open yet.
- Hide it when quiet too: rejected, owner decision: link returns on sold out / closed.

## Surfaces
- `EventStickyActionBar`: link only when quiet. Live: single primary (ours).
- `BentoPage` JSON-LD: state starts false (hydration-safe, so server HTML and non-JS crawlers still see the external link) and flips when the probe resolves.
- `EventHeroMetaBlock`, `StickyTicketButton`: no live importers (grep), not edited.
- `FestivalDetail`: no in-site ticket sales (no `modules/tickets` import), unchanged.
