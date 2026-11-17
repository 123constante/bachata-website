# Handover: buyer onboarding slice A (Website, branch claude/onboard-a)

Brief: `brief/onboard-a:docs/briefs/onboard-a-slice-a.md`. Flag: `VITE_ENABLE_BUYER_ONBOARDING` (`src/lib/buyerOnboardingFlag.ts`), OFF by default. Rollback = flag off.

## Done
- Item 2: `fetchMyDancerEdit` (api/rpc.ts) on `no_profile` with the flag ON calls `ensure_my_dancer_profile_v1` once, then reads again. Every reader (shell on sign-in, onboarding, Me, Options) goes through it. If the create fails (rate_limited / not_signed_in / offline) the original `no_profile` stands, so the existing "Message us" card is the fallback and the next visit retries. Never touches sign-in or payment. RPC name cast via rpcLoose (types.ts untouched).
- Item 3: no new strings; the RPC's `not_signed_in` / `rate_limited` / permission-denied / network paths map through `codeFromMessage` to the existing COPY list. Table test: `src/modules/dancer-app/__tests__/ensureProfile.matrix.test.ts` (7 shapes + 5 error paths). Fake backend gained `ensureMyDancerProfile` (5/day limit like the server).
- Item 5: `TicketPickerB1.tsx` shows "Tickets go to {email}. Not you?" above Continue for a signed-in buyer (flag ON). Not you? = `signOut()` (this device), basket kept (storage), email + code card opens empty. Test: `src/modules/tickets/__tests__/pickerNotYou.test.tsx`.

## Done (continuation, dt_7836ae652970)
- Item 4: `TicketThanksPage` (flag ON) redirects a signed-in buyer to `/app/home?o=` (free=1 kept). Teaser Home draws the Tickets tab's own card (`useTicketCard` poll + `TicketCard`, reused, not copied) at the top while `?o=` is in the URL: plain pending line, then the QR. A person who is NOT on the teaser (finished profile, teaser flag off) is sent on from Home to `/app/tickets?o=` by `ScreenOrTeaser` (DancerAppRoutes), so nobody lands on a Home without the QR.
- Ticket card states: ONE mapping `src/modules/tickets/ticketCardStatus.ts` (refunded > cancelled > passed > valid; copy exact per owner). Used by the dancer `TicketCard` and `/account/my-tickets` (`MyTicketsPage`): greyed, QR and door code hidden, plain reason. Flag OFF = untouched.
- Different-email note: paid order whose QR read is ok-but-empty for this account (server reads only the signed-in buyer's own paid order inside 2 h) shows "Your ticket is under another email" under the paid line (flag ON).
- Test: `src/modules/tickets/__tests__/onboardTicketStates.matrix.test.tsx` (10 status shapes, 4 card renders + flag OFF, note on/off, 4 redirect cases).

## Left / next steps
- NEEDS ADMIN (DB): `my_tickets_v1` and `my_ticket_order_qr_v1` return only `o.status = 'paid'` and `t.status <> 'void'` rows and no night lifecycle, so 'refunded' and 'cancelled' can never reach the Website today. The mapping and screens take `refunded` / `eventCancelled` inputs already; an admin RPC change (return refunded orders with a voided flag, and the occurrence `lifecycle_status`) plus a parse line in `parseMyTickets` turns them on. Prod shapes 2026-11-17: orders paid 2 / refunded 1 / expired 6; tickets used 3 / void 1; none of the 4 tickets resolves to an occurrence row.
- Different-email note: a guest order (buyer_user_id null, 2 in prod) opened while signed in would also read as "another email". Rare (the stored order id is cleared on the thank-you page); exact needs the RPC to say why it is empty.
- Funnel daily status line: SKIPPED. It needs a scheduled job / report sink this repo does not have (no cron, no admin report table here). Next: an admin-side daily SELECT (counts of ensure_my_dancer_profile_v1 creations, paid orders, teaser Home order-card views) posted as one line.
- Home -> Tickets forward for non-teaser people has no unit test (covered by reading; walk it).
- 390x844 walk with the flag ON (orchestrator).

## Status
- PR: #1763 (body updated with Verified on real data + Phone QA). Code head 26f95af; tsc run on 26f95af: 0 errors in branch files. Lint chain: only check:no-social-word red, also red on main (priceSteps.matrix.test.tsx:32).
- Earlier: Head before this commit: 6e6f69a. tsc run on 6e6f69a: 0 errors in branch files.
