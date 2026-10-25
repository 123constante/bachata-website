# Walk SW1 (390x844, production build, route-mocked fake)

Production build (`VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build`) served by
`node scripts/_serve-build.mjs --port 4173`; Playwright (`tests/e2e/walk-sw1.spec.ts`, not in the
gate list) drove it against the `tests/e2e/helpers/organiserFake.ts` fake with PROD-SHAPED programmes
(a weekly with 2 classes + a party and 3 people, a festival day tree, 2 linked organisers, 2 dates that differ).
Shots 01-05 are the SHIPPED build (AW1 gate off). Shots 03-gate-on, 05-gate-on and 06-08 come from a
throwaway build with `AW1_APPLIED = true` (reverted; the committed value is `false`).
The shell scrolls an inner container: `NN-name.png` is the top, `NN-name-b.png` the bottom.

- 01-details-rows -- Details: Programme "3 sessions", Cast "Ana Torres (Teacher), ...", Organisers "2 organisers".
- 02-music-chips -- ?edit=music: the vocabulary as chips, Bachata selected, Save off "Nothing changed yet".
- 03-programme-weekly -- gate off: "Needs the next platform update", differs-on-2-dates badge with date links, Classes and Party, up/down/remove off, Save off.
- 03-programme-weekly-gate-on -- gate on: the same screen with live controls.
- 04-programme-festival -- festival day tree read only (DAY 1, DAY 2) with "Festival days are edited with the platform team for now."
- 05-organisers(-gate-on) -- linked pages; gate off: Link a page / Remove off with the reason.
- 06-session-sheet -- session sheet: type, name, times + length, level chips (B IM IN AD OL), line-up with role and level per person.
- 07-lineup-search-recent -- line-up search: RECENT first, then the name search.
- 08-delete-confirm -- in-page "Remove ... from every date?" confirm.
