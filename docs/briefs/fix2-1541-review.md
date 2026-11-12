# Fix 2 for website PR #1541 (branch claude/ticket-money-visible), money class
Re-review FAIL at head cbf89da, one blocking finding (see the latest REVIEW FAIL PR comment):
1. parseSummary (src/modules/organiser/tickets/ticketsApi.ts) keeps `_pence` fields when `money_visible` is absent. Change to `countsOnly = opts.money === false || moneyVisible !== true` so a missing flag yields counts-only and zeroed pence.
2. In moneyVisible.matrix.test.ts flip the row "old server, field missing, owner" to expect NO pence (zero), matching the brief.
3. Non-blocking, do it if small: when summary.isError, fall back to a counts read so the orders query is not disabled forever and `checking` clears; add one test row.
Run only the touched test files: node ~/.claude/bin/dell-run.mjs website <sha> -- npx vitest run <files>. Keep PR body Verified block. Final commit subject ends "[worker-done <ticket>]".
