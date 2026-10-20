# W1 S3: organiser team strip, event lineup, search person row (handover)

Photos (r2.dev and the `_vercel/image` proxy) are BLOCKED in this sandbox: avatars never loaded, so every shot shows the initials fallback (that is also why a fallback `onError` was added to the search row and team strip). Branch `claude/w1-s3-strips` from `origin/claude/w1-base`. No PR.

## Done
- `OrganiserProfile.tsx` team strip (`TeamCircle`, exported): `usePeopleBadges` on the member ids; name 14px via `nameFor('dj'|'other')` (stage name where the member has the DJ role), pill tags 12px from `roleTagsFor(..., withStageName)`, link from `linkFor` (teacher-only = no link, plain block). Team `role` free text ("Founder") is no longer shown (tags replace it).
- `ScheduleBlock.tsx`: one `usePeopleBadges` over every person in the programme; `mapPersonFromBadges` (exported) sets href = `linkFor` and the DJ slot name = stage name. While badges load a DJ/dancer keeps the feed's own valid link and a teacher has none; after load a missing badge = no link. Vendors untouched. Before: `/teachers/<id>` link while the flag is off.
- `PersonChip.tsx`: role text 9px -> 12px, class-card (`xl`) name 9px -> 13px. (md name stays 14, lg 13.)
- `SearchResults.tsx`: `PersonRow` (exported): one full-width row, 48px initials circle fallback, tags from `roleTagsFor(withStageName)` (Teacher tag shows plain while teacher pages are off), link from `linkFor` (never `/people/:id`, which has no route). `visibleRoles`/`personSearchRow` kept (still used by `searchRpc.ts`, the overlay, personRoles).
- Tests: `src/modules/person-page/__tests__/w1S3Strips.test.tsx` (50: 8 prod shapes x flag off/on x 3 surfaces + load/missing cases). `tests/searchV7People.test.tsx` /search-page block rewritten to the new contract (34 pass). `scheduleLevelLabels` / `specialDateLabel` tests now wrap in a QueryClientProvider (ScheduleBlock now calls useQuery).

## RED then GREEN
`npx vitest run src/modules/person-page/__tests__/w1S3Strips.test.tsx` with src/pages + src/modules/event-page stashed (unfixed): RED (components not exported / old behaviour). With the change: 50 passed.

## Gates (local)
| job | command | result |
|---|---|---|
| unit all | `npx vitest run` | 15 failed / 10297 passed: same 4 files as S0's baseline (eventViewCompat, occurrenceProgram, publicEventPageLineup contracts = live DB; integrityCouldNotRun = env). None touch this change |
| lint chain | `npm run lint` | 19/20 links PASS; `check:integrity` exit 126 (`bin/check-integrity.sh` not executable here, identical on base); eslint link skipped by the chain. Direct eslint on changed files: 1 error at OrganiserProfile.tsx:515 (`setRgb` in an effect), pre-existing, not my lines |
| typecheck | `tsc --noEmit -p tsconfig.app.json` | exit 2, pre-existing errors only (base 114); none in changed lines |
| build | `npm run build` (prod env, flags on) | exit 0 |
| bundle budget | `npm run check:bundle-budget` | exit 0, all budgets respected (event: 43 chunks, allowance 43) |
Not run: GitHub Actions (no PR), Docker/local Supabase, real phone, `pre-ship`, review stamp.

## Phone QA (production build via `scripts/_serve-build.mjs`, prod project anon key, `VITE_ENABLE_ORGANISER_DETAIL=true`, `VITE_ENABLE_SEARCH_V7=true`; each shot checked to show its own page)
Shots in `docs/mockups/w1-s3-strips/` (`before-*` = w1-base, `after-*`, 390x844): Unidos Flow strip, Pura Nights Ealing lineup, search "Roger", "Oreo". (Before organiser/search shots show the old markup; the Roger/Oreo before shots are the old card grid.)
Measured at 390x844 and 360x640 (after): no horizontal scroll (scrollWidth == viewport) on all 4 pages; tag text 12px; team names 14px; search rows 362/333px wide (full width), 63px tall; lineup links 101px tall; `elementFromPoint` on every search/lineup link lands inside the link (true); zero `/teachers/` hrefs on any page (before: 1 on the lineup). Contrast (computed from the colours, not an instrument): gold `rgb(231,190,110)` on the near-black strip is about 10:1; search tags white 90% on the dark card about 14:1.
Real data: Unidos Flow team (Teacher/DJ/Dancer pills; links /djs/...); lineup Melita Somos: teacher chip and DJ chip both link /djs/<id> (DJ page wins, no stage name set); Roger Cracco (Teacher, DJ, Dancer -> /djs/), Rogue (Dancer); Oreo query returns two Teacher+Dancer people -> /dancers/. No teacher-only person appeared in these queries: that shape is covered by the table test only. Route flag: `/organisers/:id` needs `VITE_ENABLE_ORGANISER_DETAIL`, search rows need `VITE_ENABLE_SEARCH_V7` (off by default; with v7 off /search still shows the old Teachers/DJs/Dancers card sections, NOT changed here).

## Open points for the owner / frozen files
- `roleTagsFor` prints "DJ · DJ El Rugido" when the stage name already starts with "DJ" (S0 survey: 5 such names). Fix belongs in `badges.ts` (frozen): drop the prefix when djName starts with "DJ ".
- Header overlay (`HeaderSearch`/`searchRpc.mapPersonV7`) still sends person rows to `/people/:id` (no route) and uses `visibleRoles` (hides Teacher while off). Left as is: outside the named files' row; needs `href = linkFor(...)` and the roles line from the mapping. Flag-gated (v7).
- The first-load of `/event` now includes `badges.ts` + `searchEntities.ts` (budget still passes).
- Stage name leads on a DJ slot only when the person has `dj_name`; Melita has none, so shows the real name.
- Conflict with open PR #850 (`claude/search-v7-web`): both rewrite the people block of `SearchResults.tsx` (the `SectionGrid` of `ResultCard`s in the `showSection('people')` section, plus the import line from `searchEntities`). Taking this branch's block and re-applying #850's other changes is the resolution; `tests/searchV7People.test.tsx` conflicts the same way.

## Not verified
Teacher-only person on real search/lineup/strip data (not met in the sampled pages); teacher flag ON in the browser; photos (blocked); real phone; GitHub Actions.
