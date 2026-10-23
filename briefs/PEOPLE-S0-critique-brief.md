# People arc S0 critique (Design Gate stage 5) -- READ-ONLY review of PR #975

You are an independent reviewer (impeccable-finish-reviewer role), not the builder. Change NO product code.
PR #975, branch `claude/people-wall-split`. Push ONLY your critique doc: `docs/design/people-s0-critique.md` on
`claude/people-wall-split` (docs only, one push).

## Direction contract (owner's choice "B", 2026-10-23)
On the /djs and /dancers face wall (4-column grid, tiles ~79px wide at 360, ~86px at 390) a DJ with an upcoming gig
shows NO chip on the face; "Friday 23 October" (full weekday + month, never abbreviated) sits in gold #FFD479 UNDER
the name, 10px / 800, two short lines accepted; DJ tiles a little taller; face stays clear. Explicit px (html is
~13.5px on phones). Compact density (`.claude/rules/design-density.md`). Contrast >= 4.5. Taps >= 44px.
Approved comp: mockup artifact https://claude.ai/artifact/8T2FwYGJgRzT8yeABxQiJg, option B (the HTML is also
reproduced in this brief's sibling file `briefs/dj-date-chip-mockup.html` on `brief/people-arc` if present;
otherwise judge from the contract above).

## Check
`git diff origin/main...HEAD -- src`; the screenshots `docs/people-arc/s0/*.png`; build it and render /djs and
/dancers at 360x800 and 390x844 with `VITE_ENABLE_PEOPLE_WALL=true` against prod (read-only) yourself.
- matches the contract; face clear; nothing else on the tile moved unintentionally (name, chips, flag)
- rows with and without a date look deliberate, not ragged (compare row heights across the grid)
- sr-only "Next gig " reads sensibly with a screen reader order (name, then date, then roles)
- tests really pin the placement (mutate: put the date back inside the face, the test must go red)
- dead tokens/imports left behind; any copy pointing at something not on screen

## Output
`docs/design/people-s0-critique.md`: verdict (SHIP / FIX FIRST), then at most 6 findings most material first, each
with file:line, a screenshot path, and the concrete fix. Say plainly if there are none. Push once.
