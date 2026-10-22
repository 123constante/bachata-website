# Design record: W2-D person hub build (option C), Design Gate stages 3-4

Ticket dt_aee601072cb9. Brief: `brief/w2d-hub-build:briefs/W2D-hub-build-brief.md`. Mock and options: `docs/design/w2d-hub.md`
(branch `claude/w2d-hub-mock`). Behind `flags.personHub` (default OFF in code; ON on prod, so the live hub changes at merge + deploy).

## What was built
- **Layout C** (`src/modules/person-page/hub/PersonHub.tsx`, model `hub/model.ts`): Back; one hero card for the main role
  (face 128px, name, chips of every HELD role, one summary line, a 52px "Open <role> page" button, a hint that names what
  that page holds); an "Also" row with one card per other held role (2 columns for two, 1 for one); an About line (city
  and facts). Warm frame `WALL.page`, cards `WALL.card`, accent = `CHIP[lead]` (button) and `TILE[lead].edge` (hero edge).
- **Main role** = `leadRole` order (badges.ts): a DJ with an upcoming gig leads, else dancer, else DJ, else teacher.
- **Closed Teacher** = a dashed Also card, `aria-disabled`, not a link, "Teacher pages open soon".
- **ONE destination rule** `personDestination` (badges.ts): HELD roles (a closed Teacher counts) >= 2 = the hub; else the one
  role page (`linkFor`), else the list's own page (the dancer page every active dancer row has). Used by the wall tile
  (`wall/model.ts tileHref`), the `/people/:id` redirect (`hub/model.ts personPageRedirect`, thrown from the loader as a
  302, so Back never bounces through the hub) and, through the same held roles, the hub's chips and Also cards.
- **Fade into the footer**: the hub's last 96px is `WALL.page -> hsl(var(--primary))`; on the hub route only
  (`body:has([data-hub-footer-join])`, index.css) the footer's 64px top gap is painted the same gold and GlobalLayout's
  100vh min height is released so the fade sits at the bottom of the first screen. Every other route: unchanged.
- **Late gig list**: the loader fetches this person's badges row (`get_public_people_badges_v1`, key `['people-badges', [id]]`,
  the wall's key shape), so the lead role is known on first paint (SSR) and never swaps. The hero line keeps a reserved
  22px row; a DJ line reads "Checking for gigs..." until the list lands, "No gigs listed right now" if none or the read fails.
  With no badges row at all (its read failed) the lead painted first stays (a DJ with gigs then sits in Also, not the hero).
- **Bundled fix**: wall tile and hub face share `wall/usePhotoFallback.ts`: `onError` plus a one-off check after mount
  (`img.complete && naturalWidth === 0`) for an SSR'd `<img>` that failed before hydration attached `onError` (React props,
  no inline handler, CSP-safe). Failing test first: `wall/__tests__/photoFallback.test.tsx` was RED on main's WallTile.

## Data shapes (prod survey 2026-10-22, read-only counts; 166 active)
teacher-only 62, dancer + teacher 36, dancer + DJ + teacher 25 (11 with a gig), dancer-only 23 (my re-count without the brief's filter: 26),
dancer + DJ 10 (3 with a gig), DJ-only 4, DJ + teacher 1, no role 5. 16 more active rows with no role have NO badges row at
all (the badges RPC returns nothing for them): their tile keeps its own page, as today.

| Shape | Tile | /people/:id | Hub hero | Also |
|---|---|---|---|---|
| teacher only (closed) | /dancers/:id | 302 -> /dancers/:slug | - | - |
| dancer only | /dancers/:id | 302 -> /dancers/:slug | - | - |
| DJ only | /djs/:id | 302 -> /djs/:slug | - | - |
| no role | /dancers/:id | 302 -> /dancers/:slug | - | - |
| dancer + teacher | /people/:id | hub | Dancer | Teacher (closed) |
| dancer + DJ, gig / no gig | /people/:id | hub | DJ / Dancer | Dancer / DJ |
| dancer + DJ + teacher, gig / no gig | /people/:id | hub | DJ / Dancer | Dancer + Teacher / DJ + Teacher |
| DJ + teacher | /people/:id | hub | DJ | Teacher (closed) |

The table is `hub/__tests__/destinationMatrix.test.tsx` (RED on main: 29 failed / 13 passed; green after). Change from
today: with the flag ON a DJ-only person's tile on /dancers now opens their DJ page (their one role), not the dancer page.
"No role" people never reach the hub (they go to their dancer page, like their tile); if one did (older loader data), the hub
shows "No public page for this person yet. You can browse the dancers instead." with a 44px "Browse dancers" link.

## Measured (local dev on prod reads, Chromium, DPR 1; `docs/mockups/w2d-hub-build/walk.mjs`, numbers in `report.json`)
| Check | 360x844 | 390x844 | 430x844 | Rule |
|---|---|---|---|---|
| Lowest text contrast (6 hub shapes) | 6.41 | 6.41 | 6.41 | >= 4.5 |
| Where | DJ initials `#FFE3A0` on `#6B4A0E` (6.41); dancer initials 7.43; chip text 7.6-7.7 | | | |
| Text on a gradient | 0 | 0 | 0 | none |
| Smallest tap box | 44 (Back) | 44 | 44 | >= 44 |
| Clipped text | 0 | 0 | 0 | 0 |
| scrollWidth | 360 | 390 | 430 | = viewport |
| Seam step (x=4 column, hub top to 40px into the footer, max channel per CSS row) | 3 | 3 | 3 | < 6 (#924 gate) |
| First build (GlobalLayout's 100vh left a 106px plain band above the footer) | 225 | | | fixed by the index.css rule |

Redirects walked (real ids): dancer-only -> /dancers/:slug, DJ-only -> /djs/:slug, teacher-only -> /dancers/:slug,
no role -> /dancers/:slug; `history.length` 2 after landing (the hub is not in history).

## Screenshots (390x844, real prod-shaped data; all looked at for colour seams: none)
`docs/mockups/w2d-hub-build/`: `dancer-teacher.png`, `dancer-dj-gig.png`, `dancer-dj-nogig.png`, `dancer-dj-teacher-gig.png`
(+ `-full.png`, whole page into the footer), `dancer-dj-teacher-nogig.png`, `dj-teacher.png`, `wall-jxjx-fallback.png`.

## Not verified
- Real photos: the sandbox cannot reach the media host (proxy 403), so every face in the screenshots is the initials
  fallback; photo crops and the Jxjx dead URL itself were not seen in a browser (the fallback is unit-tested both ways).
- What the Jxjx URL actually returns (if it is a 200 image that SAYS "Page not found", no client check can see it).
- A real phone; the Vercel-built site (local dev only); desktop >= 1024px beyond the CSS rule.
