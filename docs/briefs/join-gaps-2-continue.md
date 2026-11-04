# join-gaps-2 continuation (wire the count, walk, CI steps, PR body)

Branch `claude/fix-join-gaps-2` (head c5d3af625, PARTIAL). Lane normal, Sonnet. FIRST read `docs/design/join-gaps-2/HANDOVER.md` and `INVENTORY.md` on the branch and the original brief `brief/join-gaps-2:docs/briefs/join-gaps-2.md`. Do ONLY what is left; start by merging `origin/main` into the branch (main moved: #1311, #1313 etc.), keep both sides.

## Lead decisions (owner goal: 10 real organisers claim a page and edit an event themselves)
1. Item 7 (Done page promise): wire the REAL rows-left count from the join flow into the Done page (the handover says JoinPage passes null, so the details-first sentence always shows). The sentence must match what the person really faces next: 0 rows left says the page is theirs; N rows left says a short set of details first, using the one `graceModel.timePromise(rowsLeft)` source (merged in #1305). Never a promise the gate then breaks.
2. Item 6 (Request sent): the request goes to the team, not only the inviter. Make the button label and the result say so truthfully, using only what the data proofs in the INVENTORY show; no invented time. Log the final wording in the handover.
3. Item 5: the site-wide "Finish your profile" banner stays hidden on `/invite/*` only; unchanged everywhere else; 0 bytes to /app first load.

## What is left
1. Item 7 wiring + red-first test rows (every rows-left value 0, 1, 3, 6, 10 x Done page, flag ON and OFF routes).
2. Browser walk at 390x844 (mocked; reuse `tests/e2e/walk-join-gaps-1-pr1305.spec.ts` from branch `claude/walk-join-gaps-1-pr1305`): About with/without the banner, Request sent (before and after), Done page at 0/3/10 rows left, revoked link (legacy page and join page). OPEN EVERY PICTURE; an error card or blank picture is a FAIL; one line per picture in `docs/walk/join-gaps-2/RESULTS.md`.
3. Gates: `npm run lint`, unit tests for join + p3 + lib, `check:bundle-budget` main vs branch (0 bytes to /app first load; never edit perf-budgets.json or vite.config.ts), `check:integrity`.
4. PR body (the PR exists, bot-opened): `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` each with text on the SAME line, and a `## Phone QA` section with `- Sizes checked: 390x844`, `- Walked: ...`, `- Not verified: ...`.
Push once when coherent; never add run-ci. Last commit ends `[worker-done <ticket>]`, final push without [skip preview]. Stop at 50% context with a handover.
