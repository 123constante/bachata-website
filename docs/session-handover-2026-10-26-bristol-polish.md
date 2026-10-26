# Session handover: Bristol polish (2026-10-26) -- PARTIAL

Branch `claude/bristol-polish` (from `main` 899f85e). Brief: `brief/bristol-polish` `docs/briefs/bristol-polish.md`.
Design record + walk pictures: `docs/design/bristol-polish.md`, `docs/design/bristol-polish/`.
PR: opened by `bot-pr.yml` on push (number not known at push time). Its body still needs the template
sections filled ("Verified on real data", "Phone QA"); see the drafts below.

## Done
- All six scope items are built (see the design record's table), with tests:
  `src/pages/__tests__/bristolPolish.matrix.test.tsx` (37 screen x shape cases; 12 fail on unfixed main, the Bristol ones),
  `src/lib/__tests__/bristolPolish.units.test.ts`, `src/pages/__tests__/venuesLondon.bytes.test.tsx` (London venues
  byte-identical vs a golden taken from main), `src/modules/home-map/__tests__/allEventsList.city.test.tsx`,
  `src/components/__tests__/listingRequestForm.variant.test.tsx`, `tests/searchEmptyCity.test.tsx`, plus a teacher-variant
  assertion in `teachersCity.matrix.test.tsx`.
- Browser walk at 390x844 on prod data (local dev server, anon key): 9 screens + the teacher form, 0 contrast
  violations, taps 44px, no sideways scroll (`docs/design/bristol-polish/walk.json`).
- pre-ship (first run): integrity, mojibake, legacy guards, architecture, script conventions, typecheck ratchet
  (95, unchanged from main), scoped eslint (held level), chunk cycles, build: PASS.

## Open (blocking "ready")
1. **Bundle budgets: FAIL.** Latest measure on this head:
   - home 210.2 KB (ok, budget 215), but the chunk ratchet is 38 vs an allowance of 37;
   - auth 313.7 KB vs 310, and 30 chunks vs 27;
   - dancer-app 374.4 KB vs 374, and 50 chunks vs 49.
   - /parties and /classes are back on their pin (44).

   Cause: pinning `src/lib/pageCity.ts` into `lib-event-rules` (vite.chunks.ts) pulls its dep `cityDisplayName.ts`
   along. And/or the lazy `ListingRequestForm` in `EmptyCityNote` split chunks differently.

   Next: diff the auth and home modulepreload lists against main (method in the vite.chunks.ts header). The likely
   fix is to un-pin pageCity and inline the ~10-line `resolvePageCity` into `cityDisplayName.ts`, which those routes
   already load, or to pin `cityDisplayName.ts` too. Then re-measure all routes.
2. `check:no-social-word` fails on `venuesLondon.bytes.test.tsx:27` (`next_event_name: 'Social'`). Rename it to
   'Friday Party', then regenerate the golden ON MAIN (copy the test into a main worktree, run with
   `UPDATE_VENUES_GOLDEN=1`, copy the html back). The golden currently contains "Social".
3. test:unit failures that are NOT this diff (they fail the same in the sandbox): `*.contract.test.ts` (no live-DB
   creds) and `tests/integrityCouldNotRun.test.ts`. `tests/client/festivalClientState.test.tsx` failed once in
   pre-ship and passed in the earlier full run: re-check it once on main.
4. test:e2e was skipped by pre-ship (it runs only after the repo checks pass).
5. PR body: fill in the template, including the per-job table and Verified / Not verified.
6. /code-review was not run (the owner types it).

## Draft for the PR body
- Shapes surveyed: prod read-only. Bristol (`bristol-gb`, inactive): 0 venues, 0 organisers, 0 people. Venue `city_name`
  counts: London 53, Budapest 1, Turku 1, Gammarth 1. `cities` has no lat/lng. `listing_request_section` enum has 5
  values, no event value. `search_public_v7` with `p_city_slug` NULL searches all cities.
- NOT verified: real `/city/bristol-gb/*` pages (404 until the owner activates Bristol); the calendar list and day modal
  (excluded files; mockup only); a real form submission (it would write).

## Owner decisions needed
See "Owner questions" in `docs/design/bristol-polish.md`:
- London's own off-city festivals;
- which inbox section empty-city tips file under;
- the global directories;
- the calendar mockup.
