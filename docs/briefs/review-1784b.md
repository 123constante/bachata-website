# Delta review: Website PR #1784 at head 9a7e44842 (B1 picker promo, money path, read-only)

Repo: bachata-website. You review, you do not change code. Write ONLY docs/review/pr-1784b.md on your branch claude/review-1784b and push it (plain git, no gh api).

Context: the earlier review (origin/claude/review-1784, docs/review/pr-1784.md, head cc1c7b29f) said hard-tier PASS but BLOCK on one bug: promo box stuck on "Checking" after + then - inside the debounce. The builder fixed it in commit ca92da0eb (lastApplied restore, setHeld(null) on Apply/Remove, regression test); head 9a7e44842 only merges main on top.

Do: git fetch origin claude/b1-promo claude/review-1784; read the earlier review; git diff cc1c7b29f ca92da0eb (2 files: TicketPickerB1.tsx, ticketPickerB1.test.tsx). Check:
1. The stuck-Checking bug is gone: trace + then - inside the debounce; the box returns to its prior applied/idle state, never stays Checking.
2. N1 nit from the earlier review is handled or still harmless.
3. setHeld(null) on Apply/Remove cannot drop a real server price_changed total: expected_total_pence sent to ticket-checkout is still the discounted total, or the held new_total_pence when one is held. No path sends a total the server would accept below the real price.
4. A stale preview reply still cannot overwrite a newer one; Remove still clears promo_code from the payload; invalid code leaves no discount.
5. The regression test fails without the fix (reason it through) and npx vitest run src/modules/tickets passes if you can run it.
Headings must be exactly one line each: `## Verdict: PASS` (or `PASS WITH NITS` / `BLOCK`) and `## Hard-tier: PASS` (or BLOCK), reason beneath. Put `head 9a7e44842882213d95c519d34782dc6cc6e50d20` in the first line. Money path: hard tier.
