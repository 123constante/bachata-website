# p3-gate-guard-1 (fix: gate Continue is blocked by "Leave without saving?")

Branch `claude/p3-gate-guard-1` from main (after #1306 merged at 0ba8d6c). Lane normal, Opus (save/navigation path). Website repo only, no database change.

## The failure (found by the walk of #1306; pictures on branch `claude/walk-gate-retry-1-pr1306`, docs/walk/gate-retry-1-pr1306)
On Details and Prices, when the first-edit gate refuses a Save (`onboarding_incomplete`), the "A few details first" sheet opens. The person taps Continue. A SECOND sheet, "Leave without saving?" (it lists their typing and offers "Leave and lose them"), appears before the checklist. That is wrong: the typing is kept and comes back with "We kept your changes". The picture is `P1-gon-details-2b-leave-guard.png` (also P1 prices, P3a details and prices). The check that would have caught it: a test that taps the gate Continue on a dirty Details/Prices screen and asserts the checklist opens with no leave sheet.
Also from the same walk: the event-name field in Details is 42px high (taps must be 44px+; `screens/DetailsScreen.tsx:85`), and the cell "status read failed, gate on" (P8) never reached the checklist (the mock may be dishonest: check first and say which).

## Step 0: INVENTORY (write `docs/design/p3-gate-guard-1/INVENTORY.md` before any edit)
Every way a person leaves Details/Prices (Events tab, phone Back, Back link, gate Continue, gate Not now, Save success) x dirty/clean x gate refused/not: what each does today (file:line, `screens/EditTray.tsx` GuardedBack and useBackToEvent, the gate host) and what it must do. Coverage count at the end: N rows, N shown, none omitted.

## Build
1. When the gate's Continue is tapped on a dirty Details/Prices screen, leave WITHOUT the leave sheet, because the draft is stored (`onboarding/keptDraft.ts`). Every other exit keeps the sheet. Nothing is sent or replayed by this.
2. Name field at least 44px high; check the other fields on the two screens.
3. P8 (gate on, status read failed): make the walk's mock honest (the checklist needs the status read; the sheet already says "We couldn't load your details. Try again."). If the product also cannot reach a checklist, the Continue should say so in words and keep the typing; decide, log in the handover.

## Tests (red first, output kept)
Table-driven: exit x dirty/clean x refused/not, one shared mapping; the new rows fail on main. Mutants: leave sheet shown on gate Continue; leave sheet hidden on Events tab / Back while dirty (both must be killed by a test). Update `gateRetry.matrix.test.tsx` rather than a new file where it fits.

## Walk (390x844, mocked, reuse tests/e2e/walk-gate-retry-1-pr1306.spec.ts from that branch)
P1 and P3a x Details and Prices x gate on: refuse, Continue, checklist (no leave sheet), Back to your event, typing kept; plus the Events tab/Back/Back link with typing still shows the leave sheet. OPEN EVERY PICTURE; an error card or blank picture is a FAIL. RESULTS.md one line per picture.

## Gates and rules
`npm run lint`, unit tests for p3, `check:bundle-budget` main vs branch (0 bytes to /app first load; never edit perf-budgets.json or vite.config.ts), check:integrity. PR body needs `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` each with text on the SAME line, and a `## Phone QA` section with `- Sizes checked: 390x844`, `- Walked: ...`, `- Not verified: ...`. Push once when coherent; one independent review is the orchestrator's call; one fix round max. Last commit ends `[worker-done <ticket>]`, final push without [skip preview].
