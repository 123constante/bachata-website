# ER-C5 (website-screen): venue picker with "Add a new venue"

Branch `claude/er-c5-venue` from `claude/er-s1-rules`. Rule 29; D1 gaps (venue change uses the same picker). Read ER-COMMON and ER-INTERFACE section 3.

NEW dir `src/modules/organiser/venue/`: search existing venues; "+ Add a new venue" shown ONLY once 2+ letters are typed (name prefilled) and only under the results; then name + postcode; UK postcode lookup via postcodes.io (no key; address, area, lat/lng, map pin); "Is it one of these?" list (same postcode or shared name word) where the person must tap a venue or "No, it's a new venue"; then "Add venue". Client for `owner_create_venue_draft_v1` and `owner_similar_venues_v1` built against the pinned interface; an `existing:true` answer picks that venue. A created draft venue is usable on the event at once. "Server not landed" in the PR; fake the server in tests. Postcode failures (bad, not found, offline) have a retry state.

Tests: table over search shapes (0 results, exact, partial), postcode shapes, duplicate paths, lookup errors. Touches only `src/modules/organiser/venue/**`.
