# Brief: broken image states on organiser Details, REBUILD from main (replaces conflicting PR #1442)
Brief-version: 2
Branch: claude/p3-broken-image-states-r2
Lane: normal, Sonnet. 123constante/bachata-website, src/modules/organiser/p3 only; no calendar density-exclusion files, no generated types.
Serves: organisers whose editor picture fails to load see a plain note instead of a blank box.

## What main lacks
- a BrokenImage component that shows a plain note when an editor picture does not load -- grep: p3-image-broken
- extends: the finished, tested implementation exists on origin branch claude/p3-broken-image-states (PR #1442, head b63ff21d) but its merge with main has real overlapping changes in DetailsScreen.tsx, DateFieldSheets.tsx, labels.ts or p3.css; reuse it and re-apply by hand, do not redesign -- src/modules/organiser/p3/screens/DetailsScreen.tsx

## Files
- src/modules/organiser/p3/screens/BrokenImage.tsx (new)
- src/modules/organiser/p3/screens/__tests__/brokenImage.matrix.test.tsx (new)
- src/modules/organiser/p3/screens/DetailsScreen.tsx
- src/modules/organiser/p3/screens/DateFieldSheets.tsx
- src/modules/organiser/p3/model/labels.ts
- src/modules/organiser/p3/theme/p3.css
- src/modules/organiser/p3/INVENTORY.md (new, exists on the old branch)

## What to build
0. INVENTORY.md first: the old branch already carries an INVENTORY.md addition (14 lines, `git diff origin/main...origin/claude/p3-broken-image-states -- src/modules/organiser/p3/INVENTORY.md`); re-apply it onto main's current INVENTORY.md and report the coverage count (covered / total) at the end.
1. Cut the branch from current origin/main. Bring over the two files that do not exist on main UNCHANGED: `git checkout origin/claude/p3-broken-image-states -- src/modules/organiser/p3/screens/BrokenImage.tsx src/modules/organiser/p3/screens/__tests__/brokenImage.matrix.test.tsx`.
2. For the five files that exist on main, do NOT copy the old versions. Read each old change with `git diff origin/main...origin/claude/p3-broken-image-states -- <path>` (it is small: 1-4 lines each) and re-apply that intent by hand onto main's current text.
3. Run the new matrix test, the neighbouring p3 tests and `npx tsc --noEmit -p .`; everything green. Push once with the final commit subject ending [worker-done <ticket>] (no [skip preview] on the final push).

## Tests
The old matrix test must pass unchanged; add nothing unless a main change broke it (then fix the minimum and say why).

## Done when
- Rebuilt branch = main plus these files, all checks the old PR had green locally.
- PR body: Verified / Not verified (Not verified: not walked at 390x844 on a prod-shaped account yet; the lead walks it). Say it replaces #1442, which the lead will close.
