# Handover: R4 cancel refund, slice C (Website)

Brief: branch `brief/r4-cancel-refund-c`, `docs/briefs/r4-cancel-refund-c.md`. Branch `claude/r4-cancel-refund-c`, PR #1860 (bot-opened, body filled). Never merged by the worker.

## Done
- Flag `organiserCancelRefund` (`VITE_ENABLE_ORGANISER_CANCEL_REFUND`, default OFF, needs organiserTicketing) in `src/lib/featureFlags.ts`.
- `src/modules/organiser/p3/door/refundData.ts`: summary read (`organiser_night_refund_summary_v1`), `ticket-refund-night` call (409 changed, per-order results, free_failed), single order via existing `refundOrder`.
- `r4/r4RefundModel.ts` (copy, which cancelled nights: from 28 days back, nearest 3; block shape) and `r4/R4NightRefund.tsx` (block + confirm sheet). `R4Night.tsx` maps the nights under the numbers. `R4Shell.tsx` untouched.
- Tests: `r4/__tests__/r4Refund.matrix.test.tsx` (28). Walk: `tests/e2e/walk-r4-cancel-refund.spec.ts` (manual list in `scripts/check-e2e-spec-coverage.mjs`), shots in `docs/design/organiser-round4/shots/refund-*.png`.
- One /code-review round (medium); all findings fixed (door list no longer hidden: prod `_ticket_door_night_at_v1` picks only scheduled nights; unclear outcomes not called failures; 409 + failed re-read; free_failed; unknown amount; money cache invalidated; shared nameOf).

## Left / gaps
- Refunded chip in the guest list NOT shipped: `ticket_door_list_v3` rows have no order_id. Needs an admin change (order_id or refunded flag on door rows).
- Nights cancelled > 28 days ago get no block (`REFUND_LOOKBACK_DAYS`).
- Not walked on the flag-on Vercel preview or the seeded WALK org; no prod order sits on a cancelled night today.
- `npm run lint`: only `check:no-social-word` red, pre-existing on main (files not in this PR).

## Next steps
- Owner: set the flag on a preview, walk a cancelled night on the WALK org (refund endpoint stays mocked / test mode).
- CI on PR #1860 was in progress at hand-off.

tsc run on 03d4a34: 0 errors in branch files (npm run typecheck; repo total 141 pre-existing, none in branch files).
