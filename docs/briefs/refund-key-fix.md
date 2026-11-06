# Brief: partial refund UI, fix round 2 (idempotency key kept on bare 503/404)

Brief-version: 2
Branch: claude/ticket-partial-refund-ui (ALREADY open as PR #1458 at head a42e2e95; continue on it, do not recreate). Careful lane (money path), Sonnet, one push. No `supabase/**`. Server (admin ticket-refund v12) is live and must not change.

## Decisions
Independent review (MED, money): ticketsApi.ts:216 and ticketModel.ts:539 read ANY HTTP 503 or reasonless 404 as `not_configured`, which DROPS the idempotency key (RefundSheet.tsx:124-137, endsRefundPress ticketModel.ts:525-539). A gateway 503 after the edge function already reached Stripe makes the next tap a new key and a possible second partial refund.
Fix: drop the key for not_configured ONLY when the response body states `not_configured`. A bare 503 or 404 (no body, no reason) keeps the key, treated like any non-definite error (same as stripe_error/internal_error/unknown).
Do NOT change: the amount stays editable while a key is held (LOW; the warning line covers it; note in PR body). Keys lost when refundedPence updates is acceptable (note in PR body).

## What main lacks
- extends: bare 503/404 must keep the idempotency key, only a body stating not_configured drops it -- #1458

## What to build
0. Write INVENTORY.md first (docs/design/ticket-partial-refund/INVENTORY.md if present, update it): each place that maps an HTTP status or reason to `not_configured` or ends a refund press, with file:line, plus coverage count (covered / total) at the end. No design work.
1. Test first, red against head a42e2e95, then fix. Table test over: 503 no body, 503 with not_configured body, 404 no body, 404 not_configured body, network error, unknown code, success, refund_exceeds_balance, request_id_reused. Assert for each whether the key is kept or dropped (dropped only for success, not_configured-in-body, refund_exceeds_balance, request_id_reused; kept for bare 503, bare 404, network error, unknown). Put it in the existing refund tests (ticketModel.matrix.test.ts / ticketsApi.wire.test.ts / refund.partial.test.tsx).
2. Fix ticketsApi.ts near line 216 and ticketModel.ts near line 539 so status alone never yields not_configured.
3. Run `npx vitest run src/modules/organiser`, `npx tsc -p tsconfig.app.json --noEmit` (error count not higher), `npm run check:mojibake`.
4. PR body keeps "## Verified on real data" and "## Phone QA" (390x844). Not verified: a real Stripe partial refund, the 390x844 walk. Note the two accepted LOW items above.
5. Commit `fix(tickets): keep refund key on bare 503/404 [worker-done <ticket>]` and push ONCE.

## Files
- src/modules/organiser/tickets/ticketsApi.ts
- src/modules/organiser/tickets/ticketModel.ts
- src/modules/organiser/p3/tickets/RefundSheet.tsx
- src/modules/organiser/tickets/__tests__/ticketModel.matrix.test.ts
- src/modules/organiser/tickets/__tests__/ticketsApi.wire.test.ts
- src/modules/organiser/p3/tickets/__tests__/refund.partial.test.tsx (new)

## Done when
Every table row passes; the bare-503/404 rows failed before the fix; tsc count not higher; organiser tests pass; one push.
