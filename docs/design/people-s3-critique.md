# People arc S3 -- the DJ world (#984): independent critique (Design Gate stage 5)

Brief: `briefs/PEOPLE-S3-critique-brief.md` on `brief/people-arc` (sha 9919ea49). Critic: a fresh worker, not the
builder. Judged on 2026-10-23 against a production build with `VITE_ENABLE_PERSON_WORLDS=true` and prod data
(read-only anon reads), Chromium at 390x844, 360x800 and 430x932, compared with the approved mock
(`claude/people-arc-worlds`, `docs/people-arc/worlds/shots/papacito-dj-390.png`).

Visitor: a London dancer on a phone, opening a DJ's page from the people wall or a shared link, deciding whether
to go to the DJ's next party.

## Ordered fix list

| # | Finding | Why it matters to the visitor | Severity | Verdict |
|---|---|---|---|---|
| 1 | **The whole world jumps down 58 px when the role tabs arrive.** The roles read answers ~1-3 s after the page paints; until then the frame has no tabs row, then it inserts one. Measured layout shift 0.033-0.054 per page (`dj-world: y 142 -> 200`) on every multi-role DJ walked. Prod: 36 of 40 DJs hold 2+ roles. | The visitor is already reading (or tapping a gig row) when everything moves a thumb's height down: a mis-tap lands on the wrong row or on nothing. | should | **fixed here**: `PersonFrame` takes an optional `rolesPending` and keeps the tabs row (52 px, `aria-hidden`) while the read is out; `/djs/:id` passes `!person.answered`. No new read. After: 0 shift on all 6 multi-role DJs walked. Trade-off: the 4 DJ-only people (4 of 40) now see the row close (58 px up, 0.031-0.038) when the read answers. |
| 2 | **The booking row jumps when the dates arrive.** It rendered under the 120 px dates placeholder, then moved to below the real rows (`dj-book: 602 -> 821` on chong; shift 0.022-0.035 on every DJ with a link). | Same mis-tap risk, and the row is in the first screen on thin pages. | should | **fixed here**: the booking row waits for the dates read (it shows on `ready` and on `failed`). After: no shift from it on any DJ walked. |
| 3 | On a thin page (brito, chino, 0 dates) the page says nothing about dates: the sleeve, then a "Parties this week" button. A past-only DJ (chong) has Played at but no line saying nothing is coming up. | "Is it still loading or is there nothing?" The visitor came to find the next party. | should | **owner call** (new copy, and the approved mock has the bare button). Recommendation: one muted line above the button, "No dates on the calendar yet.", and for a past-only DJ "No dates coming up yet." at the top of Played at. |
| 4 | Thin page: about 430 px of empty DJ ground between the last button and the footer (site-wide `GlobalLayout` is `min-h-screen`). The approved design lifted the footer. | On the first screen it is just dark space under the button (the page does end on something to do); scrolling shows a long empty band before the footer. | nice | **owner call**: a site-wide layout change, outside S3's files. Recommendation: let worlds opt out of `min-h-screen` in a later PR. |
| 5 | "Parties this week" goes to `/parties`, a calendar headed "Find Your Next Party", not a this-week list. | The label promises a list it does not land on. | nice | **owner call** (label is the approved mock's copy). Recommendation: "Find a party" or "Parties in London". |
| 6 | No name at all (2 in prod): h1 "DJ" and the avatar initial "D". | Reads like a placeholder; rare. | nice | **owner call** (it is the D5 fallback rule, `facts.worldNames`). |
| 7 | Gig time "21:00" where the mock showed "22:00" (Ronald & Alba Halloween). | A wrong time sends people at the wrong hour. | -- | **not a bug**: the event page for the same event shows the start 9:00 PM; the mock used its own sample data. The new facts read the stored London wall clock. |
| 8 | Tabs at y = 163 (mock 164). | Tabs in the same place on every world. | -- | **not a bug**: 1 px, the frame is shared, so every world gets the same y. |

## Checks that passed (no change needed)

- Back (D9), real browser: fresh tab on `/djs/papacito` -> Back -> `/djs`; dancer page -> its DJ link -> Back -> back on
  `/dancers/ramiro-zapata`; gig row -> event -> browser back -> DJ page. Label "Back", 63x44 px.
- Thin DJ (brito, chino) ends on something to do ("Parties this week"; chino also the invite).
- "Dance bachata too? Get your own card": 44 px tall, full width (370 px at 390), DJ-only people only, after the roles
  read answers; goes to `/auth?mode=signup&returnTo=<this page>`.
- Taps >= 44 px for every link and button in the frame, every shape, both widths. No clipping, no sideways scroll
  (390, 360, 430). No page errors.
- Contrast: lowest 5.91 (gold kicker/accents on the sleeve), 7.52 / 8.15 on the photo-less shapes.
- Focus ring: 2 px solid #FBEBDD outline, offset 2, visible on the gig rows, tabs, Back and buttons (checked by keyboard).
- Seams: header (black 85%) over the DJ ground (#0A080B) with the site's gold rule between: no step. Sleeve and
  section cards read as cards on the ground (warm brown edge). Page -> footer: dark to the site's amber footer, the
  same hard edge as every page and as the mock.
- Nothing points at a control that is not on screen.
- Wording: "Back", "Share", "Upcoming", "Played at", "N gigs coming up" (from 2 only), full weekday names
  ("Thursday 31 December").
- Mutation: showing the count at 1 turns `DJProfileWorlds.test.tsx` red; putting the "DJ " prefix back turns it red.
- Flag OFF: `/djs/:id` is today's page (the matrix test over every shape; the frame change is a new optional prop,
  default off, so S2's call is unchanged).

## Probe

`docs/people-arc/s3/critique-probe.mjs` (layout-shift entries with their sources, the tabs/Back/invite boxes, the
world's bottom vs the footer). Copy under `node_modules/.cache/` and run against the served build.
