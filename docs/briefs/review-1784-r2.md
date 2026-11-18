# Review (delta): Website PR #1784 at head 9a7e44842 (B1 picker promo, money path, read-only)

Repo: bachata-website. You review, you do not change code. Write ONLY docs/review/pr-1784-r2.md on your branch claude/review-1784-r2 and push it (plain git, no gh api).

Prior review (round 1, head cc1c7b29f): docs/review/pr-1784.md on origin/claude/review-1784. Hard-tier PASS, Verdict BLOCK on B1 (+ then - inside the 400 ms debounce left the code stuck on Checking). Nit N1: a held price_changed survived Apply/Remove.
Fix commit ca92da0eb (then main merged at 9a7e44842). Only src/modules/tickets/TicketPickerB1.tsx and src/modules/tickets/__tests__/ticketPickerB1.test.tsx changed.

Do: git fetch origin claude/b1-promo; git diff cc1c7b29f 9a7e44842 -- src/modules/tickets. Check:
1. B1 fixed: back on the priced key while status is checking restores the last applied answer; no extra preview request; Continue unblocked.
2. lastApplied ref cannot restore a stale answer (key mismatch, after Remove, after a refused re-price). The restore must never show or send a discount priced for a different basket.
3. setHeld(null) on Apply/Remove does not drop a legitimate held price_changed in a way that sends a wrong expected_total_pence (checkpoint (b) exact match stays the guard).
4. The regression test fails on cc1c7b29f and passes on the head (run it in a scratch worktree; do not commit).
5. No new money-path risk; hard-tier assessment.
Headings must be exactly: `## Verdict: PASS` (or `PASS WITH NITS` / `BLOCK`) and `## Hard-tier: PASS` (or BLOCK), reason beneath each.
