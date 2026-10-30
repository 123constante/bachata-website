# Brief: T6 -- retire the old /account/tickets organiser screens

Repo 123constante/bachata-website. Branch `claude/tickets-retire-old-screens`. Normal lane, Opus (it deletes code). Owner 2026-10-30: the walk of the new P3 organiser tickets screens passed; the old ones can go.

## Read first
`docs/scoping/ticket-followups-2026-10-30.md` on branch `claude/scope-ticket-followups`, item T6 (and its cited handover `docs/handover/p3-wt-ticketing.md`, "Deleting old /account/tickets").

## Do
1. Delete the old module files: `src/modules/organiser/tickets/{TicketRoutes,TicketsHome,SeriesTickets,TypeSheet,RefundSheet,parts,paths}` and the routes that mount them (`src/components/AnimatedRoutes.tsx` ~L57, ~L270; `src/lib/catchallClientPaths.ts` ~L51). KEEP `ticketModel.ts`, `ticketsApi.ts` and their tests: P3 reuses them. Prove each deleted file has no remaining importer (grep before and after; say so in the PR).
2. Move the copy swap (`p3Words`, `OLD_PAYMENTS_WHERE`) into `ticketModel.ts` as the scoping doc says; keep behaviour identical.
3. Stripe Connect return/refresh links minted by the old screens point at `/account/tickets?...` and would land on NotFound after the delete. Find every place that builds those URLs (`ticketsApi.ts` ~L241 and any client caller); make `/account/tickets` (and its `?` params) redirect to the P3 tickets screen, or point the minted URLs at the P3 path, whichever keeps an organiser mid-onboarding from hitting a dead end. Table-driven test on the redirect/URL mapping, red first.
4. Do NOT touch `src/modules/organiser/p3/**` behaviour, flags, or any `supabase/**`.

## Done =
Run the whole unit suite for touched areas and every applicable CI step (bundle budget, architecture-guard, e2e specs that mention tickets; delete or retarget specs that only tested the old screens and say which). Push only (bot opens the PR). PR body: "## Verified on real data" with "Shapes surveyed:" (organiser_stripe_accounts and ticket_types counts read-only), "Checks run:", "NOT verified:" and "## Phone QA". Final commit subject ends with [worker-done tickets-retire]. Stop at 30% context with a PARTIAL marker.
