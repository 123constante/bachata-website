# W2-A hero mockups (prototype only, no PR)

Branch `claude/w2a-hero-mock`, from `claude/w2a-wall` (PR #924). Nothing in production changed.
Mock route `/__mock/w2a-hero/:view` (`d1 d2 d3 j1 j2`), only when `VITE_MOCKS=true`:
one new file `src/modules/person-page/mockups/W2aHeroMock.tsx` + 2 lines in `AnimatedRoutes.tsx`.
Screenshots: `docs/mockups/w2a-hero/` (`node docs/mockups/w2a-hero/shot.mjs <base>` regenerates them + `contrast.json`).
Data: **fixtures** (28 dancers, 20 DJs, drawn silhouette photos, 4 with initials), not live reads.

## The options, in plain words (390x844)

| Frame | What it is | firstTileTop | Screens down |
|---|---|---|---|
| d1-slim | Small dancer emoji + "Meet **Dancers**" (white + orange), the two cards side by side, one short row each (icon + label), then filter chips and the wall | **265 px** | 0.31 (first row visible without scrolling; 4 rows visible) |
| d2-today | Today's hero unchanged (big emoji, big title, faint stars/hearts, THREE cards: Practice Partners, Create a Profile, Book a Photoshoot), then the wall | **600 px** | 0.71 (first face row is cut off at the bottom of screen one; see `d2-today-scrolled.png`) |
| d3-slim-join | d1 plus the existing "Join the wall" / "Book a photoshoot" row under the wall | **265 px** | 0.31 |
| j1-today | Today's /djs hero (headphones emoji, "Bachata **DJs**", subtitle) over a simple grid | n/a (no wall) | n/a |
| j2-new | The wall branch's short DJ header (`DjsWall`, as it is on the branch) | **219 px** | 0.26 |

Today's hero has three cards, not two; D2 keeps all three because it is "exactly today". D1/D3 keep the two the owner named.

## Create a Profile target
The hero card uses `/auth?mode=signup&userType=dancer` (`HOME_ANNOUNCE_HREF`, same as the Join row). Today's hero card
points at `/create-dancers-profile`, which is **unrouted**, so today's card goes nowhere useful: flag for a fix whichever option wins.
In D2 the mock card also uses the real route (a click-through works); the production JSX still has the dead one.
Practice Partners uses `/practice-partners` (real; production uses the city-aware path).

## Owner look-at list
1. d1 vs d2: do you miss the big emoji and the faint line art? (d1 keeps the emoji, drops the line art.)
2. d1 card labels: "Find Practice Partners" wraps to two lines at 390; "Practice Partners" would fit one line.
3. d1/d3 title: the wall's own line "Meet the dancers behind the nights" + "Tap a face..." is hidden by CSS in the mock so "Meet" is not said twice. A real version would drop it via a prop on `PeopleWall` (not done here: no production change).
4. d3: is the Join row enough, or should "Create a Profile" stay in the hero too?
5. j1 vs j2: the DJs page has no cards, so j2 is just the short header.

## Checks run
- `VITE_MOCKS=true npm run build` passes; plain `npm run build` passes (route absent without the flag).
- `tests/catchallClientPaths.test.ts` passes (route is written `path={"..."}` so it is not counted as a real route).
- No sideways scroll: scrollWidth 390 on all five frames. Contrast (text made transparent, background sampled behind each text, foreground = computed colour): no text under 4.5 in any frame (`contrast.json`). No page errors.
- eslint on the mock file: 1 warning (bare `<img>` in the J1 grid), 0 errors.

## NOT verified
- Real photos and real face crops (silhouettes only; the media host is unreachable from the sandbox).
- A real phone. Chromium at 390x844 only; the `html` 13.5px phone font-size trap is not reproduced.
- Real list data / prod shapes (fixtures; no Supabase read was made). The survey in the CLAUDE.md definition of done is NOT done: this is a look-at prototype, not "ready".
- j1 is today's hero props over fixtures, not a screenshot of the live /djs (needs prod data).
- Contrast of the hero's faint line-art icons and gradient glows (decorative, not text) is not measured.
- Dev server run only; no Vercel preview checked, no PR opened (none asked for).
