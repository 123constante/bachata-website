# HANDOVER: event-tickets-page (PARTIAL)

## Done
- INVENTORY.md (rule 1) re-taken on main b328ed6.
- `src/modules/tickets/goodToKnow.ts` (chips builder: fixed order, known-only, music cap 3, deadline fallback to event start) and `ticketSymbol.ts` (whole-word name match, price 0 = free, gradients from mockup). 17 table-driven tests in `__tests__/goodToKnow.matrix.test.ts`, green.

## Left (nothing of the UI is built)
1. READ addition: extend the venue select/parser (types.ts:200, useEventPageQuery.ts:345, buildEventPageModel.ts:213) with `parking`, `id_required`, `cloakroom_available`, `bar_available`. No DB change.
2. Tickets page as ONE page (route behind `publicTicketing`): nav, programme block (max 4 items then "See full programme"), Good to know block (hidden when no chips), symbol-tile rows (64px, `ticketSymbol`), quantity pill to 20, email field, amber (#FF9900) bottom bar with dark button, quiet dark-green bar for non-actionable states. Reuse TicketsBlock logic/state (do NOT change checkout/payment logic in ticketCheckoutModel.ts).
3. Sticky bar (EventStickyActionBar.tsx:191) opens that page instead of the inline block; remove inline mount at BentoPage.tsx:761 once replaced.
4. Thanks page: QR at once, one QR per ticket; My tickets find-by-email form (none exists today).
5. Table-driven vitest per screen x shape; 390x844 walk (laptop-walk.mjs --branch); PR body with exact labels; run every CI step.

## Not verified
Everything UI. tsc run on 02e3b45: 0 errors (whole project). Lint chain, e2e and CI steps not run.
