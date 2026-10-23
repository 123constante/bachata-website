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
  22px row (44px, two rows, when the DJ leads with a gig expected: step 2); a DJ line reads "Checking for gigs..." until the list lands, "No gigs listed right now" if none or the read fails.
  With no badges row at all (its read failed) the lead painted first stays (a DJ with gigs then sits in Also, not the hero).
- **Bundled fix**: wall tile and hub face share `wall/usePhotoFallback.ts`: `onError` plus a one-off check after mount
  (`img.complete && naturalWidth === 0`) for an SSR'd `<img>` that failed before hydration attached `onError` (React props,
  no inline handler, CSP-safe). Failing test first: `wall/__tests__/photoFallback.test.tsx` was RED on main's WallTile.
  It covers dead links only; it does not fix the Jxjx tile (that URL serves a real image of an error page).

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

## Stage 5: independent critique and one fix pass (ticket dt_35ff972ae82e)
Full list: [`w2d-hub-critique.md`](w2d-hub-critique.md). Re-walked with `walk.mjs` (screens + `report.json`) and `probe.mjs`.

| Check | Before | After | How |
|---|---|---|---|
| Late gig list: About moves (dancer + DJ + teacher, no gig; gig read held 2.5s) | 18px at 360 and 390 | 0 at 360, 390 (all 3 late shapes) | two-column Also lines reserve 2 rows (36px) |
| Hero filler "Their dancer page" (dancer lead, no facts) | 3 of 6 shapes | 0 | line only when there are facts; DJ line always (reserved row) |
| Hint last line | one word ("hi.") | balanced, 2 lines | `text-wrap: balance` |
| Raw U+2026 / U+00B7 in hub source | 3 | 0 | escapes + a test |
| Back from a one-role role page (`probe.mjs`) | loops: `/dancers/unclaimed-00422bf9` -> same page; `/djs/bobby-blanco` -> same page | fixed in step 2 (below) | patch applied in step 2 |
| Seam step / lowest contrast / smallest tap / scrollWidth | 3 / 6.41 / 44 / = viewport | same at 360, 390, 430, all 6 shapes | - |

Seams looked at in the new 390 shots and the full-page shot: header (black site chrome, gold rule) over the brown ground:
the same as on the wall; hero card and Also cards on the ground: one step lighter (`WALL.card`), edges in role colours, no
halo; ground into the footer: a smooth brown-to-gold fade with no line and no plain band, then the footer's own gold
padding.

## Not verified
- Real photos: the sandbox cannot reach the media host (proxy 403), so every face in the screenshots is the initials
  fallback; photo crops and the Jxjx dead URL itself were not seen in a browser (the fallback is unit-tested both ways).
- Jxjx (stage-5 fact, 2026-10-23): its photo URL returns HTTP 200, a 23 KB JPEG that is itself a screenshot of a "Page
  not found" page. The dead-link fallback cannot catch that and is not meant to; no image-content check is added. Test
  account, the owner deals with it.
- A real phone; the Vercel-built site (local dev only); desktop >= 1024px beyond the CSS rule.

## Step 2: Back-loop fix + owner wording (ticket dt_ee031c530f23, 2026-10-23)
Re-walked with `walk.mjs`, `probe.mjs` and `backloop.mjs` (reports: `report.json`, `probe-report.json`, `backloop-report.json`).

| Check | Before | After | How |
|---|---|---|---|
| Back from a one-role role page | loops (same page) | no role bar; the page's own Back: `/dancers/unclaimed-00422bf9` -> `/dancers`, `/djs/bobby-blanco` -> `/djs`; no loop | `roleSwitchModel` asks `personDestination`: no hub = no bar (patch, person-page hunks only) |
| Two-role role page (`/djs/elias`, `/dancers/elias`) | bar, Back -> hub | same: "Back to Elias" -> `/people/elias`, hub renders | - |
| roleSwitch table cases red on the unfixed code | - | 15 of 67 red, then 67/67 green | - |
| Gig count | "1 coming up" for one gig | none for one gig; " &middot; N coming up" from 2 (N = total) | `hub/model.ts` `count > 1` |
| Gig date (wall chip + hub, ONE label) | "Fri 23" | "Friday 23 October" (London key, same rollover) | `wall/model.ts` `wallDateLabel` |
| Late gig list at 360, DJ leads, 2+ gigs: About moves | 22px (the count wraps the line to a 2nd row) | 0 at 360, 390 (all 3 late shapes) | DJ-lead hero line reserves 2 rows (44px) while a gig line is expected (badge hint or gig list); a no-gig DJ keeps 1 row |
| Hub clipped text / scrollWidth / contrast / tap / seam | - | none / = viewport / 6.41 / 44 / 3, all 6 shapes x 360, 390, 430 | - |
| Wall date chip (`/djs`, 4-col tiles 79px at 360, 86px at 390) | one row, 14px | **two rows, 30px**, covers the lower ~40% of the face; no sideways overflow | owner call, see handover |
