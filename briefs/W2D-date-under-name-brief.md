# W2D wall: DJ gig date moves UNDER the name (owner pick B, 2026-10-23)

Branch: `claude/w2d-hub-build` (PR #963). Lane: normal. Small change, website only, no DB.

## Owner's words
"the full date wraps the wall's DJ date chip to 2 rows" (tiles 79px @360, 86px @390; the chip covers ~40% of the face;
see docs/mockups/w2d-hub-build/backloop-wall-djs-360.png). Shown 3 mockups
(https://claude.ai/artifact/8T2FwYGJgRzT8yeABxQiJg), owner picked **B: "No chip on the face. 'Friday 23 October' in
gold under the name. Full words, face clear, DJ tiles a bit taller."**

## Change (wall only; the hub is untouched)
1. `src/modules/person-page/wall/WallTile.tsx`: delete the absolute date chip on the face. Render, directly after the
   `tile-name` div, `<div data-testid="tile-date">` with `<span className="sr-only">Next gig </span>{person.dateLabel}`,
   only when `person.dateLabel` is set. Style: centred, colour `#FFD479` (gold), fontSize 10px, fontWeight 800,
   lineHeight 13px, marginTop 1px, `overflowWrap: 'anywhere'` is NOT wanted: normal word wrap ("Friday 23" / "October"
   or "Thursday 29" / "October" is fine). Explicit px (html is ~13.5px on phones).
2. `tokens.ts`: replace `DATE_CHIP` with a `DATE_LINE` token (`{ text: '#FFD479' }`, comment: gold on WALL.page, under the name)
   and add `dateLine: 10, dateLineHeight: 13` to `SIZE`. No other token changes. Remove the now-unused import.
3. Tests: rename `date-chip` -> `tile-date` in `wall.test.tsx` (keep every assertion, incl. "no date when none");
   add one assertion that the date is NOT inside `wall-face` and sits after `tile-name`. `wallContrast.test.tsx` line ~61:
   assert the date line's text colour against WALL.page (#1E1410) is >= 4.5:1 (it is ~13:1).
4. Red first: run the new placement assertion against the current code, see it fail, then change the code.

## Checks before push
- `npm run test:unit` scoped to `src/modules/person-page` green; then every CI job step that applies (read .github/workflows).
- Screenshot `/djs` at 360x800 and 390x844 on a local build against prod data (read-only) into
  `docs/mockups/w2d-hub-build/date-under-name-360.png` and `-390.png`. Look at them: no clipping, no sideways scroll,
  names that wrap (Boadicea Richards, Carlos De La Cruz) still readable, date never over the face.
- Update `docs/design/` record for #963 with one line: owner pick B, link to the mockup artifact.
- Use HTML entities, not raw Unicode punctuation, in any JSX text.

## Handover
Push once. Handover note says: head sha, test counts, the two screenshot paths, anything not verified.
