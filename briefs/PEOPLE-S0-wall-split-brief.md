# People arc S0 -- the wall parts of #963 as their own PR

Arc plan decisions are in this brief; the owner approved "Yes, start S0 + S1" on 2026-10-23.
Work branch: `claude/people-wall-split` (new, from origin/main). Lane: normal. Website only, no DB.
A sibling worker (S1) is building `src/modules/person-page/facts/`, `frame/`, `worlds/` and edits
`src/lib/featureFlags.ts` and `src/lib/languageNames*` at the same time: DO NOT touch those paths.

## Why
PR #963 (`claude/w2d-hub-build`, head 2c99d77c) mixes two things: the face-wall improvements (keep) and the
person hub `/people/:id` (superseded: the owner chose "tabs on top, each role its own world" instead of a hub).
The P0 audit (`docs/people-arc/audit/REPORT.md` on `claude/people-arc-audit`) also found the hub crashes on
wall -> hub -> role navigation. #963 will be closed after this PR opens.

## Take from #963 (wall only)
- `src/modules/person-page/wall/**`: WallTile, RoleChip, model (full date "Friday 23 October", gig wording),
  tokens, `usePhotoFallback.ts` + `photoFallback.test.tsx`, and the wall tests.
- `src/modules/person-page/badges.ts` ONLY if the wall model needs its change (nextGigDate); say which in the PR.
- Do NOT take: `hub/**`, `roleSwitch.ts` + its test, the hub CSS in `src/index.css`, `featureFlags.ts`
  (personHub), the hub mockup PNGs/docs. Wall tiles must keep linking to the role pages as on main (no `/people`).

## Then change: the DJ date goes UNDER the name (owner pick B, mockup https://claude.ai/artifact/8T2FwYGJgRzT8yeABxQiJg)
Owner's words: the full date "wraps the wall's DJ date chip to 2 rows" and covers ~40% of the face; the owner
picked "No chip on the face. 'Friday 23 October' in gold under the name. Full words, face clear, DJ tiles a bit taller."
- WallTile: remove the absolute chip on the face; after `tile-name` render `<div data-testid="tile-date">`
  (`<span className="sr-only">Next gig </span>` + label) only when there is a date. Gold `#FFD479`, 10px,
  800, line-height 13px, margin-top 1px, centred, normal word wrap. Explicit px.
- tokens: replace `DATE_CHIP` with `DATE_LINE = { text: '#FFD479' }`; add `SIZE.dateLine: 10, dateLineHeight: 13`.
- Tests: rename `date-chip` -> `tile-date`, keep every assertion; add "the date is not inside wall-face and sits
  after tile-name" (run it red on the chip version first); wallContrast asserts the date line on WALL.page >= 4.5.

## Checks before push
Every CI job step that applies (read `.github/workflows`), unit tests green. Screenshots of `/djs` and `/dancers`
at 360x800 and 390x844 on a local build reading prod (read-only) with the wall flag ON, into
`docs/people-arc/s0/`. Look at them: no clipping, no sideways scroll, long names readable, date never on the face.
Design record `docs/design/<pr>.md`: one paragraph, owner pick B, link to the mockup. PR body: what was taken
from #963 and what was left, the per-job CI table, Verified / Not verified.

## Handover
Push once. `docs/people-arc/s0/HANDOVER.md`: head sha, PR number, files taken, screenshots, not verified.
