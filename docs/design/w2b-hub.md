# Design record: W2-B person hub on /people/:id (PR number unknown; the orchestrator renames this file)

Flag: `flags.personHub` (`VITE_ENABLE_PERSON_HUB=true`), default OFF. Everything below is the ON path.
Flag OFF: `/people/:id` is today's tabbed page and wall tiles link as today (tests in
`src/modules/person-page/hub/__tests__/hub.test.tsx`, plus the existing PersonPage / alsoBar / embedded suites, unchanged and green).

## Brief
- **Who:** a newcomer to London bachata, on a phone (390x844), who just tapped a face on the wall.
- **One job:** see who this person is at a glance, then open the role page they want (DJ, dancer, teacher).
- **Feel:** warm and social, the same warm dark base and role accents as the wall.

## Options chosen (owner, 2026-10-21)
- The S12 hub mockup (`claude/s12-hub`, `src/modules/person-page/mockups/S12Hub.tsx`, views `hub-roger`, `hub-gatica`,
  `hub-pierre`): a header card (big rounded-square face, name, city, facts, next-event button), then one big
  card per role in lead order.
- Changes from the mock, all because of rules in the W2-B brief:
  - The back control says **Back** (not "People wall"): it goes to the previous page when that was this site,
    which can be search or an event, not only the wall.
  - The lead DJ card has no "HAPPENING NOW" label: the gig can be days away, so the label would not be true.
  - Role chips (the ONE mapping, `roleTagsFor`) sit under the city line, as the brief asks.
  - No organiser card: no existing public read tells the page that a person runs an organiser page (see the handover).
  - The "mock: not live" badges are gone (the teacher card only shows while teacher pages are open).

## Tokens used (one tokens file: `src/modules/person-page/wall/tokens.ts`)
- `WALL.page` `#1E1410` (ground), `WALL.card` `#2B1D16` (header card, role cards), `WALL.text` `#FBEBDD`,
  `WALL.muted` `#CDB09C` (stage/real name under the heading, map pin, section label), `WALL.line` `#6A4A38`
  (header card border, facts divider).
- `CHIP[role]` (chips, card role pill, next-event button = `CHIP.dj`), `TILE[role]` (initials tile, card edge colour).
- `WALL_FADE` / `SEAM` for the hub ground (the same soft fade the wall uses, so the hub never draws a line against the
  site background above or below it).
- New: `HUB` sizes (explicit px, not rem): face 112, name 24/29, body 15, sub 14, section label 13, card min height 72,
  card edge 8, CTA min height 52, tap 44.

## Self-running checks at 390x844 (`docs/mockups/w2b-hub/shot.mjs`, numbers in `report.json`)
| View | Build | Min text contrast | Tap targets < 44px | Clipped text | scrollWidth | h1 count |
|---|---|---|---|---|---|---|
| `on-dj-real` (sandbox DB DJ, no name, no photo) | production, flag ON | 6.41 | 0 | 0 | 390 | 1 |
| `on-dancer-real` (sandbox DB dancer, London) | production, flag ON | 7.43 | 0 | 0 | 390 | 1 |
| `fixture-three` (3 roles, gig, flag, facts) | dev harness | 6.41 | 0 | 0 | 390 | 1 |
| `fixture-djgig` | dev harness | 6.41 | 0 | 0 | 390 | 1 |
| `fixture-nophoto` | dev harness | 7.43 | 0 | 0 | 390 | 1 |
| `fixture-long` ("DJ Carlos De La Cruz", real name "Carlos De La Cruz Fernandez-Montenegro") | dev harness | 6.41 | 0 | 0 | 390 | 1 |
| `fixture-thin` (no facts, no city) | dev harness | 7.43 | 0 | 0 | 390 | 1 |
| `fixture-teacherhidden` | dev harness | 7.43 | 0 | 0 | 390 | 1 |
| `fixture-brokenphoto` | dev harness | 7.43 | 0 | 0 | 390 | 1 |

- Contrast is every visible text node in the hub against its nearest painted background, from computed styles.
  The lowest, 6.41, is the muted name line (`WALL.muted` on `WALL.card`). Chip text on chip colours is included.
- Tap boxes: Back 63x44, next-event button 341x52, every role card 370x77.
- Long names wrap (`overflow-wrap: anywhere`); nothing is cut off with an ellipsis.
- Empty states: no facts = no strip (not an empty box); no gig = no button and no text about a next event; no photo or a
  broken photo = initials in the lead accent; no name at all = today's placeholder heading and "?" on the face. Zero visible
  roles = the existing 404 (`on-teacher-only-real`: teacher-only person with teacher pages closed -> 404, unchanged).
- Hydration: 0 hydration warnings and 0 page errors in the production-build views (console watched for #418/#421-#425
  and "did not match").

## Colour-seam inspection
`docs/mockups/w2b-hub/seam.mjs` reads a pixel column outside every card (x = 6 CSS px) and reports the largest
one-row colour step (0-255 per channel):
- `fixture-three`: max step **1** (site ground `rgb(16,18,20)` fades into the hub base `rgb(30,20,16)` and back out to
  `rgb(14,18,21)` below the cards). `fixture-thin`: max step **1**.
- Header card vs hub ground: `WALL.card` on `WALL.page` with a 1px `WALL.line` border, as the approved mock. This is the
  card's own outline, not a seam between two page surfaces.
- Role card vs hub ground: the same card colour with the role's edge colour as its outline and left bar (mock).
- What I saw in each picture: `fixture-three`, `fixture-long`, `on-dj-real`: the dark site ground warms into brown above
  the Back control with no line; below the last card the brown cools back to the site ground with no line, then (on the
  production page) the site's orange footer, unchanged and site-wide.

## Reviewer
Not self-approved. A different worker reviews this record and the pictures.
