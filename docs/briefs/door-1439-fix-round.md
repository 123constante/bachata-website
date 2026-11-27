# Brief: ONE fix round for Website PR 1439 (door refused card)
Branch: claude/door-no-access-dead-end (the existing PR branch). Lane: normal. Sonnet. Push ONCE.

## Goal
The independent review (docs/review/review-door-raffle-1439-1429.md on branch claude/review-door-raffle-1439-1429, head 746fa2cb) passed with three fixes. Apply them. Stopping rule: this is the one fix round; then the lead walks it.

## Fixes (from the review; read it first)
1. Offline recheck is silent. In src/modules/organiser/p3/door/DoorScreen.tsx (about lines 130-139) a failed list.refetch() shows nothing. React Query refetch() resolves with isError, so read r.isError and show a one-line "No signal, try again" under the button. The then_network cell in door.noAccess.matrix.test.tsx today asserts no alert: change it to assert the message (red first).
2. Mixed line endings in DoorScreen.tsx (474 CRLF, 4 LF, two lone CR near lines 186 and 190). Re-save with one consistent ending through scripts/safe-write.py. Check: git diff --ignore-cr-at-eol --stat equals plain --stat, and the count of bare CR is 0. Match what main uses.
3. Check again can wrongly clear a refusal that came from a typed or scanned code. Make Check again clear the card only when the refusal came from the list read; for a refusal from a check-in, keep it and say so in the copy. Update the matrix test typed shape accordingly.

## Do NOT touch
supabase/**, workflows, .env*, calendar density-exempt files, perf-budgets.json, vite.config.ts. Zero bytes added to dancer-app first load (npm run check:bundle-budget on main and the branch). Never add run-ci yourself.

## Done when
One push; 390x844 geometry asserted by the matrix test (taps >= 44px, no sideways scroll); PR body "Verified / Not verified" updated with the checks run; last commit subject ends with the [worker-done ...] marker.
