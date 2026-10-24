# People arc P2b -- the three worlds -- handover

- Branch: `claude/people-arc-worlds` (from `main` d4bff82). Content commit: `630b915`; the head is the
  handover commit right after it (`git log -1 origin/claude/people-arc-worlds`).
- Brief: `briefs/PEOPLE-P2b-worlds-brief.md` on `brief/people-arc` (sha 34775c7a).
- No product code, no router changes. Everything is under `docs/people-arc/worlds/`.

## What is here
| File | What |
|---|---|
| `gallery.html` | Open this. Per person: BEFORE (today, red frame) next to AFTER at 390 and 360 (green frame); then the dancer lower-half options side by side; then the self-check table and where each fact comes from |
| `worlds.html` | The live mockup: `worlds.html?p=ramiro&r=dj` (`p` = magda, sabrina, pierre, nadeem, papacito, ramiro; `r` = dancer, dj, teacher; `f` = 1, 2, 3 for the dancer lower half) |
| `shots/` | 30 AFTER renders: 9 person/world pages + 6 dancer-option pages, each at 390x844 and 360x800 |
| `before/` | Today's pages, copied from the P0 audit shots (main fe77e93, plus the teacher-pages-on build for teachers) |
| `data.md` | The new prod facts this round (DJ names, a teacher with a class, socials this week) |
| `src/` | `facts.js` (the one shared mapping), `worlds.js` (the three worlds), `capture.mjs` (shots + checks), `gallery.mjs` |

Rebuild: `node docs/people-arc/worlds/src/capture.mjs && node docs/people-arc/worlds/src/gallery.mjs`.

## The worlds
- **Shared frame** (identical on every world): the live site header; Back left and Share right in one bar
  (top at 114 px); the role tabs under it and above the photo (top at 164 px on every world, both widths). The
  tabs list ALL roles in the order Teacher, DJ, Dancer, the current one filled in its role colour, the others
  with a coloured dot; each goes to `/teachers|/djs|/dancers/<slug>`. One-role people: no tab row.
- **Dancer world** keeps today's teal card: name + flag, "Leader &middot; London", "Speaks Spanish, English".
- **DJ world** keeps today's record sleeve: vinyl photo frame, DM Serif Display, Upcoming, Played at. The DJ
  name is big with the public name small under it (Morcilla / Papacito); "3 gigs coming up" only from 2;
  the guestbook "Coming soon" block is gone.
- **Teacher world** is new: a lilac "studio timetable" paper card (violet band, ruled lines, Fraunces name,
  photo or initials left of the name, "Teaches in London", "Speaks ...") on a dark violet grid ground; "Next
  class" rows lead with the time; a teacher with no class gets one "Classes this week" button.
- One placeholder family: a circle with initials in Inter 800, coloured by the world (teal / amber label /
  lilac). One date format ("Thursday 29 October"). Flags, never codes. City only, never a postcode.
- The footer comes up right after the content on every world (today the main area is stretched to the screen
  height, which is where the empty ground comes from).

