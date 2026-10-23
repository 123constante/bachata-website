# People pages arc -- P2b MOCKUPS: the three WORLDS (design options, no product code)

Read first: P0 audit `docs/people-arc/audit/REPORT.md` (branch `claude/people-arc-audit`) and the P2 round
`docs/people-arc/mockups/` (branch `claude/people-arc-mockups`: its `data.md` survey and `src/facts.js` mapping
are reusable). The P2 A/B/C directions were REJECTED as a direction because they made one page with a tint.

Work branch: `claude/people-arc-worlds` (new, from origin/main). Output ONLY under `docs/people-arc/worlds/`.
Lane: normal. Supabase read-only SELECT; public display names only.

## Owner's words (2026-10-23)
"currently what we are seeing on the website is a very good LOGIC. There is tabs on top, and I really like how
every time you click on a tab, page changes to a different theme. And design. Obviously, there is many things
that we need to work on that page. But overall, I like how there is a tab on top of the profile picture, and
every time you tap a tab, it takes you to a different world."

## Fixed decisions
- Start from the LIVE role pages on main (dancer page = teal card world; DJ page = record-sleeve world with the
  vinyl photo frame, DM Serif Display headings, Upcoming, Played at). Keep each world's identity. The teacher
  world is weak today (P0: grey ground, no photo, raw "es"/"en" pills, role bar below the hero): design it as a
  real third world with its own identity at the same quality as the DJ world.
- Role tabs at the TOP, above the profile picture, the SAME component in the SAME place on every world. They list
  ALL the person's roles with the current one selected (today only the other roles show, with an arrow). One-role
  people: no tab row. Tapping a tab goes to that role's URL (`/dancers|/djs|/teachers/<slug>`).
- Back and Share in one place on every world.
- One name rule: DJ world shows the DJ name big and the public name small under it (e.g. "Morcilla" /
  "Papacito"); dancer and teacher worlds use the public name. No double spaces, no "DJ " prefix duplication.
- One language format (full names, "Spanish, English"), one no-photo placeholder style per world that still reads
  as one family, nationality as a flag (never a raw code), city without postcode.
- Thin-first: 95% of people have no bio, 91% no languages, 89% no nationality; 36% are teacher-only. Every world
  must look finished for a thin person; no empty cards, no "coming soon" filler, no copy promising missing
  content. Calendar facts (data.md): DJ 17/40 have upcoming gigs, teacher 48/124 have upcoming classes, dancers
  have NO calendar rows, festivals have no artist rows.
- Dates "Friday 23 October" (full weekday + month); counts only from 2; compact density
  (`.claude/rules/design-density.md`); explicit px; taps >= 44px; contrast >= 4.5; HTML entities, not raw Unicode.

## The one open question to answer with PICTURES
The dancer world today ends with empty ground under the card (see audit shot
`main-role-dancer-all3-claimed-rich-390.png`), because the calendar holds nothing for dancers. Draw THREE versions
of the dancer world's lower half, labelled in plain words, e.g.: (1) "Socials to dance at this week" from the
calendar in their city; (2) a preview of their other worlds ("Next class Saturday 21 November", "Next DJ set ...")
when they have them; (3) short page, footer comes up. Show each on a thin dancer-only person AND on Ramiro.

## What to draw
Real people (data.md): Magda (thin dancer-only), Pierre Henry (teacher-only, no photo, no city), Papacito (DJ +
dancer, DJ name Morcilla, 2 gigs), Ramiro Zapata (all three, each world), Sabrina Guzman Pastor (long name), plus
one teacher with an upcoming class. Each at 390x844 and 360x800, full page INCLUDING the real site header and
footer (so empty space is visible honestly). Also: the BEFORE (today's live page) next to each AFTER.
Build `docs/people-arc/worlds/gallery.html`: per person, before/after per world, then the dancer-filler options
side by side, then a self-check table (contrast, taps, clipping, sideways scroll at 360, tab row present only
for 2+ roles and in the same y-position on every world).

## Not in scope
No product code, no router changes.

## Handover
Push once. `docs/people-arc/worlds/HANDOVER.md`: head sha, what is covered and not, the self-check table, up to 4
open questions for the owner in plain words.
