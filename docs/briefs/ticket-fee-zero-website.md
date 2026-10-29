# Brief: remove the 50p booking fee (Website half)

Owner order 2026-10-29: "remove the 50p booking fee before go-live". Buyers must pay ONLY the ticket price. Branch `claude/ticket-fee-zero-web`, lane careful (money display), Opus.

## Facts (verify read-only first, do not trust)
- `src/lib/ticketBookingFee.ts` exports `BOOKING_FEE_PENCE = 50`; its comment says the server value is env `TICKET_BOOKING_FEE_PENCE` and the two must match. The orchestrator flips the server secret to 0 AFTER this merges; you never touch it.
- Consumers: `src/modules/tickets/ticketCheckoutModel.ts` (feePence = BOOKING_FEE_PENCE * quantity, `BOOKING_FEE_LABEL`), `TicketsBlock.tsx`, `legalCopy.ts` (terms of sale, owner-approved with 50p wording), organiser `src/modules/organiser/tickets/*` and `p3/tickets/*` (preview, fixtures), and their tests.
- Server already treats a 0 fee as "send no application_fee_amount".

## Do
1. Set the constant to 0 and make every screen correct AT 0: no "Booking fee" line, no "+50p", no "includes a fee" words anywhere (buyer checkout, order summary, organiser preview, tickets list, terms of sale). Prefer the model returning `feePence: 0` and the UI hiding the line when 0, over deleting the code path, so a later non-zero fee still works. Total = ticket price.
2. `legalCopy.ts`: remove the fee sentence; the refund sentence must not mention a fee refund. This is owner-approved legal copy: list the exact before/after wording in the PR body under a heading "LEGAL COPY CHANGED (owner to confirm)".
3. Update the comment in `ticketBookingFee.ts`: server env must be 0 (or unset only after admin default is 0).
4. Table-driven tests over every ticket shape (free, paid x quantity 1/2/many, mixed, sold out, organiser preview) asserting no fee text and total == subtotal. Red first: write the tests against the unfixed code and show them fail.
5. grep the whole repo for "50p", "booking fee", "BOOKING_FEE" (src, tests, docs, e2e) and fix or justify each hit.

## Standing lines
Prove the data source first; zero bytes added to /app first load (`npm run check:bundle-budget` on main and branch; never edit perf-budgets.json or vite.config.ts); overlays unchanged. One fix round max. Run every CI job step; per-job table in the PR body; "Verified on real data" + "Phone QA" sections (390x844 walk of checkout and organiser preview with a paid ticket fixture). Do NOT run /code-review; orchestrator reviews. Handover docs/handovers/ticket-fee-zero-web.md.
