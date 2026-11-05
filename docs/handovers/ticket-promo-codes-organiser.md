# Handover: ticket promo codes, organiser section

Branch `claude/ticket-promo-codes-organiser` (from main `0b8762c`). Brief: `docs/briefs/ticket-promo-codes-organiser.md` on `brief/ticket-promo-codes-organiser`.
Inventory: `docs/design/ticket-promo-codes-organiser-INVENTORY.md` (31 rows, gaps G1..G7). Design record + state table: `docs/design/ticket-promo-codes-organiser.md`.

## Done

- `src/modules/organiser/p3/tickets/promo/promoModel.ts`: the ONE mapping (state tag, discount words, uses, end date with full weekday, `LOCKED_WHY`, `REASON_COPY` for every server reason, `validate`, `patchOf` = only changed keys).
- `promo/promoApi.ts`: `ticket_promo_list_v1` / `create_v1` / `update_v1` wire + `usePromoCodes`.
- `promo/PromoSection.tsx`: list, switch, create/edit sheet (a StackSheet layer, portalled next to the tall Tickets sheet), toasts via TicketsEntry's `say` / alert queue, onboarding refusals via `useGatedCopy`.
- `TicketsEntry.tsx`, the exact lines: line 1 (`Suspense` import), lines 48-51 (`lazyWithRetry` import + `const PromoSection = lazyWithRetry(...)`), lines 324-328 (the one mount, inside the list view after `{body}`, only once types have loaded).
- `data.ts`: NOT changed. Why: Home imports it, so a hook there would leave the lazy chunk (INVENTORY G1). The hook is `usePromoCodes` in `promoApi.ts`.
- Outside the Files list, needed for CI: `scripts/onboarding-write-doors.json`. Both promo writes call `_require_onboarding_complete_v1` on prod, so they go in `gated` + wrapper `promo/promoApi.ts`. The live guard reports `gated=10`, which equals the config now (before this change it warned at 8).
- Tests: `__tests__/promo.matrix.test.tsx`, 52 table-driven cases. e2e: `tests/e2e/walk-p3-promo-codes.spec.ts`, 8 walks (390x844 + 320x568, light + dark). It is NOT in `test:e2e:p3`, because package.json is outside Files. Run it by name with the three flags on.

## Verified

- Prod, read-only: live definitions + ACL of the three RPCs (authenticated, DEFINER). Counts: 2 Stripe accounts, 1 series with ticket types, 0 promo rows, 0 orders with a code.
- Unit: tickets folder 211/211. Full `test:unit`: 16 failures in 5 files. 15 of them fail the same way on main (live/network contract tests). `ogBrandedCardLayout` passes when run alone (a load flake).
- `npm run lint`: 24/24 links green. Architecture-guard steps (integrity, legacy-tables, legacy-program-rpcs, lint:architecture, check:images with AUDIT_STRICT=1, plan-hygiene self-test): green. Typecheck-job steps (`check:rpc-typing`, `check:wallclock-brand`): green. `tsc`: no errors in the new files; 109 errors on main stay.
- Bundle: `/app` first load is byte-identical on main and branch with flags off (372.5 KB, 47 files) and with the three ticketing flags on (374.4 KB, 48 files; main is already over its 374 KB budget there). Promo is its own `PromoSection-*.js` chunk.
- e2e: the promo walk 8/8 (boxes inside the viewport, no page scroll on open, no sideways scroll, one create on a double-tap, the sheet not nested or inert). `p3-gate-overlays`, `walk-p3-wt-states`, `p3-toast-geometry`: 10/10.
- `/code-review`: 2 rounds. Round 1 found 9 items, all fixed or documented. Round 2 found none.

## Not verified

- Against a real prod promo row: there are 0. The shapes come from the RPC source.
- Phone test by Ricky. Vercel preview walk. `check:doc-weight` (needs a preview URL). The full `test:e2e` smoke list.
- The `gross_pence` / `discounts_pence` sales line (G2): out of Files, follow-up.
- A code whose only order was released shows unlocked until the server answers `locked_after_use` (G3).

## Next steps

1. Owner: add `tests/e2e/walk-p3-promo-codes.spec.ts` to `test:e2e:p3` in package.json.
2. Follow-up ticket for G2 (sales line with discounts) in `ticketsApi.ts` / `GetPaid.tsx`.
3. After buyer PR #1364 merges: consider merging the two promo rule modules.
