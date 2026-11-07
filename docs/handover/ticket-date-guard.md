# Handover: ticket date guard + Connect payments inline

Branch `claude/ticket-date-guard` (from `origin/main` 27e4ac0). Brief: `docs/briefs/ticket-date-guard.md` (blob 935caccf). No migration, no supabase/**, no workflow edit, no calendar-protected file, no checkout or RPC touched.

## Done
1. **Date guard.** `ticketModel.ts`: `coversEveryDate`, `defaultCloseFor(series)`, `EVERY_DATE_NOTE`; `formOf(t, series?)` (no series = unchanged). `TypeSheet` shows the note under Sales close for a NEW ticket when the series has 2+ upcoming dates; `newDraft`/`draftFor` take the series and prefill Sales close with the next start (editable, clearable). Editing an existing ticket never prefills or shows the note; an untouched edit save sends nothing.
2. **Connect payments inline.** One mapping, `connectBlock(pricePence, {role, stripe}, {switchedOff, note})` in `ticketModel.ts`, drawn by the sheet (step 3, new paid complete ticket: the sentence + ONE 44px button that saves the DRAFT then starts Stripe; Put on sale is not shown) and by a draft's list row (sentence + button, replaces the "Connect payments in You > Get paid" reason; the Selling switch stays disabled until connected, then enabled by the existing move). Button reads "Carry on with Stripe" when state is `started`. Free ticket, non-manager (NOT_MANAGER), Stripe loading (existing "Checking your payment set-up" copy) and not_configured (existing PAYMENTS_WHERE copy) show no block. Start error shows under the row's button.
3. Return path: `P3_TICKET_PATHS.eventTickets(seriesId)` = `/account/p3/events/<id>?tickets=1`; `stripeBack(..., returnTo?)` appends `&stripe=return|refresh` (default output unchanged); `useStartOnboarding(org, from?, returnTo?)`. `TicketsEntry` reads `tickets=1` once on arrival, opens the sheet, refetches Stripe on `stripe=return`, drops both params.
4. Existing `tickets.matrix.test.tsx`: two assertions encoded the removed behaviour (greyed Put on sale + PAYMENTS_WHERE on the add sheet; switch reason on a paid draft) and were updated to the new block.

## Tests
- New: `typeSheet.dateGuard.test.tsx` (42 tests), `typeSheet.connectInline.test.tsx` (59 tests), table-driven, one EXPECT mapping each.
- Red first: against the unfixed source (the six source files stashed) 26 of 101 new tests fail (the rest are rows that assert nothing changed, e.g. free ticket, edit, contributor). Mutations: `defaultCloseFor` returning the last listed date instead of the next: 4 date-guard rows fail; Connect block shown for a free ticket: 4 connect rows fail.
- Green: all of `src/modules/organiser` (295 files, 12,200 tests) passed before the matrix edit; after it, the p3/tickets and tickets folders: 22 files, 1618 tests passed.

## Verified
tsc, check:mojibake, the vitest runs above (results in the final report).

## Not verified
- The Add a ticket sheet and the draft row at 390x844 (no browser walk done).
- A real weekly series (Bachateame) and prod data shapes: no Supabase survey run; fixtures only (13 weekly dates, 1 date, none, missing start, past start).
- A real Stripe round trip: the return URL is built and unit-tested, but I did not confirm the onboarding edge function accepts a `/account/p3/events/<id>?tickets=1&stripe=...` return URL.
- The clock changes (late October / March): `defaultCloseFor` reads `materialised_start_utc` through `isoToLondonInput`, the same reading `eventStartOf` already uses. That column is documented as London wall time stored as UTC (ADR-002 "local-as-Z"), so in BST the prefill may be an hour late; the Event start chip for a one-date series has the same trait. Check on a summer date before trusting it.
- A next start already in the past is prefilled as the brief says (not blanked); the sale would close at once. Product call.
- Workflow checks beyond tsc, mojibake and vitest (lint chain, pre-ship, e2e) were not run.
