# Brief: review-1236-r1 (docs only; branch claude/review-1236-r1; Opus reviewing a Sonnet build)

Independent review of Website PR #1236 (head 45b42bc56, branch claude/p3-organisers-gate): F-10 organisers half (SeriesOrganisers on P3 routes refusals through the shared gate hook so `onboarding_incomplete` opens the "A few details first" sheet) and F-46 (P3 Welcome shows recent declined requests with date, answerer's note, and what the person can do). You change NO code on that branch. Your only push is docs/review/pr-1236-r1.md on claude/review-1236-r1.
Read: `git fetch origin claude/p3-organisers-gate` then `git diff origin/main...FETCH_HEAD`; the acceptance rows in docs/design/p3-acceptance/FIXLIST.md (F-10, F-46).
Questions:
1. Does the diff meet F-10 and F-46 as written? Any copy that points at a control not on screen; does every state say what the person CAN do; is anything shown to the wrong person (a declined request's note visible to someone it does not belong to)?
2. Mutation: remove the gate wiring, change the 30-day window, drop the note mapping, show granted rows as declined. Which mutants do the new tests miss?
3. Data shapes: read-only SELECT (Supabase project stsdtacfauprzrdebmzg, counts only, no personal data): how many declined requests exist, how many with a decision note, any older than 30 days, any person with two pages or a granted plus a declined. Is any shape unhandled?
4. Does R1 (the old area) still behave as before? Is the bundle budget untouched (zero bytes to /app first load)?
5. Run the vitest suites the PR touches and `npm run check:bundle-budget`; say what is inherited from main.
Output: verdict PASS / PASS WITH NITS / BLOCK, findings F1.. with file:line and a concrete failing scenario, honest Verified / Not verified. Commit subject ends [worker-done <ticket>].
