# W1 S2: dancer and DJ role pages, the Also bar, Favourite songs (handover)

**PHOTOS: not retried here (S11/S12 found r2.dev and `_vercel/image` blocked from this sandbox); every portrait in the shots is the initials fallback.**

Branch `claude/w1-s2-rolepages` (from `origin/claude/w1-base`). No PR (sub-branch). Status: DONE except the items under "Left / for the orchestrator".

## Done
- `AlsoRoles.tsx` is now the Also bar: `AlsoBar` (pure) + `AlsoRoles` (reads `usePeopleBadges([id])`, `flags.teacherDetail`). Chips come ONLY from `roleTagsFor(badge,{teacherPagesOpen,withStageName:true,exclude:current})`. One row, 44px min height; linked chips filled in the target page's colour (DJ gold, Dancer teal) with an arrow; Teacher while the flag is off is a plain outlined span, same height. No bar when no other role, nothing in an embedded tab, nothing until the badge read answers (no empty box). Replaces the "Also: DJ" row.
- `/dancers/:id` (v2 branch): `gradientPalette="dancer"`; bar at top; Favourite songs inside the card (after Achievements, before ownerPlans/"Dance bachata too?"), hidden when none; `model.facts` years/level only when years > 0 (null and this-year both hidden); "No public contacts yet" line removed (contacts that exist still render); `showRoleLabel` prop: DANCER label hidden when the badge is loaded and lacks the Dancer role (unknown/SSR keeps it).
- `/djs/:id`: `gradientPalette="dj"`, `showSubheader={false}`; Back + gold Share in one 44px row (`data-testid=dj-head`) at the top; no floating Share; bar with `exclude:'dj'`; Book box: a `website` that is really an Instagram link is moved to the Instagram contact (`src/components/dj/djContacts.ts`), so no bare "www.instagram.com".
- `/teachers/:id`: only uses the bar (`exclude 'teacher'`), unreachable while the flag is off.

## Left / for the orchestrator
- **DJ hero vinyl label text still clipped** (`DjHero` in `src/components/dj/DjTiles.tsx`, S1-owned, not touched). Visible in `docs/mockups/w1-s2/dj-*-after.png` ("Oreo Sens..." cut by the spinning disc). Needs the initials text `fontSize:17, letterSpacing .12em` inside the `inset:32%` circle fixed (shrink/ellipsis or larger inset) by whoever owns DjTiles.
- The Book box label for Instagram is "Instagram" (DjTiles prints no handle); a handle label would also be a DjTiles change.
- Chi-Wei: stored `dance_started_year` = 2026 (this year) is treated as unanswered. Owner call from S12 stands: editor should store null until answered.
- Oreo Sensual's dancer row is the person "Bisket" (id 04ca2889...); `/djs/bisket` leads with the stage name "Oreo Sensual", `/dancers/bisket` shows chip "DJ · Oreo Sensual". The id I first guessed for Oreo (a97597d0...) 404s (not public).
- `badges.ts`, `GlobalLayout.tsx`, `pageGrounds.ts` untouched; no change needed there.

## Tests (commands + results)
- New `src/modules/person-page/__tests__/alsoBar.test.tsx`: 8 S0 shapes x 3 pages x teacher flag off/on (labels, hrefs equal `roleTagsFor`; no `/teachers/` href while off; 44px; no italic/opacity), stage-name chip, no-badge = empty DOM, palette/Share source checks, `splitInstagramWebsite` table.
- Updated: `embedded.test.tsx`, `alsoRolesBox.test.tsx` (mock `usePeopleBadges`), `page.test.tsx` (songs inside card and ordered, contacts line gone, no facts without start year), `model.test.ts` (start year null/2026/2025/2015).
- RED on the unfixed code: with the 5 source files stashed, `npx vitest run alsoBar.test.tsx public-page embedded.test.tsx` fails (AlsoBar not exported, "Element type is invalid"); GREEN after: `npx vitest run src/modules/person-page src/modules/dancer-app/public-page` = 0 failures (457 tests). Prod-data before/after below shows the same: old build Chi-Wei facts `0 years / Newcomer`, `dancer-connect-empty` present, no chips; new build none of those.

## Prod build, real people (read-only anon key; served with the react-router server build via a small node script, not a SPA fallback; every shot's `location.pathname` and h1 were asserted)
`docs/mockups/w1-s2/<name>-before.png` (origin of this branch) and `-after.png`, 390x844 full page: dancer-roger, dj-roger, dancer-bisket, dj-bisket, dancer-javier, dancer-chiwei, dancer-songs (Ricky: the prod person with songs; 3 songs, F13 change shown). Measured on both 390x844 and 360x640 (after): no horizontal scroll on any page; every Also chip 44px high, 14px text; `elementFromPoint` at each chip centre hits the chip (all true); DJ Back/Share row 44px; body background dancer `rgb(6,25,31)` (#06191F), DJ `rgb(10,8,11)` (#0A080B); Javier (thin): no chips, no contacts line, no songs; Chi-Wei: facts show STYLE only, songs block present. Contrast not re-measured (colours identical to S12's measured chips: ink on gold 11.0:1, ink on teal 11.4:1).

## Gates
| job | command | result |
|---|---|---|
| unit, touched | vitest run person-page + public-page | exit 0, 0 failed |
| unit, all | npx vitest run | 16 failed / 10299 passed: eventViewCompat, occurrenceProgram, publicEventPageLineup contracts (live DB), integrityCouldNotRun (env), ogBrandedCardLayout (env). None touch these files; same families as S0's baseline |
| lint chain | npm run lint | 19 of 20 links PASS; check:integrity exit 126 (sandbox env), eslint link skipped by the chain because of it |
| eslint (changed) | npx eslint on touched dirs | remaining errors are pre-existing `any` / set-state-in-effect lines in DancerProfile/DJProfile, none on my lines |
| typecheck | tsc --noEmit -p tsconfig.app.json | 114 errors, same as main/S0 baseline; none in touched files |
| build | npm run build (prod env vars) | 0 |
NOT RUN: GitHub Actions (no PR), Docker/local Supabase, real phone, screen reader, `pre-ship`, review stamp, e2e specs (no new e2e; DOM check done in the Playwright run above).

## Phone QA
Viewports 390x844 and 360x640, numbers above. Not verified: photos, real device, keyboard/screen reader, dark-on-gold contrast beyond S12's numbers.
