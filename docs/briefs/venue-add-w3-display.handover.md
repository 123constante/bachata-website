# Handover: venue-add W3 display

Done: formatVenueAddress (+10-case table test), VenueBlock + VenueEntity use it behind VITE_ENABLE_VENUE_ADD, "Something wrong?" sheet (submit_feedback_v1, kind 'venue', page 'venue:<id>'; typed text kept on error).
Not done: JSON-LD untouched (locality already filled from venue.city); no browser walk; VenueAtAGlance already hides unfilled facts (truthy gates), unchanged.
tsc run on this branch (tsconfig.app.json): 0 errors in branch files.
