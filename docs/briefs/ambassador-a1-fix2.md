# A1 fix round 2: PR #1086 (branch claude/ambassador-a1-build)

Continue on the SAME branch. Read `docs/reviews/review-1086-r2.md` (branch `claude/review-1086-r2`): verdict BLOCK for ONE finding, "r1 F2 overlay geometry". Also read the overlay finding in `docs/reviews/review-1086-r1.md`. Lane normal, Opus. Fix only the items below; add a "Fix round 2" section to `docs/design/ambassador-a1-build.md`.

## Must fix (blocker)
1. The decision sheets (`SheetShell` in `DecisionSheets.tsx`) and the success toast (`AmbassadorQueuePage.tsx`) are `fixed` inside the route shell, and `PageTransition` leaves `filter: blur(0px)` on `.route-shell`, so the shell becomes their containing block. Measured at 390x844: after Approve the toast is at y 1000-1038 (off screen); after a refusal the page stays scrolled 661 px with "Back to the list" 291 px above the top. Fix: `createPortal` the sheet shell and the toast to `document.body`; replace `autoFocus` with `focus({ preventScroll: true })`. Add a Playwright assertion in `tests/e2e/ambassador-queue.spec.ts` at 390x844 with a FLOWING clock (not fixed) that: the sheet's bounding box covers the viewport, the confirm button is inside the viewport, scrollY is unchanged by opening a sheet, and after a successful approve the toast's bounding box is fully inside 0..844. Run it red against the current code first, then green.

## Should fix (cheap, do them)
2. Replace raw `…` and `·` in `DecisionSheets.tsx`, `QueueViews.tsx`, `ambassadorModel.ts` with `&hellip;` / `&middot;` in JSX and `…` / `·` escapes in TS strings.
3. NULL `price_currency` copy: "(mixed currencies)" becomes "(currency not given)".
4. `NO_ACCESS` must not match the bare word `permission`: a grant failure should fall to the "something went wrong" copy, not claim the account is not an ambassador.
5. Two full cities in the 100-cap copy: "the first 100 in each of Bath and Bristol".

## Do not
No other changes. No DB/admin work. Do not chase `bundle-budget` or DB Contract Check (red on main). Run ambassador unit tests, the e2e spec, lint, tsc; push once.
