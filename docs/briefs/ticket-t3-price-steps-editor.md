# T3 organiser: price-steps editor

Repo: Website. Branch `claude/ticket-t3-steps-editor`. Lane: careful (money). One branch, one PR, behind a flag `ticketPriceStepsEditor`. Do not merge.
Read first: `docs/briefs/design-ticketing-organisers.md` s.2c (time/DST), s.2d, s.3c (esp. R3-7), s.5 "T3", s.6.
Admin issue (contract): bachata-admin #1436. T1 is live on prod: RPCs `ticket_types_manage_v1(p_event_series_id)`, `ticket_price_step_set_v1(p_ticket_type_id, p_step_id, p_effective_from timestamptz, p_price_pence int)`, `ticket_price_step_remove_v1(p_step_id)`. No DB, edge or migration work. Scope is T3 ONLY: T5 (course create flow, early-bird presets) is out. A parallel worker is doing T4 (buyer side, `src/modules/tickets/**`): do not touch those files.

## Contract
- Who: anyone who manages the event (owner/manager); the RPCs enforce it, the UI hides controls for others.
- Up to 3 steps per ticket type; price may rise or drop. Add / move (change date or price) / remove.
- Date and time in Europe/London, DST-correct (test dates across both clock changes; a nonexistent spring-forward time and an ambiguous autumn time must be handled per s.2c).
- Copy under each step: "This new price applies to every night of this ticket from <date, time>."
- Ticket type already has orders: adding a step is allowed; show "Existing buyers keep the price they paid."
- RPC refusal `reserve_not_ready`: show "Price changes open once the new checkout is live." and keep the draft.
- Empty state (no steps) says what to do; disabled controls say why (e.g. "3 steps is the most"); free tickets: no steps offered, say why.
- R3-7: the editor draft is seeded from the BASE price read (`ticket_types_manage_v1` / `fetchSeriesTypes`), never from a sales-summary row (summary `price_pence` becomes the current price). Saving an untouched edit sends nothing.

## Files (origin/main)
`src/modules/organiser/tickets/ticketsApi.ts` (`fetchSeriesTypes` ~:130, `upsertTicketType` ~:212), `ticketModel.ts`, plus the organiser tickets screen/components that render the type editor (find them; keep changes small). Add the three RPCs as untyped rpc calls like the others. Check scripts/onboarding-write-doors / `not_event_writes` guard lists for the new write RPCs (the T1 admin PR edited the admin side; the Website guard may need one entry per writer).

## Tests (table-driven, red first)
Matrix: 0/1/3 steps, 4th refused, rise/drop, with/without orders, free type, non-manager, `reserve_not_ready`, DST spring/autumn, untouched save sends nothing, draft seeded from base not summary (mutant: seed from summary price -> test red). Assert exact RPC args.
Prod shape (read-only, say so in PR): 19 paid types, 0 steps; stepped case is a fixture.

## Walk
390x844 and 360x640 on a stepped fixture: add, move, remove, 4th disabled with reason, orders note, reserve_not_ready. Screenshots in the PR only.

## Review
Money: independent review as a PR comment. Per-job CI table in PR. Verified / Not verified block. No migrations, `supabase/**`, workflows, `.env*`.
