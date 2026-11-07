# S12 person HUB + role pages (prototype, no PR)

Branch `claude/s12-hub` (from `claude/s11-person`). Route `/__mock/s12/:view`, dev or `VITE_MOCKS=true` only.
Code: ONE new file `src/modules/person-page/mockups/S12Hub.tsx` + 2 lines in `AnimatedRoutes.tsx` (import + route). S9/S10/S11 files untouched (tokens imported from S11Person, data helpers from MockPersonPage). No production component or route changed.
Views: `hub-{roger,gatica,pierre}`, `role-{person}-{dj|dancer|teacher|organiser}`, `flow-{roger,gatica}`.
Images in `docs/mockups/s12-hub/` (390 wide @2x, real prod reads SELECT-only, prod project): hub-roger, hub-gatica, hub-pierre, role-roger-dj, role-roger-dancer*, role-roger-organiser, role-gatica-dancer, role-gatica-teacher, flow-roger, flow-gatica, contrast.json.
(*role-roger-dancer: Roger's dancer row is thin, so the live teal card shows little.)

## What was built
- HUB: back to wall, face (photo block / initials tile) with nationality flag, name (stage name leads when the lead role is DJ and one exists), city, quiet facts strip (years dancing, level, languages; hidden when none), "Go to their next event" button when a gig exists, then big role cards in lead order (DJ with upcoming gigs first, else dancer). Each card has the role accent edge, "mock: not live" on teacher/organiser. Pierre: one card, still looks intentional (initials tile, one teacher card).
- ROLE pages: top bar "<name>'s page" back to hub + role chip; bottom "Also:" chips to the person's other roles.
## How each role page differs from the live page
- DJ: the live DjTiles (near-black, gold vinyl hero, contact, listen, genres, played-at) on the warm-dark page base instead of full near-black; the **Upcoming gigs tile is moved to the top** (live page has it after the hero). Nothing else changed.
- Dancer: the live `PublicDancerPageV2` teal ID card unchanged inside the warm-dark page; its own Back link is hidden (hub bar replaces it).
- Teacher (MOCK, violet): own layout, only facts that exist, labelled "mock: not live". Real TeacherProfile not used (closed on prod, empty reads).
- Organiser (MOCK, burnt orange): own layout with the sample organiser name (fixture), labelled mock.
- Contrast: text >= 5.47 (need 4.5), edges >= 6.58 (need 3); no horizontal scroll (390/390 on all single frames). Embedded live teal/DJ tiles keep their own colours (not re-measured).

## Owner should look at
1. Hub: do the big role cards (with "happening now" on the lead one) make it clear where to tap and what the person does?
2. Do the role pages feel like different worlds (gold DJ, teal dancer, violet teacher, orange organiser) while still one family on the warm-dark base?
3. Pierre (one card) and Gatica (no facts strip): is a hub with so little OK, or should the hub add a line?

## Not verified
- PHOTOS: media.bachatacalendar.co.uk is 403 here, so labelled PHOTO blocks show instead of faces; real crops untested. The DJ vinyl hero shows the name over an empty record for the same reason.
- Teacher and organiser are MOCKS: teacher role and Leads "Sample Bachata Nights" are hand-set fixtures; teaching years/classes do not exist in the data.
- Wall tile in the flow sheets is a drawn stand-in (neutral blanks), not the real S10 wall; the hub back link points to the S9 wall mock.
- Fixtures vs prod reads: person/DJ/dancer data are real prod reads; roles list is derived (get_public_person_roles_v1 plus the hand-set ones). `get_public_person_roles_v1` is missing on the project in this sandbox's default env (404); screenshots used the prod project URL/anon key via env, not committed.
- Not run: tests, lint, CI, real phone. `VITE_MOCKS=true npm run build` passes.
