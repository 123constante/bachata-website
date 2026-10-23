# People pages arc -- P2 MOCKUPS (design options, no product code)

Owner 2026-10-23: "all these decisions about the dancer page seem like patchwork... do a full arc... we need to
create a professional page." The P0 audit is on branch `claude/people-arc-audit`:
`docs/people-arc/audit/REPORT.md` (read it first), `shapes.md`, `shots/`. Its verdict: five products sharing a row,
built for rich profiles almost nobody has.

Work branch: `claude/people-arc-mockups` (new, from origin/main). Output ONLY under `docs/people-arc/mockups/`.
Lane: normal. Supabase read-only SELECT; public display names only.

## Owner decisions (fixed, do not re-open)
- D1 ONE page per person. The role URLs stay: `/dancers/<slug>`, `/djs/<slug>`, `/teachers/<slug>` all open the
  SAME page; the URL decides which role is shown first. The link preview (og title/image) follows the role link,
  e.g. "Ramiro Zapata &middot; Teacher in London".
- D2 Roles are TABS under the name ([Teacher] [DJ] [Dancer], only the roles the person has; a one-role person has
  no tab row). The link picks the tab. Tapping a tab changes the URL to that role's address. No hub page, no
  "Back to <name>" bar.
- D3 Design for the THIN person first: 95% no bio, 91% no languages, 89% no nationality, 36% teacher-only.
  The page must look finished with name + photo or initials + roles + city only, and gain useful content from
  the calendar (DJ: next gigs; teacher: classes/workshops they teach; dancer: whatever the data really has).
  Sections appear only when filled. No empty cards, no "nothing here" filler, no copy promising content that is
  not there.
- D4 TINT PER ROLE: the shared warm-dark base (wall tokens `src/modules/person-page/wall/tokens.ts`, WALL.page
  #1E1410) tinted by the active tab: dancer teal, DJ gold, teacher violet (accents in that file).
- Earlier decisions: full weekday + month "Friday 23 October"; on the wall the date sits UNDER the name in gold,
  not on the face (owner pick B, https://claude.ai/artifact/8T2FwYGJgRzT8yeABxQiJg); gig count only from 2;
  languages as full names; COMPACT density (`.claude/rules/design-density.md`); explicit px (html is ~13.5px on
  phones); taps >= 44px; contrast >= 4.5.

## Step 1: data survey (counts only) -> `docs/people-arc/mockups/data.md`
What calendar facts exist per role on prod, so the mockups only show content that is real: upcoming gigs per DJ,
classes/workshops a teacher is in the lineup of (event_program_people is the lineup authority), events a dancer
is linked to, festivals. Distribution (0 / 1 / 2-5 / 6+). Photo coverage per role.

## Step 2: brief -> `docs/people-arc/mockups/BRIEF.md`
Five lines per screen (wall tile, person page per tab, link preview card): who opens it, what they want in
the first screen, what must be one tap away.

## Step 3: 3 directions, genuinely different (not three colourways)
Each direction is a standalone HTML file `a.html`, `b.html`, `c.html` that renders the REAL people below at
390x844 and 360x800, plus the wall tile, plus the WhatsApp/Instagram link preview card. Name each direction in
two or three plain words. Shapes (real prod people, from the audit's shapes.md):
1. thin dancer-only, no photo
2. teacher-only, no photo (the most common person)
3. DJ-only with 2+ upcoming gigs
4. all three roles, rich (Ramiro Zapata) -- each of its 3 tabs
5. long name (17-21 chars)
Screenshot every direction x shape x width to `docs/people-arc/mockups/shots/` and build
`docs/people-arc/mockups/gallery.html` (directions side by side per shape, a one-paragraph pitch per direction,
and its trade-offs in plain words).
Each direction lists, in the gallery, every fact it shows and where that fact comes from (one shared mapping).

## Self-checks (Design Gate stage 4, run on your screenshots)
contrast >= 4.5 per text colour, taps >= 44px, no clipping, no sideways scroll at 360, every empty state
actionable, the one-role page has no tab row. Put the results table in the gallery.

## Not in scope
No product code, no router changes, no PR body claims of "ready". Use HTML entities, not raw Unicode
punctuation.

## Handover
Push once. `docs/people-arc/mockups/HANDOVER.md`: head sha, shapes covered and not, the three direction names,
self-check table, open questions for the owner (plain words, max 4).
