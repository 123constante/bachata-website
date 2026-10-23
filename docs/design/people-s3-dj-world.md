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
| Book | "BOOK MORCILLA" + the first link (SoundCloud, Mixcloud, Instagram, website, Facebook order), opens in a new tab | `listenLinks` |
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
