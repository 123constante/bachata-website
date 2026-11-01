# S10 face wall round 2 (prototype, no PR)

Branch `claude/s9-facewall`. Route `/__mock/s10/:view` (`wall | side | page | sheet | photo`), query `?base=cream|dark`, sheet `?id=<person id>`.
Dev or `VITE_MOCKS=true` only. Code: `src/modules/person-page/mockups/S10Wall.tsx`, one lazy route line in `AnimatedRoutes.tsx`, and `export` added to
helpers in `S9FaceWall.tsx` (no behaviour change). No production page changed. Screenshots (production `npm run build`, VITE_MOCKS=true, real prod reads):
`docs/mockups/s10-wall/` 01-wall-cream, 02-wall-dark, 03-side-by-side (A cream / B dark), 04/05-full-page (real site header + footer, one frame per base),
06/07-sheet, 08-photo-layout-proof, `contrast.json`, `shot.mjs` (the capture + measurement script).

## What changed vs S9
- FOUR columns, tile 86.4px. Two bases from one component: A warm cream `#FFF4E6`, B warm brown-black `#1E1410`. Role accents kept (DJ gold, Dance teal, Teach violet, Organiser burnt orange); on dark the chips use lighter fills with dark text so they read as the same roles.
- Weak edges fixed: every role chip now has a 1.5px border. Chip edge vs page (best of fill/border), measured from the rendered DOM: cream 5.5 (DJ, was 1.68) / 8.3 teal / 10.1 violet; dark 12.9 DJ / 13.5 teal / 11.7 violet (violet fill alone was 2.54 on dark, now 7.9 fill). Chip text on chip >= 5.47 everywhere. Name on page 13.6 cream / 15.5 dark.
- Date chip ("Thu 22") is now a dark pill with gold text and gold border (12.9 text; 12.7 vs the cream-base gold tile, border 5.7 vs the dark-base tile). In S9 gold-on-gold was weak.
- Tiles get a 1.5px accent edge so faceless tiles hold their shape on both bases.
- Failed photo falls back to initials (S9 behaviour kept; found a broken-image icon during this round and fixed it).

## Measured (390 wide)
No horizontal scroll on any frame (scrollWidth 390; the two 840px side-by-side frames are 840 by design), no page errors, 0 names clipped, 16 tiles.
Note: in `contrast.json` the two side-by-side frames (03, 08) report an `edgeVsPage` of 1.71 because their "page" is the grey label canvas, not a base; use the 01/02 frames for the base numbers.

## Gap 1: "next event" for dancers and teachers
No list-level read exists. `list_public_djs_v1` has `next_gig_date` (DJ only); `get_public_teachers_list_v1` has no date; `/dancers` is a plain `dancer_profiles` select.
The per-person read `get_profile_event_timeline_v2(p_person_type, p_person_id)` (behind `useProfileProgramAppearances`) accepts any type, so a tile date for every role would cost ONE RPC PER TILE (16 for this wall, ~164 for the full dancers list), no batching.
Read-only probe on prod for 8 of the wall people: `dj` type returns upcoming events for 2 (Roger, Bisket); `teacher` type for the same 2 plus 1 past-only; `dancer` type returned 0 for all 8 (dancer rows are not linked to programme slots). So a dancer date chip would be empty for everyone; teacher date is possible but per tile.
Decision kept: wall date chip stays DJ-only. The person SHEET (one call, on open) uses the lead role's type, so a teacher-led person gets a teacher "next event" button; a dancer-led person gets none (button hidden, nothing shown instead).
Not added to production. A batched read (e.g. `next_event_date` on a people list RPC) would be the right fix if the owner wants the chip on all roles.

## Recommendation: B (warm dark), with one caveat
- Fit: the real site header (black with gold rule), the DJ page (black/gold) and the orange footer all sit directly against the wall. Dark makes header -> wall -> footer one continuous surface (frames 05 vs 04); cream makes a bright slab between two dark/orange bands.
- Contrast: B is higher on every measured pair (chips 11.7-13.5 vs 5.5-10.1; names 15.5 vs 13.6). A passes everything now too, so legibility is not the deciding factor.
- Faces: on dark the role-coloured initial tiles read as deliberate, deep colour blocks. On cream the faceless tiles look pale and washed.
- Caveat: real photos are NOT verified on either base (below). Bright photos on cream can look busier; on dark they pop. A is the safer call only if the owner wants the wall to feel like a different "page" from the DJ page.

## NOT verified
- PHOTOS: `media.bachatacalendar.co.uk` unreachable (403) from this sandbox. No faces were invented. Frame 08 shows neutral grey "PHOTO" blocks at the real square crop with the flag sticker over the top-right corner, date chip bottom-left and chip row under: it proves the layout over an image, NOT how real photos crop or whether the flag and date chip stay readable on busy photos.
- Real phone; chip legibility at 10px on a physical screen. Teacher role shown only for the same 4 hand-picked verified teachers as S9. 16 hand-picked real people, not the full list.
- No unit tests, lint or CI run (prototype, no PR); `npm run build` with VITE_MOCKS=true passes. Sandbox DB reads SELECT-only; the prod anon key came from the Supabase connector and is not committed. NOTE: the sandbox env's own `VITE_SUPABASE_URL` points at a different project than prod, so the build was run with the prod URL/key overridden.
