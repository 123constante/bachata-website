# Handover: B1 ticket picker promo box (claude/b1-promo, PR #1784)

Brief: `brief/b1-promo:docs/briefs/b1-promo.md`. Flag `ticketPickerB1` untouched (still OFF in prod). No Vercel env change.

## Done
- `TicketPickerB1.tsx`: the stub ("Promo codes are not available yet.") is gone. The always-open promo box now uses
  the classic page's validation, i.e. `previewPromo` -> `ticket_promo_preview_v2`. No new RPC was added.
  - B1 is a multi-type basket and the preview RPC prices one type, so `pickerPromo.ts` previews **each paid
    line** (type, quantity, code, night) in parallel and sums the discounts. That matches
    `ticket_checkout_reserve_v5` (read from prod): per-line `_ticket_promo_unit_discount_v1 x qty`, summed, with
    the fee per ticket only on a net above 0. Free lines are never sent.
  - Valid: a ticket-stub row shows the code, `-£x` and Remove. The keyboard closes (blur on Apply). "Checking…"
    shows while the code is checked. The old total is struck beside the new one in the bottom bar. One buzz (30 ms).
  - Invalid: red reason text (the shared `promoReasonCopy`), a double buzz, and a "Remove the code" control,
    because Continue's blocked line says "Remove the promo code…".
  - Re-validation: any change of basket, night or list price re-prices an applied code, debounced 400 ms (a run of
    stepper taps makes one check). With only free tickets left, the code is refused with `no_paid_lines` (copy in `promo.ts`).
  - Checkout: `buildPickerBody` sends `promo_code` plus `expected_total_pence` = the discounted total, the same
    contract as the classic page. A held price_changed total wins, since the server's `new_total_pence` already
    carries the discount. A 409 code refusal at checkout lands in the promo box. A free-after-discount order
    takes the existing free path (`/tickets/thanks?o=…&free=1`).
- Tests: `__tests__/pickerPromo.test.ts` (pure) and `__tests__/ticketPickerB1.test.tsx` (empty, nothing picked,
  valid, invalid + Remove, remove, re-validate on quantity change, debounce, free-only refusal, body + 409, free path).
- Screenshots at 390x844 (DPR 2): `docs/handover/b1-promo-shots/` (1-empty, 2-invalid, 3-checking, 4-valid, 5-revalidated).

## Left / known limits
- **below_minimum per line**: each line is previewed on its own. A code that leaves one line at 1-29p net is refused
  ("under 30p") even when the basket total would be fine. The reserve checks the minimum on the whole basket. This is
  rare (it needs a fixed code just under a ticket price). The server is the authority at checkout either way.
- A basket with N paid lines makes N preview calls per check (debounced). Each refused preview may count toward
  the preview limiter N times.
- The screenshots come from a stand-alone harness that mounts `TicketPickerB1` with mocked RPC replies, not the
  deployed `/event/:id` page. In that harness the `<h1>` title did not show. That code is unchanged by this PR;
  worth a look on the preview with the flag on.

## NEEDS ADMIN
- Nothing required. Optional: a basket-level preview RPC (`p_lines jsonb`) would remove the per-line
  below_minimum limit above and cut the N calls to 1.

## Checks
- tsc run on the final head (tsconfig.app.json): 0 errors in branch files. vitest src/modules/tickets: 917 passed. check:mojibake: clean.

## Next steps
- Owner: try it on a Vercel preview with `VITE_ENABLE_TICKET_PICKER_B1=true` (preview env only) and the live 10% code.
