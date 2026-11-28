# Brief W4a: organiser "add a venue" one box + check card (Website)

Repo 123constante/bachata-website. Branch `feat/venue-add-organiser-box` (from main). Owner said "build this" on mockup v2 (2026-11-28). Behind `VITE_ENABLE_VENUE_ADD` (off). Flag off = today's screens exactly.

Read the brief with `git fetch origin brief/venue-add-w4a && git show FETCH_HEAD:docs/briefs/venue-add-w4a.md`. NEVER run `gh api` (it stalls on a permission prompt here).

## Goal
In the organiser create flow venue sheet (`src/modules/organiser/p3/new/sheets.tsx` `VenueSheet`), an organiser whose venue is not listed can add it in ONE box, check the filled card, and save. The new venue is picked into the draft straight away.

## Server pieces (already on prod, do not change)
- RPC `organiser_create_venue_v1(p jsonb)` (authenticated). p keys: `name` (1-120), `lat`, `lng` (numbers, required), `address` (number + street, <=300), `postcode`, `city_name`, `country`, optional `confirm_new: true`.
  Returns `{ok:true,id,name,address,postcode,city_name}` or `{ok:false,reason:'nearby',venues:[{id,name,address,postcode,distance_m}]}` (a venue within 50 m).
  Errors: `permission_denied: ...`, `invalid_payload: ...`, rate limit 10/day (from `_member_rate_check_v1`). The RPC is NOT in `src/integrations/supabase/types.ts` yet: call it through ONE small typed wrapper with a single narrow cast and a comment; do not regenerate types.
- Edge function `venue-lookup` (POST via `supabase.functions.invoke('venue-lookup', { body })`, signed-in only). Bodies and answers:
  - `{mode:'search', q}` -> `{ok:true, results:[{name, street, postcode, city, lat, lng, ...}]}` (free OSM Photon; may be empty)
  - `{mode:'link', url}` (any Google Maps link incl. maps.app.goo.gl) -> `{ok:true, place:{name|null, lat, lng}}` or `{ok:false, reason:'bad_link'|'no_pin_in_link'}`
  - `{mode:'postcode', postcode}` -> `{ok:true, place:{postcode, city, lat, lng}}` or `{ok:false, reason:'postcode_not_found'}`
  - any: `{ok:false, reason:'slow_down'|'lookup_unavailable'|'bad_input'|'bad_request'|'unauthorised'}`
  It is NOT deployed yet: build against these shapes with mocked tests; say "live lookup not walked" under Not verified.

## Screens (mockup v2, dark site look; copy below is final)
1. VenueSheet (flag on): keep the existing search of our venues first. Under the list (and in the no-match card) add a button **"Not listed? Add it"**. Flag on, the no-match body copy becomes: "Not listed yet? Tap Not listed? Add it. It takes a minute." Keep **Skip for now**.
2. Add screen: one box, label "Where is it?", placeholder "Venue name, Google Maps link or postcode".
   - Looks like a link (starts http, or contains maps.app.goo.gl / google.*/maps) -> `link` mode -> check card with pin; name from link if any, else empty.
   - Looks like a UK postcode (regex `^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$`, case-insensitive) -> `postcode` mode -> check card with postcode + city + pin filled, name and street empty and marked "Type this: postcodes don&rsquo;t include streets".
   - Else (2+ chars, debounce 400 ms) -> group "On Bachata Calendar" (matches from `useVenueOptions`, tapping one picks it exactly like today), then group "Map results" (`search` mode), then group "Not there?" with rows "Paste a Google Maps link" and "Use postcode instead" (each focuses the box with a hint line).
3. Check card (every path ends here): fields Name, Number and street, City, Postcode, all editable; note "Pin placed" (no map in this unit). Button **Save venue**. Save disabled with a reason line while name or pin is missing.
4. Nearby answer: yellow box "Is it <name>?" "We already have a venue <distance> m away: <name>, <formatted address>." Buttons **Yes, use that one** (picks that venue id) and **No, it&rsquo;s a different place** (re-sends with `confirm_new: true`).
5. On `ok:true`: pick `{id, name, place: city_name, cityName: city_name}` into the draft (same `CreateVenue` shape as `venueOf`), close the sheet, and invalidate `venueOptionsQueryKey`.

## Rules
- Typed input is never lost on any error: keep the box text and the check card fields in sessionStorage key `venue-add-draft` until saved; restore on reopen; clear on successful save.
- Error lines (plain words): slow_down "Too many lookups. Wait a minute and try again."; lookup_unavailable / network "The map search is not answering. Use postcode instead."; bad_link / no_pin_in_link "That link has no map pin. Open the place in Google Maps, tap Share, copy the link."; postcode_not_found "We can&rsquo;t find that postcode. Check it, or paste a Google Maps link."; permission_denied "Only organisers can add a venue."; rate limit "You&rsquo;ve added 10 venues today. Try again tomorrow."; other invalid_payload: show the text after the colon.
- Tap targets 48 px explicit (html font-size is ~13.5 px on phones; no rem for tap sizes). HTML entities in JSX, never raw curly quotes or dashes. Compact density (`.claude/rules/design-density.md`).
- Reuse `p3-*` classes and `StateCard`/`RetryButton` already used in sheets.tsx. No new dependency.

## Files (max 5, ~400 lines)
1. NEW `src/modules/organiser/shared/venueAdd.ts`: `classifyVenueInput`, lookup + create wrappers, error-to-copy map, draft storage helpers.
2. NEW `src/modules/organiser/shared/VenueAddSheet.tsx`: screens 2-4.
3. `src/modules/organiser/p3/new/sheets.tsx`: the button + route into VenueAddSheet (flag on only).
4. `src/modules/organiser/p3/new/model.ts`: flag-on copy line only.
5. NEW `src/modules/organiser/shared/__tests__/venueAdd.test.tsx`: table tests for classify (link forms incl. maps.app.goo.gl, postcodes with/without space, names), each error reason -> copy, nearby -> Yes/No paths, draft restore after a failed save, flag off = no button.

## Done when
- All tests above green; `npm run test:unit`, `npm run lint`, `npx tsc --noEmit -p .` clean for touched files; every CI job that applies to the PR run locally (read `.github/workflows`).
- PR body from the template with "Verified on real data" + honest "Not verified" (live lookup not deployed; no prod saves by the worker).
- Walk at 390x844 with mocked lookup: typing, postcode path, link path, nearby box, error lines, draft restore.
- Never write to prod. Never test on real organisers.

Out of scope (W4b later): mini map, station/parking facts, quick taps, wheelchair/website/phone, photo, P182/P183.