## Covered / not covered
| Item | Covered | Note |
|---|---|---|
| Magda (thin dancer-only) | yes | plus all three lower-half options |
| Pierre Henry (teacher-only, no photo, no city) | yes | |
| Papacito (DJ + dancer, Morcilla, 2 gigs) | yes, both worlds | |
| Ramiro Zapata, each world | yes | plus all three dancer lower-half options |
| Sabrina Guzman Pastor (long name) | yes | fits on one line at 360 |
| A teacher with an upcoming class | yes: Nadeem Malik | the common London shape: no photo, no city, a class next Thursday |
| BEFORE next to each AFTER | yes except Nadeem | no audit shot of him; on main every teacher page shows the "Coming soon" form (Pierre's BEFORE) |
| Real photos | no | the image host is blocked from the sandbox; photos are a striped stand-in |
| Header and footer | yes | the live site's own pixels, cropped from today's page at the same width |
| Link previews, wall tiles | no | not asked this round |

## Self-check (30 renders; lowest contrast is worst case over every gradient stop)
| Render | Lowest contrast | Taps >= 44 | No clipping | No sideways scroll | Tab row only for 2+ roles | Tab y |
|---|---|---|---|---|---|---|
| magda-dancer-390.png | 4.79 | pass | pass | pass | pass | - |
| magda-dancer-360.png | 4.79 | pass | pass | pass | pass | - |
| sabrina-dancer-390.png | 4.79 | pass | pass | pass | pass | - |
| sabrina-dancer-360.png | 4.79 | pass | pass | pass | pass | - |
| pierre-teacher-390.png | 7.60 | pass | pass | pass | pass | - |
| pierre-teacher-360.png | 7.60 | pass | pass | pass | pass | - |
| nadeem-teacher-390.png | 8.85 | pass | pass | pass | pass | - |
| nadeem-teacher-360.png | 8.85 | pass | pass | pass | pass | - |
| papacito-dj-390.png | 5.91 | pass | pass | pass | pass | 164 |
| papacito-dj-360.png | 5.91 | pass | pass | pass | pass | 164 |
| papacito-dancer-390.png | 4.79 | pass | pass | pass | pass | 164 |
| papacito-dancer-360.png | 4.79 | pass | pass | pass | pass | 164 |
| ramiro-teacher-390.png | 7.60 | pass | pass | pass | pass | 164 |
| ramiro-teacher-360.png | 7.60 | pass | pass | pass | pass | 164 |
| ramiro-dj-390.png | 5.91 | pass | pass | pass | pass | 164 |
| ramiro-dj-360.png | 5.91 | pass | pass | pass | pass | 164 |
| ramiro-dancer-390.png | 4.79 | pass | pass | pass | pass | 164 |
| ramiro-dancer-360.png | 4.79 | pass | pass | pass | pass | 164 |
| magda-dancer-f1-390.png | 4.79 | pass | pass | pass | pass | - |
| magda-dancer-f1-360.png | 4.79 | pass | pass | pass | pass | - |
| magda-dancer-f2-390.png | 4.79 | pass | pass | pass | pass | - |
| magda-dancer-f2-360.png | 4.79 | pass | pass | pass | pass | - |
| magda-dancer-f3-390.png | 4.79 | pass | pass | pass | pass | - |
| magda-dancer-f3-360.png | 4.79 | pass | pass | pass | pass | - |
| ramiro-dancer-f1-390.png | 4.79 | pass | pass | pass | pass | 164 |
| ramiro-dancer-f1-360.png | 4.79 | pass | pass | pass | pass | 164 |
| ramiro-dancer-f2-390.png | 4.79 | pass | pass | pass | pass | 164 |
| ramiro-dancer-f2-360.png | 4.79 | pass | pass | pass | pass | 164 |
| ramiro-dancer-f3-390.png | 4.79 | pass | pass | pass | pass | 164 |
| ramiro-dancer-f3-360.png | 4.79 | pass | pass | pass | pass | 164 |

## Open questions for the owner
1. Under the dancer card: (1) socials in their city this week, (2) a preview of their other worlds, or (3) a
   short page where the footer comes up? (The mockup default is 2 when they have another world with a date,
   else 1.)
2. The teacher world is a light "timetable" card on a dark violet ground, unlike the two dark worlds. Is a
   light card right for teachers, or should it stay dark like the others?
3. Today's dancer page ends with "Dance bachata too? Get your own card". The mockups drop it. Keep it, and on
   which worlds?
4. A person with no city (Pierre Henry, Nadeem Malik) gets no "in London" line. Should "Classes this week"
   then open the London calendar, or the calendar with no city?

## Verified / Not verified
- Verified: prod facts (read-only SELECT only, no writes); all 30 renders and checks in Chromium at 390x844 and
  360x800 (contrast >= 4.79, every tap >= 44, no clipping, no sideways scroll, tab row only for 2+ roles at
  the same y); gallery images all resolve; no non-ASCII characters in any text file; integrity, mojibake and
  image checks pass locally; CI's docs-only detector says docs_only=true.
- Not verified: real photos; real phones; the live prod site; the Vercel preview (docs-only folder).
