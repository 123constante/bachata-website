Brief-version: 2

# S1: "pause this price, add a new one" -- make the existing flow obvious (Website, normal lane, Sonnet)

Why (owner words 2026-11-09): organiser Anna Galenda needs to change a ticket price after sales; the answer for now is "pause the old price and add a new one". Both already work; the screen must say so. Owner: "I should not have to check everything." No database change, no new rule.

Prove the data source first (standing header): read-only on prod, state in the PR which table/column the screen depends on. Verified by the orchestrator 2026-11-09 (re-check, do not trust): table `ticket_types` (status draft|on_sale|paused|sold_out|closed, price_pence, reserved_count); writes `ticket_type_set_status_v1` (on_sale<->paused allowed; closed is terminal) and `ticket_type_upsert_v1` (price/occurrence frozen once any order exists, reason `has_orders`); public list `ticket_types_public_v1` returns only on_sale|sold_out. Prod shapes (counts only, 2026-11-09): 5 ticket types on 2 series; on_sale 3, paused 2, one paused with 4 tickets; 4 of 5 have a close time; none free on sale, none sold out.

## What main lacks
- extends: the "price is locked" message says only that the price cannot change and never says what to do instead -- grep: The price cannot change once someone has bought a ticket
- extends: the locked-price help line in the ticket sheet has no pointer to pausing and adding a new price -- src/modules/organiser/p3/tickets/TypeSheet.tsx
- extends: a paused ticket's meaning for buyers and for people who already bought is not stated on the organiser screen -- src/modules/organiser/tickets/ticketModel.ts
- extends: no table-driven test covers every ticket status against every organiser journey (pause with sales, pause without, resume, edit price after sale, add replacement) -- src/modules/organiser/tickets/__tests__/ticketModel.matrix.test.ts

## Files
src/modules/organiser/p3/tickets/TypeSheet.tsx
src/modules/organiser/p3/tickets/TicketsEntry.tsx
src/modules/organiser/p3/tickets/model.ts
src/modules/organiser/tickets/ticketModel.ts
src/modules/organiser/tickets/__tests__/ticketModel.matrix.test.ts
src/modules/organiser/p3/tickets/__tests__/**
tests/e2e/walk-ticket-s1-pause-add.spec.ts

Do NOT touch: anything under `src/modules/tickets/**` (website-a2's buyer screens), `supabase/**`, any RPC or checkout code, `perf-budgets.json`, `vite.config.ts`, calendar density-exclusion files. Check open PRs for overlap on the files above before you start; stop and say so if another PR touches the same lines.

## Do
1. Fetch origin/main and work from it (a stale checkout hid these screens once already). Read the files above and `ticketsApi.ts`.
2. Copy only, using explicit px sizes (the site shrinks rem; 44px taps) and HTML entities for punctuation (`&mdash;`, `&rsquo;`; never raw Unicode):
   - When the price is locked: say "Tickets have been sold at this price, so it cannot change. To use a different price, pause this ticket and add a new one." The locked message and help line come from ONE shared mapping (never two copies); the existing `has_orders` text in `ticketModel.ts` and the sheet's `lockedPrice` line must both read it.
   - A paused ticket shows: "Not on sale. People who already bought keep their tickets." Resume stays one tap where the server allows it (`switchMove`).
   - The text must point at controls that are on screen: if "Add a ticket" is not visible in that state, say where it is, or do not mention it.
   - Empty state with no tickets keeps saying what to do (already true: "Tap Add a ticket below..."); do not regress it.
3. Table-driven vitest (extend the existing matrix test): every status (draft, on_sale, paused, sold_out, closed) x journey (pause with sales, pause without, resume, edit price after a sale, add replacement, owner not connected to payments) asserts: which controls are enabled, the exact text shown, no text pointing at a missing control, a disabled control states why, and an untouched save sends nothing. Red first: run the new tests against unfixed code and show the failures in the PR.
4. One e2e spec at 390x844 using the existing mock Supabase server (`tests/e2e/helpers/mockSupabaseServer.ts`): paused ticket with sales shape, locked price shape, no-ticket shape; assert no sideways scroll, taps >= 44px, the sheet and buttons sit inside the viewport.
5. Run every CI job step that applies (read `.github/workflows`; include `check:images` with `AUDIT_STRICT=1` if the integrity job runs it; `npm run check:bundle-budget` on main and branch: 0 added bytes to the dancer-app first load). Put the per-job table in the PR body.
6. PR body from the repo template, with `- Shapes surveyed:`, `Phone QA: 390x844` and a "Verified on real data" block with an honest "Not verified". Design record `docs/design/<pr>.md` (two lines: copy-only, no look change).

## Not in scope / known not verified (say so in the PR)
A walk on a real signed-in account and a real device is done by the orchestrator afterwards on the Acer/Dell. Team-member and interim-seat behaviour needs seeded accounts and is NOT verified here.

## Stop rules
Push ONCE when coherent and tested; do not add `run-ci`. One independent review, one fix round. If you find that pause/add does NOT work as described (for example a state where "Add a ticket" is missing for a paused-only event), stop, write what you found in the handover, and do not invent a new feature.
