# S9 Face Wall mockups (prototype, no PR)

Branch `claude/s9-facewall` (from `claude/s8-mockups`). Route `/__mock/s9/:view` (`wall4 | wall3 | compare | nophoto | sheet`),
query `?filter=all|djs|dancers|teachers`, `?theme=dark`, sheet `?id=<person id>`. Only when `DEV || VITE_MOCKS=true`.
Code: `src/modules/person-page/mockups/S9FaceWall.tsx` + 2 lines in `AnimatedRoutes.tsx`. No production component or route changed.
Screenshots (390x844 @2x, production `npm run build` with `VITE_MOCKS=true`): `docs/mockups/s9-facewall/`:
`01-wall-4col`, `01b-wall-4col-djs` (stage names lead), `02-wall-3col-compare` (4 vs 3 columns, labelled), `03-no-photo-states`,
`04-person-sheet`, `05a-dark-wall`, `05b-dark-sheet`, `05-contrast.json`, `05-measurements.json`.

## What was built
- Wall of 16 REAL people (list_public_djs_v1 + person reads): 4 columns, tile 86.4px wide. Square face (photo, else warm role-accent tile with large
  initials + soft pattern), name under the photo (stage name on the DJs filter, real first name elsewhere, 2 lines max, none clipped), coloured role chips
  (DJ gold, Dancer teal, Teacher violet, Organiser burnt orange; short labels DJ / Dance / Teach), gold date chip ("Fri 23") only with an upcoming gig,
  flag sticker top-right. Whole tile is one link. People with a next event sort first.
- Page top: one friendly line + filter chips (All, DJs, Dancers, Teachers, 36px high); no mood image. NOTE the site header (~105px) still sits above;
  two wall rows are above the fold at 390x844.
- Second frame: bottom sheet (face, stage name leading with real name under it, role badges, one plain line, ONE button "Go to their next event . Fri 23").
  Button is hidden when no upcoming event; I show nothing instead (no Follow exists).
- Fixtures cover: DJ with gigs (Roger), teacher+dancer (Gatica), 3-role (Bisket / Oreo Sensual), no photo (Bobby, Carlos, Pierre...), long names
  (DJ Carlos De La Cruz, Sobolewska), stage name ("DJ El Rugido" shows "El Rugido"; leading "DJ " is stripped).

## Measured (390 wide, from 05-measurements.json)
- Horizontal scroll: none (scrollWidth 390 on every frame). Page errors: none. Names clipped: 0 of all tiles.
- 4-col tile rects: 86.4 x 124 (one chip row) to 86.4 x 143 (chips wrap to two rows). 3-col: 116.5 x 154.
- Contrast (05-contrast.json): every TEXT pair >= 4.5 (name on page 13.6 light / 15.5 dark; chip text 5.5-8.1; initials on tile 7.1-8.0; muted 7.3/8.9).
  Non-text chip fill vs page: gold chip on cream is 1.68 and violet chip on dark is 2.54 (below 3); the label text inside is still legible, but the chip edge is weak there.

## Recommendation: 4 columns
Names stayed fully legible at 12px (all names, incl. "Papacito", "Sobolewska", fit on one line or wrap to two), so 4 columns costs nothing in legibility and shows ~33%
more faces per screen, which is the "big faces to browse" goal. Cost: chips for 3-role people wrap to a second row (tile height 143 vs 124) and the face is 86px
instead of 117px, so photos get less detail. Use 3 columns only if photos turn out too small on a real phone. Tap target: whole tile is one link (86x124+, above 44px anyway).

## Owner should look at
1. Role chip abbreviations (Dance/Teach) at 10px; is that enough to tell who is who?
2. Gold date chip: does "Fri 23" read as "next event"?
3. On "All" the real first name shows (Nico for El Rugido); on DJs the stage name. Confirm.

## Not verified / could not do
- PHOTOS: media.bachatacalendar.co.uk returns 403 from this sandbox, so EVERY face is the initials fallback; real photo cropping, the flag over a photo, and chip legibility on photos are NOT verified.
- "Next event" cue exists for DJs only (list_public_djs_v1 next_gig_date); dancers and teachers show none (no equivalent list read checked). Sheet button uses useProfileProgramAppearances('dj').
- Teacher chip shown only for 4 hand-picked verified teachers (teacher pages are closed on prod; the roles read lists teacher more widely). Organiser accent defined, not used on the wall.
- No real phone, no tests/lint/CI run (prototype, no PR). `npm run build` with VITE_MOCKS=true passes. Sandbox DB reads were SELECT-only; the prod URL and anon key came from the Supabase connector, not committed.
- Dark theme is a quick variant; flag sticker and chip contrast on dark only partially checked (see above).
