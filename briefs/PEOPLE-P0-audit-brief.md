# People pages arc -- P0 AUDIT (read-only)

Owner 2026-10-23: "all these decisions about the dancer page seem like patchwork... do a full arc... we need to
create a professional page." This audit is the arc's first step. It CHANGES NO PRODUCT CODE.

Work branch: `claude/people-arc-audit` (new, from origin/main). Output goes ONLY under `docs/people-arc/audit/`.
Lane: normal. Supabase: read-only SELECT counts, no personal data in the output beyond public display names/slugs.

## Screens (prod = main, plus PR #963 head `claude/w2d-hub-build` where it differs)
1. The wall: /dancers, /djs, /teachers (and the Organisers link).
2. The person hub /people/:id (only behind flags.personHub; build #963 locally to see it).
3. Role pages: dancer profile, DJ profile, teacher profile (find the routes in src/App / router).

## Shapes (survey prod first, counts only, then pick one real example per shape)
role combinations (dancer only, dj only, teacher only, each pair, all three) x photo / none x upcoming gig / none
x claimed / unclaimed x long name (>16 chars) x empty bio / empty languages / no nationality x archived (must 404).
Write the counts table to `docs/people-arc/audit/shapes.md`.

## Capture
- Every screen x every shape at 390x844 and 360x800, full-page screenshots, named `<screen>-<shape>-<width>.png`.
  Reuse docs/mockups/w2d-hub-build/walk.mjs and probe.mjs from #963's branch as a starting point.
- Walk the journeys by tapping: wall tile -> hub (or role page) -> role page -> Back -> ... Record each hop's URL.

## Report `docs/people-arc/audit/REPORT.md` (plain words, owner reads it)
1. One-paragraph verdict: what makes it feel patchwork.
2. Facts shown on more than one screen (name, roles, next gig date, gig count, languages, nationality, photo, years
   dancing, bio, contact) -> for each: where it is shown, how it is worded/styled on each screen, where they disagree,
   and which code produces it (file:line). Two copies of one fact = a finding.
3. Visual seams: colour grounds, fonts, sizes, radii, chip styles that differ between screens (measured, not guessed).
4. Navigation: every Back / link and where it lands; dead ends, loops, surprises.
5. Empty / thin states: what a person with almost nothing filled in looks like on each screen.
6. Tap targets < 44px, contrast < 4.5, clipping, sideways scroll.
7. What #963 changes vs main, and which parts the arc should keep.
Also `docs/people-arc/audit/gallery.html`: a static page of every screenshot grouped by shape, screens side by side.

## Not in scope
No fixes, no mockups, no design proposals beyond one line per finding saying what kind of decision it needs.

## Handover
Push once. Handover: head sha, shapes covered and NOT covered (and why), screenshot count, the report path.
