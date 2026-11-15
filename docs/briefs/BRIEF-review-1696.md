# Review PR #1696 (Website): ticket reserved_count off the client

Repo 123constante/bachata-website. PR #1696, branch claude/reserved-count-off-types, head c1fe43d40fd65ad7d098452b456f5b636f09aa7a.
You are an independent reviewer. Do not edit product code. Review only.

## What the PR claims
`ticket_types.reserved_count` drops on a refund, so a seat with no money role could see a refund happened. The PR removes that column from the client select (`TYPE_COLS` in `src/modules/organiser/tickets/ticketsApi.ts`) and sources `reserved` from `ticket_sales_summary_v1`, which adds refunded tickets back for non-money seats. While the count is unknown (`reservedKnown: false`) nothing is decided on it: `moveBlock` to on_sale refuses, TypeSheet Save is disabled on a saved type. A new ticket never waits.
After deploy, the admin repo will REVOKE SELECT(reserved_count) from authenticated. A client read of that column after the revoke would 42501, so this PR must leave NO remaining read of it.

## Check, with file:line evidence
1. Grep the whole repo (src, supabase/functions, tests, scripts) for every remaining read of `reserved_count` from `ticket_types` by an authenticated client: `.select('*')`, `select(...)` lists, embeds (`ticket_types(...)`), realtime, views read by the client. Any hit = BLOCK.
2. `withReserved` / `useSeriesTypes`: is every path where `reservedKnown` is false covered (summary pending, error, type missing from summary)? Any path that treats unknown as 0 and so allows a capacity cut below sold, or a go-on-sale = BLOCK.
3. Money seat vs non-money seat: owner numbers unchanged; non-money seat gets raw + refunded_qty (stricter floor, never looser). Confirm against the RPC body if the migration is in the repo.
4. Are public/door/checkout surfaces untouched and unaffected?
5. Tests: do the new matrix tests actually fail if the fix is reverted? Run `npx vitest run src/modules/organiser/p3/tickets src/modules/organiser/tickets` in a checkout of the head.
6. The five walk-spec mock edits: do they match the live RPC shape?

## Required output
Write the review to docs/review/review-1696.md on branch claude/review-1696 (from main).
The file must:
- name "PR #1696" and, in the first 10 lines, the literal text `head c1fe43d40fd65ad7d098452b456f5b636f09aa7a` (word "head", one space, then the sha)
- list findings
- contain, on its own lines, EXACTLY:
  ## Verdict: PASS            (or: ## Verdict: PASS WITH NITS | ## Verdict: BLOCK)
  ## Hard-tier: PASS          (or: ## Hard-tier: FAIL with reason)
Push once. Last commit subject ends with [worker-done <ticket>].
