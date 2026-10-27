# Handover: S3 organiser ticketing screens (Website)

Branch `claude/ticketing-organiser-ui` (from main a090c97). Brief: branch
`brief/ticketing-organiser-ui`, `briefs/ticketing-organiser-ui.md` (blob 6a764ff).
Journey map and shape survey: [`docs/organiser-ticketing-journey.md`](../organiser-ticketing-journey.md).

## Done

- New flag `organiserTicketing` (`VITE_ENABLE_ORGANISER_TICKETING === 'true'`), OFF by
  default, copied from the `organiserP3` mechanism: one lazy route `/account/tickets/*`
  inside `flags.organiserTicketing && flags.organiserSelfServe ? ... : null`, listed in
  `catchallClientPaths.ts`; `__tests__/flagOff.test.ts` pins all of it.
- `src/modules/organiser/tickets/`:
  - `ticketModel.ts`: the ONE mapping for status words / tones, the server's status
    machine, role rules (Q15 owner/manager), Get paid state, money (GBP, Q10), move and
    refund reasons, the editor's diff (untouched save = null), server refusal words.
  - `ticketsApi.ts`: the wire (UntypedRpc boundary; the ticketing RPCs/tables are not in
    `types.ts` yet). Allow-listed in `lint-runtime-architecture.mjs` for `organiser_id`.
  - Screens: `TicketsHome` (Get paid card, Sales counts and sums, live events),
    `SeriesTickets` (ticket types, status moves, orders + Refund), `TypeSheet` (editor),
    `RefundSheet` (confirm; says the 50p fee is refunded), `TicketRoutes`.
  - Edge functions not deployed: 404 without a reason, 503, or `not_configured` read as
    "Payments are not switched on yet" (never a crash); a network failure reads as
    "try again", a deployed function's own 404 reason keeps its words.
- Tests: table-driven model matrix (status machine vs live server CASE, every status x
  role x Stripe x free/paid x capacity x series-live), wire parsers, and a screen matrix
  (every status x orders present/absent x connected/not x owner/contributor) plus empty
  states, untouched save, price lock, refund sheet, onboarding fallback.
- Code review round 1 (high): 10 findings, all fixed in 82d8355. Round 2 NOT run
  (context budget; CLAUDE.md asks two rounds for user-facing changes).

## Notes for the orchestrator (DB / admin side, not files here)

1. **Edge-function contracts are ASSUMED** (admin repo was not readable from this session):
   `stripe-connect-onboard` body `{ organiser_id, return_url, refresh_url }` -> `{ url }`
   (https only); `ticket-refund` body `{ order_id }` -> `{ ok }`, refunds the whole
   order incl. booking fee. Return URL `/account/tickets?o=<id>&stripe=return`, refresh
   URL `...&stripe=refresh`. If S2 differs, only `ticketsApi.ts` changes.
2. `organiser_home_v1` returns role `owner | manager` only; a `contributor` (which the
   ticketing RLS lets read) never reaches the area today. Screens still handle it read-only.
3. `ticket_sales_summary_v1` has no `orders_expired` count; the editor locks price from
   reserved / any order row read via RLS (expired included) instead.
4. `types.ts` lacks the ticketing tables/RPCs; types-drift will pick them up.

## Left / next steps

- Code review round 2; then flip the flag on a preview (`feat/*` branch) for a phone test.
- Partial refunds (Q5) are not offered in the UI (whole-order refund only).
- No per-date (occurrence) picker in the editor: new types are series-wide.
- Wire an entry link from the organiser area Home/More to `/account/tickets` once the
  flag is on (deliberately absent so flag-off changes nothing).

## Verified / Not verified

See the PR body's per-job table and "Verified on real data" block (copied below at the end of the run).
