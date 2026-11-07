# S7 mockups: three arrangements of the combined person page (prototype, no PR)

Branch `claude/s7-mockups`, off main 157df51. Route `/__mock/person/:arrangement/:fixture`
(stamps|stacked|tabs x roger|gatica|threerole|djonly), only when `import.meta.env.DEV || VITE_MOCKS=true`.
Code: `src/modules/person-page/mockups/` (+ 3 lines in `src/components/AnimatedRoutes.tsx`).
Screenshots + `index.html`: `docs/mockups/search-v7/` (390x844 full page, production build).

## Reused vs new
- REUSED unchanged: `PublicDancerPageV2` (embedded) + `buildPublicDancerPage` / `mapDancerPublicProfile` (dancer body, flag, avatar); `DjTiles` (DjHero with vinyl portrait, contact, listen, genres, upcoming, played-at, gallery, text) + `djInkTheme` (dark/gold panel, not restyled); real `TeacherProfile` (embedded, `:id` supplied by a nested `<Routes>`); `loadPersonSnapshot`; `get_public_person_roles_v1`, `get_public_dancer_extras_v1`, `get_public_dj_v1`, `get_profile_event_timeline_v2` (read-only, prod).
- NEW (prototype only): the person card (teal colours COPIED from PublicDancerPageV2, which does not export them), role stamps / stacked headers / tab bar, lead-role rule (DJ with upcoming gigs, else dancing, else first), "Favourite songs" block (from `model.songs`; PublicDancerPageV2 does not draw it today).
- The DJ section is RE-COMPOSED from the same DjTiles in the same order as `DJProfile.tsx`, not `DJProfile` itself: `DJProfile` embedded drops the vinyl portrait and `GlobalLayout` would nest. If a mock DJ differs from `/djs/:id`, that is a bug in my copy.
- Dancer body: languages, contacts and Share are blanked/hidden in the body because the card shows them once. So the dancer body here is NOT identical to `/dancers/:id`.

## Fixture vs real, per line
- People: real prod rows (read-only): roger = Roger Cracco `005a7329-...`; gatica `017dee9f-...`; threerole `04ca2889-...` (Teaching + DJ + Dancing in the roles RPC); djonly `59150b2d-...` (DJ only).
- CORRECTION to the brief: prod says Gatica is Teacher + Dancer, NOT DJ (no `get_public_dj_v1` row, so `today-djs-gatica.png` is the "doesn't exist" page). Roger is Teacher + DJ + Dancer in the roles RPC; the teacher role is hidden for roger/gatica/djonly (teacher pages are closed on prod today) and shown only for threerole. Roles come from the roles RPC with that rule, not from `PersonPage`'s flag logic.
- "Leads: Sample Bachata Nights (sample)": FIXTURE (hard-coded in `fixtures.ts`), shown for roger and threerole only; the organiser RPC is not used.
- Everything else on screen is real data.

## Not done / not verified
- No real-phone test, no keyboard/screen-reader pass, no PR, no CI (prototype).
- No data-shape survey beyond picking the four people; dancer v2 flag was closed/open as prod served it, `extrasOk` forced false in the body.
- Ranges not covered: people with no photo (only fallback initials seen), long-name wrapping, a DJ with gallery over the cap.
- Teacher body in stacked/threerole draws the real teacher page (works; contact tiles look plain). Dancing body for threerole is nearly empty (real data is empty).
- The `/__mock` route is in the production bundle only because I built with `VITE_MOCKS=true`; never set it on a real deploy.
- Build env: the shell had other `VITE_SUPABASE_*` values (a different project); I built with the prod URL/anon key from the Supabase connector in an ignored `.env.local`.

## Verified
- `npm run build` ok (with VITE_MOCKS=true); served via a small node server using the React Router build; 12 mock + 8 "today" screenshots at 390x844, page width 390 (no horizontal scroll), `data-ready` true for all 12, no page errors.
## Commit
See the commit subject / `git log -1` on `claude/s7-mockups`.
