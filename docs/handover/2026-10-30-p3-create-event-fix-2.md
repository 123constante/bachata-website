# Handover: P3 create-event fix round 2 (branch claude/p3-create-event-build, PR #1208)

Brief: `brief/p3-create-event-fix-2:docs/briefs/p3-create-event-fix-2.md`. Ticket dt_c382302fa130.

## Done
- **Defect:** on the kind picker the "Coming soon" pill overlapped the last line of the description on Course,
  Festival and Online. Root cause: the shared `.p3-tag` is `height: 24px`. In a 3-column tile at 390px and
  360px "Coming soon" wraps to two lines, and the fixed-height box let its text spill up over the description.
  At 430px it fits on one line, which is why only the narrower phones showed it.
- **Fix** (`src/modules/organiser/p3/new/create.css`, picker-scoped, shared `.p3-tag` untouched): inside a kind
  tile the pill is `height: auto; min-height: 24px; padding: 3px 8px; line-height: 1.25`. It was already in
  normal flow and the last child; it now grows with its text and the tile grows to fit.
- **Test, red first:** `tests/e2e/walk-p3-create-kinds.spec.ts` (added to `test:e2e`; skips itself when
  organiserP3 is off, like the other P3 walks). For all nine tiles at 390x844, 360x740 and 430x932: pill is
  not absolute/fixed, comes after the description, its box AND its text start below the description's bottom,
  no child spills out of its own box or the tile, each tile >= 44x44, page no wider than the viewport.
  Against the unfixed CSS: 390 and 360 failed (Course, Festival, Online: "content overflows its box", "pill
  text top above description bottom"); 430 passed. After the fix: 3/3 pass.
- **Walk screenshots** (looked at each): `docs/design/p3-create-event/walk/00-kind-picker-{390x844,360x740,430x932}.png`.

## Verified
- The e2e spec above, red then green, with real layout (Chromium, both flags on).
- `tsc --noEmit` clean; `vitest run src/modules/organiser/p3/new` 124/124; `npm run lint` 24/24 links green.

## Not verified
- No real-data shape survey: the change is CSS on a static nine-tile picker with no data-driven content.
- Not tested on a physical phone (Ricky's phone test is the final confirmation).

## Next
- Nothing open from this brief. No features added; deferred kinds untouched.
