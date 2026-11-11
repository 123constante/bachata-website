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

## HANDOVER-6 note
This reverses HANDOVER-6 "Tickets elsewhere kept when quiet" only for the live case: while our Buy is live the link is gone. When quiet (sold out, closed, not yet open) the "Tickets elsewhere" link is kept exactly as HANDOVER-6 said.

## Pending probe
While in-site ticketing is possible and the probe has not answered, the bar renders a same-height placeholder: neither her link nor a primary. Her link shows only once the probe resolved not-live (a 4s timeout, or a failed fetch, counts as not-live so the link never stays hidden by a stuck probe).

## OPEN OWNER DECISION: JSON-LD in server HTML
The series' ticket types are not in the page snapshot (only the organiser's own offers are), so `ticketingLive` cannot be computed at first render. Server HTML and non-JS crawlers keep her URL in JSON-LD; the client flips to ours once the probe resolves. Making the server HTML say ours needs a server-side ticket-types fetch (not done: out of scope, no supabase/** change). Owner to decide whether that is worth building.
