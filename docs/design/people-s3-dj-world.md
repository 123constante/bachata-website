# People arc S3 -- the DJ world (design record)

Brief: `briefs/PEOPLE-S3-dj-world-brief.md` on `brief/people-arc` (sha 0a8eb15f). Approved design: branch
`claude/people-arc-worlds`, `docs/people-arc/worlds/` (DJ world in `src/worlds.js`, shot `shots/papacito-dj-390.png`).
Behind `flags.personWorlds` (`VITE_ENABLE_PERSON_WORLDS=true`). Flag OFF: `/djs/:id` is today's page, unchanged.

## What the DJ world is

Under the site header: the shared `PersonFrame` (Back left, Share right, role tabs above the photo), then the
record sleeve:

| Part | Rule | Source |
|---|---|---|
| Vinyl + face | photo on the record label (104 px), else initials in the amber label (one placeholder family) | `frame/Avatar` |
| Kicker | city, upper case, postcode cut; flag sticker beside it, never a code | `facts.cityLabel`, `facts.flagCode` + `NationalityFlag` |
| Name | DJ name big (DM Serif Display, 40 px; 32 px over 16 chars), the real public name small under it only when it differs; never a "DJ " prefix; no name -> "DJ" | `facts.worldNames(.., 'dj')` |
| Count chip | "N gigs coming up", only from 2 | `facts.countLabel` |
| Bio | under the name when the DJ wrote one, hidden when empty | `djRoleFields` |
| Upcoming | one row per gig: big day number, "Friday 23 October &middot; 21:00", event, venue; the next gig highlighted | `facts.dayNumber`, `gigDateLabel`, `timeLabel` |
| Played at | dashed records: "OCTOBER 2026" + event | `facts.monthLabel` |
| No dates at all | one "Parties this week" button to `/parties` (so a thin page ends on something to do) | model |
| Book | "BOOK MORCILLA" + the first link (SoundCloud, Mixcloud, Instagram, website, Facebook order), opens in a new tab; shown once the dates read answered (so it does not jump) | `listenLinks` |
| Invite (D8) | "Dance bachata too? Get your own card", 44 px tall, to `/auth?mode=signup&returnTo=<this page>` (the dancer page's own `joinHref` entry); only once the roles read answered and the person is not a dancer | `buildSignInHref` |

Dropped from the DJ page (owner): the guestbook. Share moved from the bottom into the frame (top right).
Not on the sleeve (as in the approved design): languages, genres, gallery, FAQ, pricing, the Listen players.

States: page loading -> the DJ ground with the frame/sleeve boxes; dates loading -> one placeholder box (no
"Parties this week" yet); dates failed -> "Couldn't load the dates." + a Try again button (refetch); profile
missing -> today's not-found screen.

## Back (owner D9, frame-wide)

`PersonFrame`'s Back: when the previous page was on this site (React Router gave this page its own location key)
it goes back in history; opened straight from a shared link or a new tab (key `"default"`) it goes to `backHref`
(the world's list, `/djs`). The link's `href` is always `backHref`, so it works before hydration and a
modified click (new tab) is left to the browser. Label: "Back". Rule: `frame/backRule.ts` `backGoesToHistory`.

## Gig times are a wall clock

Event times arrive as a London wall clock stamped `+00` (see `londonDate.ts` `londonWallClockToInstant`). The new
time facts read the digits as written. `facts.londonDayOf` / `dateLabel` on a timestamp convert UTC -> London,
which moves a 23:30 gig to the next day in BST: use `gigDateLabel` for gig rows. (Prod today: 0 of the DJs' gigs
are affected, because none starts 23:00-23:59; the test pins the 23:30 case.)

## Design Gate 4 (self-checks, prod data, production build, flag ON)

Measured by `docs/people-arc/s3/` walk (Chromium, every text node in the frame against its own background or
every stop of its gradient; every link/button box; `scrollWidth` vs viewport).

| Shape (prod) | Slug | 390x844 | 360x800 | Lowest contrast | Taps >= 44 | No clipping | No sideways scroll |
|---|---|---|---|---|---|---|---|
| DJ name differs, 2 upcoming, 2 played, DJ + dancer | papacito | [shot](../people-arc/s3/shots/papacito-390.png) | [shot](../people-arc/s3/shots/papacito-360.png) | 5.91 | pass | pass | pass |
| 4 upcoming (most in prod), 1 played, no DJ name | jeff | [shot](../people-arc/s3/shots/jeff-390.png) | [shot](../people-arc/s3/shots/jeff-360.png) | 5.91 | pass | pass | pass |
| 3 upcoming, 2 played, several roles | ramiro-zapata | [shot](../people-arc/s3/shots/ramiro-zapata-390.png) | [shot](../people-arc/s3/shots/ramiro-zapata-360.png) | 5.91 | pass | pass | pass |
| 1 upcoming, "DJ " prefix, DJ name differs | nico | [shot](../people-arc/s3/shots/nico-390.png) | [shot](../people-arc/s3/shots/nico-360.png) | 5.91 | pass | pass | pass |
| longest name (20), "DJ " prefix = public name, no photo, no city, DJ only | carlos-de-la-cruz | [shot](../people-arc/s3/shots/carlos-de-la-cruz-390.png) | [shot](../people-arc/s3/shots/carlos-de-la-cruz-360.png) | 7.52 | pass | pass | pass |
| past only (3 played) | chong | [shot](../people-arc/s3/shots/chong-390.png) | [shot](../people-arc/s3/shots/chong-360.png) | 5.91 | pass | pass | pass |
| no photo, no city, 1 upcoming, DJ only | bobby-blanco | [shot](../people-arc/s3/shots/bobby-blanco-390.png) | [shot](../people-arc/s3/shots/bobby-blanco-360.png) | 7.52 | pass | pass | pass |
| thin: no dates at all, photo, city | brito | [shot](../people-arc/s3/shots/brito-390.png) | [shot](../people-arc/s3/shots/brito-360.png) | 5.91 | pass | pass | pass |
| thinnest: no name, no photo, no city, no dates | dj-chino-bzuk26 | [shot](../people-arc/s3/shots/dj-chino-bzuk26-390.png) | [shot](../people-arc/s3/shots/dj-chino-bzuk26-360.png) | 8.15 | pass | pass | pass |

Role tabs at y = 163 px on every multi-role DJ at both widths (the design measured 164). No page errors.
Every empty state names something to do ("Parties this week", "Try again", the invite); no copy points at a
control that is not on screen.

Known, not S3's to change: the site's `GlobalLayout` wrapper is `min-h-screen`, so on a thin page the DJ
ground runs to the bottom of the screen before the footer (the approved design lifted the footer; that is a
site-wide layout change).

## Stage 5 critique (2026-10-23, fresh worker): layout shift

Full list: [`people-s3-critique.md`](people-s3-critique.md). Measured with `docs/people-arc/s3/critique-probe.mjs`
(Chromium layout-shift entries, prod data, 390x844). Prod: 36 of 40 DJs hold 2+ roles, 4 are DJ-only.

| Shape | Before | After |
|---|---|---|
| multi-role (papacito, jeff, ramiro-zapata, nico, chong, brito) | 0.033-0.054 (tabs arrive: world 142 -> 200) + 0.022-0.035 (booking row moves when the dates arrive) | 0.0003-0.0008 (font swap only) |
| DJ-only (carlos-de-la-cruz, bobby-blanco, dj-chino-bzuk26) | 0.0002-0.0006 | 0.031-0.038 (the kept tabs row closes: 200 -> 142) |

Fix: `PersonFrame` `rolesPending` keeps the 52 px tabs row while the roles read is out (no new read); the booking
row waits for the dates. The DJ-only trade is accepted (4 of 40); removing it needs the roles in the first read
(owner call, not built).

## S3b (2026-10-23): invite everywhere, one world shell, thin wording, short-page footer, serif

Owner decisions D8', D11, D12, D13 and the frame-jump fix. Production build, prod data, flag ON, Chromium.
Walk: `docs/people-arc/s3/walk.mjs` (now also records the frame box and the footer gap). Shots retaken for the
7 slugs below (nico and ramiro-zapata keep their S3 shots: their shape did not change).

| Slug | Shape | Invite | Thin line / button | Back (L, T) | Bar W 390 / 360 | Content to footer | Lowest contrast | Taps < 44 | Sideways |
|---|---|---|---|---|---|---|---|---|---|
| papacito | 2 upcoming, 2 played, DJ + dancer | yes | - | L10 T113 | 370 / 340 | 54 px | 5.91 | 0 | no |
| jeff | 4 upcoming, 1 played, DJ + dancer | yes | - | L10 T113 | 370 / 340 | 54 px | 5.91 | 0 | no |
| brito | no dates at all | yes | "No dates on the calendar yet." / Find a party | L10 T113 | 370 / 340 | 54 px | 5.91 | 0 | no |
| chong | past only (3 played) | yes | "No dates coming up yet." / Find a party | L10 T113 | 370 / 340 | 54 px | 5.91 | 0 | no |
| carlos-de-la-cruz | 1 upcoming, DJ only | yes | - | L10 T113 | 370 / 340 | 54 px | 7.52 | 0 | no |
| dj-chino-bzuk26 | no name, no dates, DJ only | yes | "No dates on the calendar yet." / Find a party | L10 T113 | 370 / 340 | 54 px | 8.15 | 0 | no |
| bobby-blanco | 1 upcoming, DJ only | yes | - | L10 T113 | 370 / 340 | 54 px | 7.52 | 0 | no |

- Frame box: Back at L10 T113 and the bar 370 px (390) / 340 px (360) on every shape, both widths. At 1280x800
  (papacito, brito): Back L352 T68, bar 576 px (the `max-w-xl` column, centred). Bar W = the Back/Share row's width.
- Content to footer: 54 px on every shape = the site footer's own `mt-16` (the same on `/parties`), on the DJ
  ground. Before: 177-307 px of empty ground on thin pages. Two holds were released: `GlobalLayout`'s
  `min-h-screen` and the route wrapper's `.route-shell` min height (index.css), both for the worlds only.
- The muted thin line is `card.muted` #E3CDB9 on the ground: inside the 5.91 floor above.
- DM Serif Display: the name renders in the serif on every shot (`DjWorld` now loads the font itself).
- No page errors on any render.
