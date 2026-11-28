# Brief W3 (Website repo, UI): one venue address line + dancer facts + "Something wrong?"


Size: 5 files, 390 lines
Owner approved ("build this", 2026-11-28). Plan: DESIGN-REGISTRY row "VENUE ADD PRO". Mockup screen 6: https://claude.ai/artifact/JUNjaPaSYWgPq5rCEjsxmJ

## Goal
Every place the site shows a venue address shows ONE line: `<street part>, <City> <POSTCODE>`, e.g. "Purbrook Street, London SE1 3DQ". All behind `VITE_ENABLE_VENUE_ADD` (default off; off = today's output exactly).

## Build
1. `src/lib/formatVenueAddress.ts`: pure `formatVenueAddress({address, postcode, cityName})`.
   - Strip a trailing city/postcode already inside `address` (e.g. "35-37 Battersea Rise, London SW11 1HG" -> street part "35-37 Battersea Rise").
   - Postcode: the `postcode` field wins; uppercase + single space. If the address contains a DIFFERENT postcode, still use the field (the tidy fixes data later).
   - No display-time "St" -> "Street" rewrite (critic decision; data tidy does that).
   - Missing parts are dropped with no stray commas. All empty -> null.
   - City = the venue's `cities.name` via its entity (already available where `city_name` is read; find the existing join, do not add a new fetch if one exists).
2. Use it in `src/modules/event-page/bento/blocks/VenueBlock.tsx` and `src/pages/VenueEntity.tsx`. `src/lib/buildEventJsonLd.ts` keeps separate streetAddress/addressLocality/postalCode fields (fill locality from city when the flag is on).
3. Dancer facts: floor, cloakroom, bar, free water, parking already flow through `src/modules/event-page/buildEventPageModel.ts` (~211-218) and `src/components/venue/VenueAtAGlance.tsx`. Make sure a fact shows only when filled (null = hidden, never "Unknown").
4. "Something wrong?" link on the event-page venue block: opens a small sheet (one text box, 2000 chars max) -> `submit_feedback_v1(p_body, 'venue', 'venue:<venue_id>')`. The 'venue' kind lands in a parallel admin PR; until then, if the RPC rejects the kind, show "Could not send. Try again later." and keep the typed text. Never lose typed text.

## Tests (table-driven vitest)
Real prod shapes (2026-11-28):
- Magdalen Hall: address "Purbrook St", postcode "SE1 3DQ", city London -> "Purbrook St, London SE1 3DQ".
- Hackney Showroom: "4 Murrain Rd, Finsbury Park", "N4 2BN" -> "4 Murrain Rd, Finsbury Park, London N4 2BN".
- The Table Battersea: "35-37 Battersea Rise, London SW11 1HG", postcode "SW11 1EE" -> "35-37 Battersea Rise, London SW11 1EE".
- Cocktail Club Canary Wharf: "9 Cabot Sq, Canary Wharf Estate", "E14 4QS".
- Nulls: no address; no postcode; lowercase postcode "se13dq"; non-UK (Spain) venue with no postcode.
- Flag off: components render exactly as before.

## Rules
Read CLAUDE.md (HTML entities in JSX, density rules, breadcrumbs, data-contracts rule: venue reads COALESCE(co.venue_id, e.venue_id)). Files over 2 KB via scripts/safe-edit.py. Run every CI step that applies. PR body from the template with "Verified on real data". Max 5 files / 400 lines (tests may be one extra file: say so).
