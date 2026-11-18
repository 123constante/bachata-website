# Review: Website PR #1784 at head cc1c7b29f (B1 picker promo box, money path, read-only)

Repo: bachata-website. You review, you do not change code. Write ONLY docs/review/pr-1784.md on your branch claude/review-1784 and push it (plain git, no gh api).

Do: git fetch origin claude/b1-promo; diff origin/main...cc1c7b29f. Check:
1. Discount maths: per-paid-line previews summed equals what ticket_checkout_reserve_v5 will charge (read the function body from prod via Supabase SELECT on pg_proc, read-only). Free lines never sent; fee only when net above 0.
2. expected_total_pence sent to ticket-checkout equals the discounted total; a held price_changed new_total_pence wins; no path where the client sends a total that the server would accept lower than the real price.
3. Stale code: basket/night/price change re-prices; Remove clears promo_code from the payload; invalid code never leaves a discount in the bar total or payload.
4. Free-after-discount order uses the existing free path with the code attached.
5. Debounce/race: out-of-order preview replies cannot overwrite a newer result (stale response guard).
6. npx vitest run src/modules/tickets passes; npx tsc --noEmit -p . no new errors in touched files.
Headings must be exactly: `## Verdict: PASS` (or `PASS WITH NITS` / `BLOCK`) and `## Hard-tier: PASS` (or BLOCK), reason beneath each. Money path: treat as hard tier.
