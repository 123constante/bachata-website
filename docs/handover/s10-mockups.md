# S10 mini-mockup: the "DJ" label next to a name that already starts with "DJ" (prototype, no PR)

Branch `claude/s10-mockups` (from `claude/s9-mockups`). Route `/__mock/s10/:place/:variant` (place = organiser | dancers | search, variant = A | B), only when `DEV || VITE_MOCKS=true`. Code: `src/modules/person-page/mockups/S10Mock.tsx`, plus 2 lines in `AnimatedRoutes.tsx` and `export` added to six helpers in `S9Mock.tsx`. No live page changed.
Screenshots: `docs/mockups/s10/{organiser,dancers,search}-{A,B}.png`, 390x844 viewport, cropped to the mock, PRODUCTION build (`VITE_MOCKS=true`) against the prod project, read-only reads with the public anon key.

## Variants
- **A**: the small "DJ" label is always shown (S9 behaviour).
- **B**: the label is dropped when the shown name starts with "DJ" (`/^\s*dj\b/i`: "DJ El Rugido", "Dj Lobo", "DJ Carlos De La Cruz"). Names like "Djibril" do not match (word boundary).
- Places: (1) organiser `unidos-flow` team strip: B drops "DJ" under "DJ El Rugido" (his "Teacher" label stays), Gabriel Bravo keeps "DJ"; (2) /dancers crop of dancers who also DJ: 3 DJ-prefixed names (DJ Tony Spark, Dj O, Dj Lobo) + 3 plain names; (3) search card for "DJ Carlos De La Cruz" beside "Boadicea Richards" (plain). Note B leaves the DJ-prefixed search card with no chip at all (his only role is DJ).
- Owner decisions kept: stage name leads on DJ things (dancer tiles use the DJ stage name for people who DJ); no teacher link anywhere (organiser strip drops any `/teachers/` href; "Teacher"/"Teaches" are plain text). DJs-with-upcoming-gigs-first / "Playing soon" is not part of these three places and is not drawn here.

## Count (prod, read-only, counts only)
**7 of the 40** DJs from `list_public_djs_v1` have a shown name starting with "DJ" (shown name = `display_name`, else `dj_name`, else first + surname, the order `resolvePublicName` uses). The in-app resolver agreed (7/40). Of the 35 people with both dancing and DJ roles, 4 are DJ-prefixed (dancers crop header says "4 of 35").

## Not verified
No real phone, no screen reader or keyboard pass, no tests/lint/CI (prototype), no PR. r2.dev photos are blocked here, so every photo is the initials fallback (search cards show a placeholder); real photos could change the visual weight. The 35-person count uses the DJ stage name for the prefix test; the live /dancers tile may show the real name instead. Only one organiser was drawn. The preview server answers 404 status for the client-only mock route but the page renders.
