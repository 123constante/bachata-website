# S1a Website side: buyers choose and pay for a specific night

Brief-version: 1
Repo: Website (123constante/bachata-website). Branch: `claude/ticket-night-aware-website`. Lane: careful (it sits on the money path of a public route), Opus builds, independent review (impeccable-finish-reviewer for the UI, a second reader for the wire). One PR, one push. Admin #1352 is merged and applied on prod; the owner runs the edge deploy only AFTER this PR is merged and live.

## Why
Latino Flava is a weekly series with series-wide ticket types. Prod now records the night on every order and ticket, counts capacity per night and closes sales when that night ends. The buyer pages still call the old read (`ticket_types_public_v1`, no night) and never send the night, so after the edge deploy a series-wide night ticket would be refused `night_required`. This slice makes the buyer pick up the night on screen and send it.

## Prod wire (read back from prod 2026-11-10, do not guess)
- `ticket_types_public_v2(p_event_series_id uuid, p_occurrence_id uuid)` returns: `id, occurrence_id, name, price_pence, currency, status, remaining, sold_out, sales_open_at, sales_close_at, effective_close_at, kind, valid_from, valid_to`. Re-check the list with a read-only `pg_get_function_result` before you write the parser, and keep the GBP-only drop.
- `ticket_promo_preview_v2(p_series uuid, p_ticket_type uuid, p_quantity int, p_code text, p_occurrence_id uuid)`.
- `ticket-checkout` edge body gains optional `occurrence_id` (uuid string). New 409 reasons: `wrong_night`, `night_required`, `night_cancelled`, `night_ended`, `not_course_night`. The edge sends a buyer message with each; `reasonCopy` falls back to a generic line, so each needs its own entry.
- v1 reads stay callable. Do NOT delete the v1 code paths in the same PR; only stop calling them.

## What main lacks
- extends: `fetchPublicTicketTypes` calls `ticket_types_public_v1` with only the series id -- src/modules/tickets/ticketCheckoutApi.ts
- extends: `previewPromo` calls `ticket_promo_preview_v1` -- src/modules/tickets/ticketCheckoutApi.ts
- extends: `CheckoutBody` and `buildCheckoutBody` carry no `occurrence_id` -- src/modules/tickets/ticketCheckoutModel.ts
- extends: `REASON_COPY` has none of the five night refusals -- src/modules/tickets/ticketCheckoutModel.ts
- extends: `PublicTicketType` has no `soldOut`, `effectiveCloseAt`, `kind`, `validFrom`, `validTo` -- src/modules/tickets/ticketCheckoutModel.ts
- extends: `TicketsBlock` queries types by series only, so the cache key ignores the night -- src/modules/tickets/TicketsBlock.tsx

## Files
src/modules/tickets/__tests__/nightAware.matrix.test.tsx
docs/design/ticket-night-aware-website.md
docs/handover/ticket-night-aware-website.md

Existing files you edit (the dispatch check refuses paths that exist, so they are listed here, not above): `src/modules/tickets/ticketCheckoutApi.ts`, `ticketCheckoutModel.ts`, `TicketsBlock.tsx`, `promo.ts`, `EventTicketsPage.tsx` if it fetches types, `siteBarState` callers, and the existing tests in `src/modules/tickets/__tests__/` that mock `ticket_types_public_v1` (update the mocks; do not delete assertions).

## Do
0. **Prove the data first** (read-only, prod `stsdtacfauprzrdebmzg`, counts only, no personal data, no write): call `ticket_types_public_v2` for Latino Flava's series with (a) a future night, (b) a past night, (c) a cancelled night, (d) NULL. State what each returns, the kinds present, and whether `remaining` and `sold_out` differ per night. Paste the table in `docs/design/ticket-night-aware-website.md`.
1. **Read**: `fetchPublicTicketTypes(seriesId, occurrenceId)` calls `ticket_types_public_v2`. The react-query key includes the night: `['public-ticket-types', seriesId, occurrenceId]`. Parse the new columns; use `effective_close_at` (not `sales_close_at`) for "closes" and for the availability rule; use the server's `sold_out` for sold out. `typesForNight` stays as a safety filter.
2. **Promo**: `previewPromo` calls `ticket_promo_preview_v2` with the night.
3. **Checkout**: `buildCheckoutBody` adds `occurrence_id` whenever the page has a night; omit it only when the page truly has none. A course ticket (kind `course`) sends the night on screen too; the server decides.
4. **No night on screen** for a night-kind type: do not offer Buy; show the line "Choose a night to buy tickets" with the way forward (a control to the dates). A series-wide type on a page with no night must never post without `occurrence_id`.
5. **Refusals**: add the five reasons to `REASON_COPY` with plain English and a way forward each: `wrong_night` and `night_required` -> pick (go to the night's own page); `night_cancelled` and `night_ended` -> pick another night; `not_course_night` -> pick another night. Use full weekday names where a date appears (house rule). Copy must name the next step, not just the fault.
6. **Course ticket line** (kind `course`, `valid_from..valid_to`): one line "Valid every <weekday> from <date> to <date>, once each night", from the data, never hard-coded.
7. **Sticky bar and block agree** (`sellsInSite` / `siteBarState`): both read the v2 rows for the night on screen. A night with `sold_out` true says "Sold out" for that night only.
8. **Tests, red first**, table-driven screen x shape: series-wide type on night A (remaining 5) and night B (sold out); course type; past night (no buyable rows); cancelled night; no night on screen; each of the five refusals shows its copy and way forward; checkout body carries `occurrence_id`; the query key changes with the night; v1 is no longer called. Existing tests stay green.
9. UI (390x844, prod-shaped data): design record in `docs/design/ticket-night-aware-website.md` (ONE design chosen, alternatives noted; contrast >= 4.5, taps >= 44px, no sideways scroll, every empty/loading/error state actionable), a walk on a preview deploy, screenshots on the PR. A different worker critiques before you hand off.

## Limits
Website only. No migration, no `supabase/**`, no workflow, no secret, no Stripe key. No production write. Do not touch the edge function (the owner deploys it after this merges). Do NOT rename or remove `ticket_types_public_v1` usage outside the buyer module. No density changes to the calendar files listed in CLAUDE.md. Never merge or approve; the lead merges on merge-preflight CLEAR.

## Order of release (write it in the PR body)
1. This PR merged and live. 2. Owner runs the edge deploy. 3. Until step 2, `occurrence_id` in the body is ignored by the old edge, so this PR is safe to ship first. State that and say what a buyer sees in the gap.

## Hand-off
PR body with `- Shapes surveyed:`, a per-job CI table, a Verified / Not verified block (name what was NOT walked: real Stripe, the edge deploy), and the handover in `docs/handover/ticket-night-aware-website.md`.
