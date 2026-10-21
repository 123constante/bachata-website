# W2-A hero v2 mockups (prototype only, no PR)

Branch `claude/w2a-hero2-mock`, from `claude/w2a-hero-mock`. Nothing in production changed.
Mock route `/__mock/w2a-hero/:view` with new views `h1 h2 h3 dj1` (only when `VITE_MOCKS=true`), added to the SAME file
`src/modules/person-page/mockups/W2aHeroMock.tsx` (no router change; the `:view` route already covers them).
Screenshots + `contrast.json`: `docs/mockups/w2a-hero2/` (`node docs/mockups/w2a-hero2/shot.mjs <base>` regenerates them).
Data: **fixtures** (28 dancers, 20 DJs, 6 organisers, drawn silhouettes), not live reads.

## Page order (all four frames)
1. The HERO, exactly today's (big emoji, big "Meet **Dancers**", faint line art). Not slimmed. Today's three old hero cards are dropped because the CTA section replaces them.
2. A CALL-TO-ACTION section: cards in role colours (Dancer teal, DJ gold, Teacher violet, Organiser burnt orange) on the warm dark #1E1410 base, each with an icon, a verb label and a one-line plain subline.
3. Filter pills (All, Dancers, DJs, Teachers, Organisers), then the 4-column face wall.

## The options, in plain words (390x844)

| Frame | What it is | First CTA top | firstTileTop | Screens down | Pill row |
|---|---|---|---|---|---|
| h1 | Four cards in a 2x2 grid under the hero. Biggest, easiest to read, uses the most height. | 307 px | 713 px | 0.84 | top 616, fully on screen one (no scroll) |
| h2 | One row of cards you swipe sideways (~200px each, the next card peeks). Saves height; the Teachers and Organisers cards are hidden until you swipe. | 307 px | 567 px | 0.67 | top 470, on screen one (no scroll) |
| h3 | ONE big Dancers card with both buttons, plus a small "Also: DJs · Teachers · Organisers" link row. Least height, but other roles are only text links. | 282 px | 578 px | 0.69 | top 481, on screen one (no scroll) |
| dj1 | The /djs page done like h1: today's DJs hero (headphones, "Bachata DJs", subtitle) on top, same 2x2 cards, pills, wall of DJs. | 350 px | 756 px | 0.90 | top 659, on screen one (no scroll) |

"Scrolled" views: `h1-scrolled.png` etc. (one viewport down). In every frame the pill row is already fully on the first screen, so no scroll is needed to reach it; faces start low (first row at 0.67 to 0.90 of a screen), as accepted.
The pill row wraps to two lines at 390 (5 pills), height 87 px.

## Real vs mock targets

| CTA | Target | Status |
|---|---|---|
| Dancers: Find Practice Partners | `/practice-partners` | real route |
| Dancers: Create a Profile | `/auth?mode=signup&userType=dancer` | real (`HOME_ANNOUNCE_HREF`) |
| DJs: Join as a DJ | `/auth?mode=signup&userType=dj` | real (Auth's role list has `dj`) |
| Teachers: Teach with us | `/auth?mode=signup&userType=teacher` | route is real, but **teacher pages are CLOSED on prod**: a teacher can sign up and not appear anywhere. Owner decision needed. |
| Organisers: List your event | `/auth?mode=signup&userType=organiser&returnTo=/account/o` | real (the organiser launch link in `accountRouting.ts`) |
| h3 "Also" row | the same sign-up links as above (not the /djs, /teachers, /organisers pages) | as above |

Nothing is labelled "mock: not live": every target exists. Copy ("Join as a DJ", "Teach with us", "List your event", sublines) is mine, not agreed.
**Organisers pill = MOCK.** Organisers are not on the real wall list; the 6 organiser tiles are fixtures (no link, burnt-orange accent from `tokens.ts`), cast past the type (`lead`/`role` is `PersonRole`, which has no organiser). Real data would need an organiser feed and a type change.
The pills and wall in these frames are the mock's own (the real `PeopleWall` has no Organisers pill); real tiles (`WallTile`) and models are reused.

## Owner look-at list (3)
1. h1 vs h2: do you want all four roles visible at once (h1, taller) or a swipe row (h2, shorter, two roles hidden)?
2. h3: is a text link row enough for DJs/Teachers/Organisers, or do those roles deserve cards?
3. Teachers card: should it show while teacher pages are closed? And is the Organisers pill wanted before there is organiser data?

## Checks run
- `VITE_MOCKS=true npm run build` passes. `tests/catchallClientPaths.test.ts` passes (3/3).
- No sideways scroll (scrollWidth 390 on all four, incl. the swipe row). No page errors. Contrast (same method as v1, text sampled against the rendered background): no text under 4.5 in any frame (`contrast.json`).
- eslint on the mock file: 1 warning (bare `<img>`, the old J1 grid, pre-existing), 0 errors.

## NOT verified
- Real photos / face crops (silhouettes only). A real phone (Chromium 390x844 only; the 13.5px `html` font-size trap is not reproduced).
- Real list data and prod shapes (fixtures; no Supabase read was made); the CLAUDE.md real-data definition of done is NOT done: this is a look-at prototype, not "ready".
- Swipe snap feel on touch (only checked layout and the peek). Decorative hero art contrast not measured. No Vercel preview checked, no PR opened.
