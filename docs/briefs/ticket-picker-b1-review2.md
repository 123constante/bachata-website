# Review round 2: PR #1747 ticket picker B1 (money path, read-only review)
Review branch feat/ticket-picker-b1 at head d844c9911 against origin/main. Do NOT change code. Write your verdict as `docs/review/pr-1747-review-r2.md` with PASS / PASS WITH NITS / FAIL and a `Hard-tier PASS` line only if justified. Push only claude/review-1747-r2.
Round 1 (read it: git show origin/claude/review-1747:docs/review/pr-1747-review.md) found: terms-of-sale missing, price_changed unhandled, 20 cap, wire test gaps, OTP copy, origin guard. Fix handover: docs/briefs/ticket-picker-b1-fix1-handover.md on the PR branch.
Check:
1. Each of the 6 round-1 findings is really fixed in code (file:line), not only in the handover.
2. Money path: request body to ticket-checkout (lines[], expected_total_pence, no client-trusted price, no promo key); price_changed hold uses the server total; whole-order cap 20.
3. Terms checkbox gates Continue; preview-origin guard blocks before any email is asked.
4. Tests assert the full wire body: mutate one price or quantity in the source and confirm a test fails.
5. Flag OFF leaves the classic page unchanged.
Findings with file:line. ONE round. Reply Verdict + Hard-tier block as dispatch-worker appends.
