# Handover: ticket promo codes, Website buyer half

Ticket dt_4a6cf3b57af7. Brief: `brief/ticket-promo-codes-web:docs/briefs/ticket-promo-codes-web.md`. Branch `claude/ticket-promo-codes-web`. This replaces the stale 2026-10 "blocked" handover: the RPCs are on prod now.

## Done
- `src/modules/tickets/promo.ts`: one shared mapping. It holds the reason-to-copy table (admin handover table word for word, plus empty / network / timeout / not_found / invalid_quantity), `promoView` (state to note, Apply, Buy and the code sent), `parsePromoPreview`, and `codeFromSearch` (`?code=`).
- `ticketCheckoutApi.ts`: `previewPromo()` calls `ticket_promo_preview_v1(p_series, p_ticket_type, p_quantity, p_code)` (anon). An error or a throw reads as `network`; it never throws.
- `ticketCheckoutModel.ts`: `CheckoutBody.promo_code?`, sent only when a code was applied.
- `TicketsBlock.tsx`: Promo code field (paid tickets only), Apply / Remove, a saving line, the server total, "Get free tickets" on a zero total, and `?code=` pre-fill (never auto-applied). A stepper or ticket change re-prices. A checkout 409 with a code reason lands in the field.
- Tests: `__tests__/promo.matrix.test.tsx` (62 cases): the state table, wire shapes, and block flows including double tap, offline, every reason, the free end state and the 409. Also includes three review regressions.
- `feeZero.matrix.test.tsx`: the fee-word regex is now `/50p\b/`, because textContent glues "£12.50" to "Promo code" ("50P..."). It still catches "50p booking fee".
- Design record: `docs/design/ticket-promo-codes-web.md` (state table there and in the PR body).

## Review (/code-review medium, one round, 9 findings)
Fixed:
- A pre-filled code on a free ticket held Buy with no visible field.
- A fast count change during checking dropped the re-price.
- After a refused re-price, going back did not re-price.
- The booking fee is now added to the server total, so it stays right if the fee is ever turned on.
- Whitespace-only input showed the "Clear" link.
- Duplicate code normalisation in `buildCheckoutBody`.

Not changed, with reasons:
- Effect-based re-pricing: the lint rule forbids it. The fallback, "Tap Apply to update" with Buy held, is safe.
- Non-code reasons at checkout (`rate_limited` 429, `internal_error`) stay on the generic checkout path: they are not about the code.
- The `/50p\b/` regex change, explained above.

## Verified
- Prod (read-only, counts only):
  - All four `ticket_promo_*_v1` functions exist, and the preview signature matches the client call.
  - anon can execute the preview; create, list and update are not anon.
  - 0 promo codes exist.
  - 2 ticket types: 1 free, 1 paid at £1 or more, 0 under £1, 0 per-occurrence.
  - 6 orders (expired / paid / refunded).
- Fixtures cover the free and paid shapes, a fixed code under £1 ("50p"), a 100% free result, and every reason.
- Local: `vitest src/modules/tickets` 517/517, `npm run lint` 24/24 links, eslint and tsc clean on the touched files, `check:mojibake`. Unit suite and build: see the PR body.

## Not verified
- **The edge on prod**: `ticket-checkout` v8 predates `promo_code`. Until the lead redeploys it from main, a code reaches the field and the preview, but checkout may ignore `promo_code` and charge the full price. Do not turn `publicTicketing` on for promo use before that redeploy.
- **Browser walk** at 390x844 and 320x568, dark and light: not done in this session. The Tickets block mounts only with `publicTicketing` on, and no prod promo code exists. Do the walk after the edge redeploy, with a test code on a preview.
- No real promo code was previewed end to end (none exist, and this session must not write).

## Next steps
1. Lead redeploys `ticket-checkout` from admin main.
2. Create a test code on the test series (organiser UI is a later slice; admin RPC).
3. Walk `/event/<id>?code=TEST` at 390x844 and 320x568 in dark and light, covering valid, refused, free and checkout.
4. Organiser "Promo codes" section: separate slice and branch (`src/modules/organiser/**` untouched here).

## Fix round r1

- **Copy duplication:** new `promoNoteText(pv)` in `promo.ts` returns the note alone (applyBlocked only as a fallback when there is no note); `TicketsBlock` renders it instead of joining note + applyBlocked. `applyBlocked` is unchanged as the Apply-disabled reason; no refusal wording changed. Table test over every reason in `PROMO_REASON_COPY` (except `empty`) plus `internal_error` and an unknown reason: text equals the note once, no "Change the code to try again."; retryable/non-retryable applyBlocked and buyBlocked unchanged.
- **P05:** 7 pence rows added to `wire shapes`. Pass on real code. Mutant dropping `Number.isInteger(v) &&`: 2 failed. Mutant dropping `v >= 0`: 2 failed. Both restored.
- **Checks:** vitest `src/modules/tickets` 12 files, 539 tests green (was 524; needed `npm ci` for qrcode-generator); eslint on touched files clean; tsc app project no errors in tickets; check:mojibake clean.
- **Not verified:** check:bundle-budget (no build run); browser walk at 390x844; the new copy test was not run against pre-fix code (the helper did not exist before).

## Block-level assertion (follow-up to #1372, mutant M5)

- New `src/modules/tickets/__tests__/promo.block.test.tsx`: mounts `TicketsBlock` with a refusing `ticket_promo_preview_v1` for 9 non-retryable + 4 retryable reasons plus the empty-code tap; asserts the `promo-note` text equals the copy exactly once, has no "Change the code to try again.", and Apply is disabled only for non-retryable reasons.
- Proof: passes on real code (14 tests). Mutant (scratch, reverted): `promoNoteText(pv)` replaced by an inline join of `pv.note` and `pv.applyBlocked` -> 9 failed (all non-retryable rows).
- Tests only, no production change.
