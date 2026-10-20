# S12 mockups: role backgrounds + design-review fixes on the S11 final screens (prototype, no PR)

**PHOTOS: not retried in this run beyond the S11 finding (r2.dev and the `_vercel/image` proxy both blocked from this sandbox in S11). Every photo is the initials fallback. No photo was invented.**

Branch `claude/s12-mockups` (from `claude/s11-final-mockups`). Route `/__mock/s12/:view/:fixture?` (dancer | dj | teacheronly | dancers | djs | organiser | lineup | search), only when `DEV || VITE_MOCKS=true`. Code: `src/modules/person-page/mockups/S12Mock.tsx` (a copy of S11Mock with the changes below), 2 lines in `AnimatedRoutes.tsx`. No live page changed. All S11 decisions kept. Shots `docs/mockups/s12/<screen>-final.png`, 390x844 full page, PRODUCTION build (`VITE_MOCKS=true`, prod project, public anon key on the command line, read-only reads).

## Per screen: what changed vs S11 (fix number)
- **dancer-roger / dancer-songs / dancer-javier**: ground is the deep teal `#06191F` full bleed, no purple, no floating icons [1]; empty band above the footer gone (ground extends under the footer's 54px top margin) [1]. Also bar = one row of 44px chips aligned to the card edges; DJ chip filled gold with arrow, "Teacher" plain outlined, same height, not italic, not faded [2]. Nouns "DJ"/"Teacher" [3]. Songs sit INSIDE the card, styled like Achievements, above "Dance bachata too?" (passed through the live card's own `ownerPlans` slot) [4]. "No public contacts yet" line hidden (`extrasOk=false`; contacts that exist still render) [4]. Facts row: "0 years / Newcomer" hidden for Chi-Wei [4].
- **Chi-Wei, null vs answer**: stored `dance_started_year` = 2026, NOT null (row created today 2026-10-20), so 0 years. A value equal to this year cannot be told from a default, so the mock hides the facts unless years > 0. Owner call: if a real "this year" answer is possible, the editor should store null until answered. Javier: no value stored (null), facts hidden (as before).
- **dj-roger / dj-oreo**: near-black ground `#0A080B` full bleed, no floating icons, no band [1]. Also bar: "Dancer" chip filled teal with arrow (links to the dancer mock), "Teacher" plain [2, 3]. Back + Share in one 44px header row at the top of the card, gold; no floating Share [5]. (The DJ chip with stage name, "DJ · Oreo Sensual", shows on the dancer page of a person whose stage name differs; Oreo's own dancer page was not re-shot.)
- **teacheronly**: search row and lineup chip use the new row/chip, label "Teacher" [3, 6, 8]. Still no page for him.
- **dancers-list**: 3 columns (114px tiles at 390px), names wrap whole (0 names overflow, measured), role labels on a fixed 26px row pinned to the tile bottom [7]; labels "DJ"/"Teacher" [3]. Keeps the purple wash and floating icons (screenshot is full-page: the live wash is `fixed`, so it only paints the first viewport; this is the live behaviour).
- **djs-list**: near-black full-bleed ground, no rounded box, no floating icons [1]; "DJ" gold label 12px; "Playing soon" 11px.
- **organiser**: labels "DJ"/"Teacher" 12px; names 14px [3, 8]. NOT a composite this time: only the strip (S11 swapped it into the real page). 
- **lineup**: reproduced the chip inside the mock (the live `PersonChip` prints the role at 9px and cannot be changed here); role at 12px, name 13px [8]. Both chips still link to the DJ page.
- **search**: one full-width row per person, 48px initials circle (never a grey box), tags Dancer / "DJ · Oreo Sensual" / Teacher [3, 6].

## Measured (production build, 390x844)
- Also-bar chips: 44px high (both chips, dancer and DJ pages). Share button 44px. DJ Back/Share row 44px.
- Role labels: 12px computed on organiser, lineup, search, lists, teacheronly.
- Contrast (WCAG): gold `#E7BE6E` on `#120c14` 11.0:1; on page `#0A080B` 11.4:1; cream `#F6F1EA` on `#120c14` 17.2:1; chip ink on teal fill 11.4:1; ink on gold fill 11.0:1. Lineup role text uses the theme `foreground` on `card` (not measured numerically).

## Not applied / differences
- Pages other than role pages and /djs (search, organiser, lineup, /dancers, teacheronly) keep the shared purple wash and floating icons, per the brief; their black band above the footer remains (live layout).
- Fix 4 (facts, contacts line, songs) is reproduced by wrapping the live `PublicDancerPageV2` with a filtered model and its own props; a real fix would change the component.

## NOT verified
No real phone, no screen reader/keyboard pass, no tests/lint/CI (prototype), no PR, no photos. djs-list, lineup, teacheronly and dancer-javier PNGs were produced but not eyeballed individually (numbers only). Links were read from the DOM, not clicked. `tsc` reports no errors in S12Mock.tsx.
