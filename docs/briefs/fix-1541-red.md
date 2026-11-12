# Fix red on PR #1541 (claude/ticket-money-visible)
Class: FIX-RED, careful lane (money_visible / refund gating; do NOT change prices, refunds or payout behaviour beyond what the PR already does).
- Check out the PR branch, merge origin/main into it if behind.
- Failing check: `unit (Europe/London, full)`. Reproduce with `npm run test:unit`, find the failing test(s), fix the cause (test or code) on the same branch. Same PR, no new PR.
- Run `npm run pre-ship`; put the per-job CI table and a Verified / Not verified block in the PR body.
- Do not merge or approve; money PR is owner-reserved.
