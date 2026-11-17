# Handover: buyer onboarding slice A (Website, branch claude/onboard-a)

Brief: `brief/onboard-a:docs/briefs/onboard-a-slice-a.md`. Flag: `VITE_ENABLE_BUYER_ONBOARDING` (`src/lib/buyerOnboardingFlag.ts`), OFF by default. Rollback = flag off.

## Done
- Item 2: `fetchMyDancerEdit` (api/rpc.ts) on `no_profile` with the flag ON calls `ensure_my_dancer_profile_v1` once, then reads again. Every reader (shell on sign-in, onboarding, Me, Options) goes through it. If the create fails (rate_limited / not_signed_in / offline) the original `no_profile` stands, so the existing "Message us" card is the fallback and the next visit retries. Never touches sign-in or payment. RPC name cast via rpcLoose (types.ts untouched).
- Item 3: no new strings; the RPC's `not_signed_in` / `rate_limited` / permission-denied / network paths map through `codeFromMessage` to the existing COPY list. Table test: `src/modules/dancer-app/__tests__/ensureProfile.matrix.test.ts` (7 shapes + 5 error paths). Fake backend gained `ensureMyDancerProfile` (5/day limit like the server).
- Item 5: `TicketPickerB1.tsx` shows "Tickets go to {email}. Not you?" above Continue for a signed-in buyer (flag ON). Not you? = `signOut()` (this device), basket kept (storage), email + code card opens empty. Test: `src/modules/tickets/__tests__/pickerNotYou.test.tsx`.

## Done (continuation, dt_7836ae652970)
- Item 4: `TicketThanksPage` (flag ON) redirects a signed-in buyer to `/app/home?o=` (free=1 kept). Teaser Home draws the Tickets tab's own card (`useTicketCard` poll + `TicketCard`, reused, not copied) at the top while `?o=` is in the URL: plain pending line, then the QR. A person who is NOT on the teaser (finished profile, teaser flag off) is sent on from Home to `/app/tickets?o=` by `ScreenOrTeaser` (DancerAppRoutes), so nobody lands on a Home without the QR.
- Ticket card states: ONE mapping `src/modules/tickets/ticketCardStatus.ts` (refunded > cancelled > passed > valid; copy exact per owner). Used by the dancer `TicketCard` and `/account/my-tickets` (`MyTicketsPage`): greyed, QR and door code hidden, plain reason. Flag OFF = untouched.
- Different-email note: (removed in fix round 1, H2.)
- Test: `src/modules/tickets/__tests__/onboardTicketStates.matrix.test.tsx` (10 status shapes, 4 card renders + flag OFF, note on/off, 4 redirect cases).

## Fix round 1 (review BLOCK on #1763, brief brief/onboard-a-fix1, dt_509e32ae825a)
- H1: `ticketCardStatus.ts` gains `ticketNightKey(now)` (London today, rolled back a day before 08:00, `ROLLOVER_HOUR` from `src/lib/programDayRollover.ts`) and `ticketStatusAt(t, now)`. `TicketCard` and `MyTicketsPage` use it, so a ticket stays valid until 08:00 the morning after. Rows: 00:30 / 07:59 after = valid; 08:00 / 09:00 after = passed; BST rows; card renders at 00:30 and 09:00.
- H2: the "Your ticket is under another email" claim is gone (copy, view field, render). `useTicketCard.ts` is back to main byte-for-byte: an empty QR read shows only the neutral "Your tickets are in your email" line, flag ON and OFF. Rows: hook ON + OFF, card renders one line.
- H3: `TicketPickerB1` `notYou()`: a `'failed'` (or thrown) `signOut()` shows "We could not sign you out. Try again." (`picker-not-you-error`), the email card does not open, the old address stays; the button is disabled while it runs. Rows: failed, throws, busy double-tap.
- N1 `??` restored (flag-OFF identical); N3 basket-survives row; N5 fake returns `created: false` for the archived stub, row now expects `no_profile`; N6 Home order card uses `isOrderId`; N9 import moved up. N2, N4, N7, N8 skipped per brief.
- Code head cab193e; tsc run on cab193e: 0 errors in branch files.
- Allow-list unchanged (same 7 files); `check-dancer-area-isolation.mjs` + `--self-test` exit 0.
- New rows fail on the old code (15 failures with the fix stashed), pass on the fix. `src/modules/tickets` + `src/modules/dancer-app`: 79 files, 2198 tests pass. tsc: 0 errors. check:mojibake clean.

### Not verified (fix round 1)
- Signed-in 390x844 walk with the flag ON (picker "Not you?", Home order card, status greying): needs a real buyer session; not done. Dev-server walk (flag ON, signed out) only: `/app/home?o=x` redirects to sign-in, no page errors, no sideways scroll; `/tickets/thanks` and `/my-tickets` 404 on the local dev server (route not mounted locally), so not walked.
- Full lint chain, e2e, full unit suite not run this round.
- Live sign-out failure on a real phone (H3 is unit-tested only).

## Left / next steps
- NEEDS ADMIN (DB): `my_tickets_v1` and `my_ticket_order_qr_v1` return only `o.status = 'paid'` and `t.status <> 'void'` rows and no night lifecycle, so 'refunded' and 'cancelled' can never reach the Website today. The mapping and screens take `refunded` / `eventCancelled` inputs already; an admin RPC change (return refunded orders with a voided flag, and the occurrence `lifecycle_status`) plus a parse line in `parseMyTickets` turns them on. Prod shapes 2026-11-17: orders paid 2 / refunded 1 / expired 6; tickets used 3 / void 1; none of the 4 tickets resolves to an occurrence row.
- Different-email note: removed in fix round 1 (H2). Bringing it back needs the QR RPC to say WHY it is empty (another account vs older than 2 h vs refunded vs not issued vs guest).
- Funnel daily status line: SKIPPED. It needs a scheduled job / report sink this repo does not have (no cron, no admin report table here). Next: an admin-side daily SELECT (counts of ensure_my_dancer_profile_v1 creations, paid orders, teaser Home order-card views) posted as one line.
- Home -> Tickets forward for non-teaser people has no unit test (covered by reading; walk it).
- 390x844 walk with the flag ON (orchestrator).

## Status
- PR: #1763 (body updated with Verified on real data + Phone QA). Code head 26f95af; tsc run on 26f95af: 0 errors in branch files. Lint chain: only check:no-social-word red, also red on main (priceSteps.matrix.test.tsx:32).
- Earlier: Head before this commit: 6e6f69a. tsc run on 6e6f69a: 0 errors in branch files.
