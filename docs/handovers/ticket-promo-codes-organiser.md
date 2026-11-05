# Handover: ticket promo codes, organiser section

PR #1366. Branch `claude/ticket-promo-codes-organiser` (from main `0b8762c`). Brief: `docs/briefs/ticket-promo-codes-organiser.md` on `brief/ticket-promo-codes-organiser`.
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
- A code whose only order was released still shows unlocked in the list until the server answers `locked_after_use`; round r1 handles the answer (see below).

## Next steps

1. Owner: add `tests/e2e/walk-p3-promo-codes.spec.ts` to `test:e2e:p3` in package.json.
2. Follow-up ticket for G2 (sales line with discounts) in `ticketsApi.ts` / `GetPaid.tsx`.
3. After buyer PR #1364 merges: consider merging the two promo rule modules.

## Fix round r1 (brief fix-1366-r1, on the independent review at d1b2357)

Done, all inside `promo/**` and its tests:

1. Wire test `__tests__/promo.wire.test.ts` mocks the Supabase client `rpc` (not promoApi) and pins: list `ticket_promo_list_v1 {p_event_series_id}`; create `ticket_promo_create_v1` with the 7 `p_` args; update `ticket_promo_update_v1 {p_id, p_patch}`; deactivate = exactly `{active:false}`; patch keys only from active/expires_at/max_uses/kind/value.
2. `react-hooks/refs` (5 errors) gone from `PromoSection.tsx`: the host layer is read in a callback ref into state; the in-flight set is `useState(() => new Set())`. Behaviour unchanged. `npx eslint` on promo/** and both promo tests: 0 problems.
3. Matrix rows added in `promo.matrix.test.tsx`: fixed 0 / 0.00 / 1000.01 refused, 1000 / 1000.00 / 0.01 accepted, 100000 accepted / 100001 refused pence; max_uses 0 refused (create and edit); untouched save on a fixed code (shows 2.50, sends nothing); literal copy for all 9 reasons plus NETWORK and sign-in; `isLocked` both halves (pending-only, paid-only); the list is re-fetched after a successful save (and not after an untouched one).
4. Signed out: a thrown 42501, "not signed in" or `authentication_required` now says `Your sign-in ended. Sign in again.` (the app's `SESSION_ENDED`, re-exported as `SIGNED_OUT`), in the sheet, the row switch and the closed-mid-save alert. No login flow added.
5. Locked-after-use race: on `locked_after_use` the section remembers the code as locked and refetches the list; the row shows `LOCKED_SHORT`, the sheet disables kind/value, puts the discount back, and a retry sends nothing for kind/value. Note: the list itself cannot see a released order, so the remembered flag (not the refetch) is what makes the row locked; it lasts until the page reloads.

### Mutant table (recreated by hand in a scratch pass; mutants not committed; `python3` swap-and-restore, promo tests run per mutant)

I did not have the reviewer's M-numbers or files, so these are my own mutants of each listed behaviour. All 24 below were run against `npm run test:unit -- src/modules/organiser/p3/tickets/__tests__/promo`.

| Mutant | Result |
|---|---|
| W1 wrong list RPC name | KILLED |
| W2 create wrong p_event_series_id | KILLED |
| W3 create wrong p_expires_at | KILLED |
| W4 update wrong p_patch | KILLED |
| W5 update wrong arg name (`id` for `p_id`) | KILLED |
| F1 fixed 0 accepted | KILLED |
| F2 fixed 100001 accepted | KILLED |
| F3 fixed 100000 refused | KILLED |
| U1 max_uses 0 accepted | KILLED |
| S1 fixed shown in form as pence | KILLED |
| L1 isLocked `&&` | KILLED |
| L2 isLocked ignores usedCount | KILLED |
| L3 isLocked ignores paidOrders | KILLED |
| C1, C2, C3 three reason strings changed | KILLED |
| SO1 42501 maps to network | KILLED |
| SO2 sign-in copy = network copy | KILLED |
| R1 no list refetch after save | KILLED |
| G1 server-locked not remembered | KILLED |
| G2 locked race: no refetch | KILLED |
| G3 locked race: sheet not told | KILLED |
| G4 discount not put back | KILLED |
| G5 patchOf ignores the lock | SURVIVED (equivalent: the disabled controls and the reset leave no kind/value to send; the model-level lock is still pinned by the old `patchOf(c, ...)` test) |

The 21 mutants the review already killed stay killed (the old tests were not weakened; only added to). I cannot map my table to M01-M04, M08, M11, M16, M22, M24, M26, M27 by number: not verified.
