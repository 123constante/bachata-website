# T3 price-steps editor: handover

Branch `claude/ticket-t3-steps-editor`. Brief: `docs/briefs/ticket-t3-price-steps-editor.md` on `brief/ticket-t3-steps-editor`. Flag: `ticketPriceStepsEditor` (`VITE_ENABLE_TICKET_PRICE_STEPS_EDITOR=true`, needs `organiserTicketing`). Do not merge: money lane.

## Done
- `src/modules/organiser/tickets/priceSteps.ts`: the pure model. It holds the copy, `parseManage`, the London-time rules (spring time refused, autumn time resolves to the later GMT instant) and `buildStepCommand`. An untouched move returns null and keeps the stored instant.
- `ticketsApi.ts`: `fetchManagedTypes`, `setPriceStep`, `removePriceStep` (untyped rpc).
- `p3/tickets/PriceSteps.tsx`: the block on step 1 of `TypeSheet`. It offers add, move and remove (remove asks first). Add is disabled with a reason at 3 steps. Free types are refused with a reason. It shows the orders note, keeps the draft on `reserve_not_ready`, and freezes a live step.
- `TypeSheet.tsx`: reads `ticket_types_manage_v1` only when the flag is on, the type exists and the person can change it. A type with steps cannot be made free (s.2b). The `has_price_steps` refusal is mapped.
- `scripts/onboarding-write-doors.json`: both step writers are in `not_event_writes`. The live guard gated count is 10 without them.
- Tests:
  - `p3/tickets/__tests__/priceSteps.matrix.test.tsx` (23).
  - `tickets/__tests__/priceSteps.model.test.ts` (23).
  - The R3-7 mutant (seed from summary) goes red.
  - The review fixes (autumn untouched move, remove `step_in_past`) are red on the pre-fix code.
- Walk: `tests/e2e/walk-ticket-t3-price-steps.spec.ts` (390x844 and 360x640, 6 pass), registered in `check-e2e-spec-coverage.mjs`.
- An independent review found 2 should-fix items and 2 nits, all fixed (details are in the PR body).

## Left / next steps
- Owner Approve, then turn on the flag on a preview and walk it on a phone with a real paid type (prod has 0 steps). The first real step write happens there.
- Once the guard's live gated count includes the step writers, move them from `not_event_writes` to `gated` and to the `ticketsApi.ts` wrapper list.
- T5 (course create, early-bird presets) and T4 (buyer side) are out of scope.

## Not verified
- No real write of a step against prod (the connector is read-only).
- Screenshots are not attached to the PR (the cloud worker cannot upload them).
- The double-tap test passes on the pre-fix code too, because testing-library re-renders between clicks.
- tsc was run on the branch: 0 errors in branch files.
