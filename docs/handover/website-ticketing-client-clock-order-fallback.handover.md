# Handover: ticketing client clock, ?o= fallback, notYouErr

Done (flag-off behaviour unchanged; flagOff.test.ts green; 945 tickets/dancer-app tests pass):
1. R2-N1 `src/modules/tickets/serverToday.ts`: "today" from the same-origin HEAD `Date` header (cross-origin Supabase hides `Date`), once per load, device clock only as fallback. Used by MyTicketsPage and useTicketCard.
2. R2-N2 `useTicketCard`: missing/malformed `?o=` already fell to own tickets (test added); a foreign/unreadable order id now falls back to own upcoming tickets instead of an error. Email link path is `MY_TICKETS_PATH` (/account/my-tickets); no bare `/my-tickets` links exist in this repo.
3. R2-N3 `TicketPickerB1`: the error line was independent of the signed-in address, so it stuck after sign-out elsewhere / account switch. Now only shown with a known email and cleared when it changes.

Reproduced (new tests fail on old code): notYou stale error, foreign `?o=`, server-today. Not reproduced as bugs: missing/malformed `?o=` (already worked).
Not verified: 390x844 browser walk, `npm run pre-ship`, live Date header on Vercel, sign-in redirect round trip of the email link.
tsc run on branch head: 0 errors.
