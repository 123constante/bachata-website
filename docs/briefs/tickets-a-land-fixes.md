# Brief: land walk + CI fixes on PR #1734

Branch to work on: `feat/organiser-tickets-a` (PR #1734, do not open a new PR).
Source: branch `claude/tix-a-walk-fix` holds 6 commits over that branch (e9a438c84..d73fcf29c).

Do:
1. `git cherry-pick e9a438c84^..d73fcf29c` onto `feat/organiser-tickets-a` (resolve conflicts if any; keep \u escapes in `src/modules/organiser/p3/tickets/a/TicketsA.tsx`).
2. In `tests/e2e/walk-tickets-a.spec.ts` delete the two leftover debug lines: `console.log('NOW', ...)` and `console.log('BODY', ...)`.
3. Run unit test `src/modules/organiser/__tests__/consistency.matrix.test.tsx` (it was red on raw Unicode punctuation, B-N8). Must pass.
4. Edit the PR #1734 body: fill the Phone QA section and the "Verified on real data" block. Facts: Dell walk at 390x844 (tests/e2e/walk-tickets-a.spec.ts) 8/8 pass; heights exit 45, top 53, tabs 64 (all >= 44); no page scroll; contributor seat shows no money. Not verified: real phone, live Stripe.
5. Push, end the final commit subject with your [worker-done <ticket>] marker.
Do not merge.
