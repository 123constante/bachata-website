# Handover: venue-add W3 display

Done: formatVenueAddress (+10-case table test), VenueBlock + VenueEntity use it behind VITE_ENABLE_VENUE_ADD, "Something wrong?" sheet (submit_feedback_v1, kind 'venue', page 'venue:<id>'; typed text kept on error).
Not done: JSON-LD untouched (locality already filled from venue.city); no browser walk; VenueAtAGlance already hides unfilled facts (truthy gates), unchanged.
tsc run on this branch (tsconfig.app.json): 0 errors in branch files.

## Fix round 1 (brief venue-add-w3-fix)
Done: all 9 items. formatVenueAddress lifts an address-only postcode, city strip only after a comma / whole string, strips repeatedly (+7 table rows). Feedback control moved outside the tile link (flag off = tile alone, DOM unchanged); typed rpc `supabase.rpc('submit_feedback_v1')`; signed out gets "Sign in to tell us what is wrong" + button to `/auth?mode=signin&returnTo=<page>` (no text box); `not_signed_in` keeps typed text and shows sign-in; other errors "Could not send. Try again later."; `…` escape. New VenueBlock.venueAdd.test.tsx (flag off/on).
Not verified: no 390x844 browser walk; VenueEntity flag-off branch is the original expression verbatim but has no render test (page needs heavy mocks); lint chain: 4 links fail identically on main without my changes (rpc-typing, architecture, no-social-word, onboarding-write-doors), none name branch files; eslint on touched files clean.
tsc run on this branch (tsconfig.app.json): 0 errors in branch files. Vitest src/modules/event-page + formatter: 449 pass.
