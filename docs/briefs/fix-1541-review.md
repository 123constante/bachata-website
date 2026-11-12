# Fix review FAIL on website PR #1541 (branch claude/ticket-money-visible)
Money class. Read the REVIEW FAIL comment on the PR (items 1-6) and fix all of it on the existing branch, same PR:
1. Gate on `moneyVisible === true` everywhere (GetPaid.tsx MoneySoFar, TicketsSoldTile, TicketsEntry showMoney). Missing/null flag = counts-only. Update the "old server, field missing" matrix row to expect NO pence.
2. While the summary is loading/undefined, showMoney is false; do not fire the orders read with ORDER_SELECT_MONEY until the summary resolves true. No money query-key cache leak.
3. Refund button, RefundSheet and COUNTS_ONLY_NOTE gate on showMoney as well as role.
4. Add table-driven rows: flag missing, summary loading, manager/contributor x money_visible, Refund button/RefundSheet when false. Missing flag and loading must show no pound amounts and no Refund.
Run the unit tests for these files via: node ~/.claude/bin/dell-run.mjs website <sha> -- npx vitest run <files>. PR body keeps its Verified block. Final commit subject ends "[worker-done <ticket>]".
