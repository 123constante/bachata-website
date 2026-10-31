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
- **Test, red first:** `tests/e2e/walk-p3-create-kinds.spec.ts`. Listed in `test:e2e` like the other P3 walks, BUT
  the e2e-smoke job does not set `VITE_ENABLE_ORGANISER_P3`, so in CI it skips at once and checks nothing; it
  bites only when run locally with both flags (command in the spec header). For all nine tiles at 390x844, 360x740 and 430x932: pill is
  not absolute/fixed, comes after the description, its box AND its text start below the description's bottom,
  no child spills out of its own box or the tile, each tile >= 44x44, page no wider than the viewport.
  Against the unfixed CSS: 390 and 360 failed (Course, Festival, Online: "content overflows its box", "pill
  text top above description bottom"); 430 passed. After the fix: 3/3 pass.
- **Walk screenshots** (looked at each; regenerate with `WALK_SHOTS=1`): `docs/design/p3-create-event/walk/00-kind-picker-{390x844,360x740,430x932}.png`.

## Verified
- The e2e spec above, red then green, with real layout (Chromium, both flags on).
- `tsc --noEmit` clean; `vitest run src/modules/organiser/p3/new` 124/124; `npm run lint` 24/24 links green.

## Not verified
- No real-data shape survey: the change is CSS on a static nine-tile picker with no data-driven content.
- Not tested on a physical phone (Ricky's phone test is the final confirmation).

## Review (/code-review medium, one round)
- Fixed: fast skip when P3 is off; screenshots only with WALK_SHOTS=1; wait for animations instead of a fixed
  400ms; pill count not hard-coded; 2px rounding tolerance; honest wording on what CI enforces.
- Declined: making the shared `.p3-tag` grow (`min-height` instead of `height: 24px`). Wider blast radius than
  this brief; the picker-scoped override fixes the defect. Worth a separate look if another tag is ever allowed to wrap.

## Next
- Turning on `VITE_ENABLE_ORGANISER_P3` in e2e-smoke would make all P3 walks real gates (owner call).
- Nothing else open from this brief. No features added; deferred kinds untouched.
