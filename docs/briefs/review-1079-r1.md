# Brief: independent review + design critique of PR #1079 (P3 W-T ticketing, Website, normal lane)

Review only; do NOT change product code. Branch `claude/review-1079-r1` carries one file `docs/review/pr-1079-r1.md`. Different model from the builder on purpose. Context cap 30%: split work rather than run long; push early.

Target: branch `claude/p3-wt-ticketing`, head 84567dd (fetch it). Read `docs/design/p3-wt-ticketing.md`, `docs/handover/p3-wt-ticketing.md`, `docs/briefs/p3-wt-ticketing-phase-b.md` (on branch brief/p3-wt-ticketing) and mockup `mockups/p3-wt-ticketing/C-tickets-sheet.html` (owner pick: one tall sheet).

## Part 1: code review (focus: round-2 fixes 965765c are UNREVIEWED)
Scope `src/modules/organiser/p3/tickets/**`, `p3/shell/youTickets.tsx`, the small wiring in EventPage/HomeScreen/P3Routes/p3.css. Look for: stacked-sheet focus and Escape bugs, a refund or switch that can double-fire, a late outcome landing on a closed sheet, a draft that survives or leaks, money copy that is wrong (fee, totals, refund), anything reachable when the flags are off (organiserP3, organiserTicketing, organiserSelfServe), a contributor/non-manager seeing a working control. Run the p3 tickets tests and mutate one fix to show a test goes red.

## Part 2: Design Gate stage 5 critique against mockup C
Use the impeccable-finish-reviewer approach: compare shipped screens (read the TSX + CSS; you cannot walk) to the mockup: tap targets >= 44px (explicit px, not rem; site html font is ~13.5px on phones), contrast >= 4.5 on P3 cream/terracotta tokens, no clipping at 390x844, every empty/loading/error/disabled state actionable and saying why, copy ("You > Get paid" wording, Home prompt "Get paid for tickets"), HTML entities not raw Unicode in JSX, no new colour seams, no density-exempt calendar files touched.

## Output
Verdict PASS / PASS with should-fix / FAIL; findings ranked with file:line and a concrete failure scenario each. Push early; last commit subject ends `[worker-done dt_<ticket>]`. No merge/approve.
