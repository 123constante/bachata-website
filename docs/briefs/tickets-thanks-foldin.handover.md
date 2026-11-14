# Handover: tickets thanks fold-in

Done: `/tickets/thanks` (TicketThanksPage) now forwards a signed-in buyer with a valid order id
(URL `?o=` or the stored id) to `/app/tickets?o=<id>[&free=1]` with `replace`. Signed out, no valid
order id, or auth unavailable: today's page (`ThanksFallback`) is unchanged. While auth is
`resolving` a blank placeholder shows (never the fallback, so no poll / no clearing the stored id
first). Route stays inside `flags.publicTicketing`; flag, calendar files, dialog.tsx, SQL untouched.
The Tickets tab already read `?o=` / `free=1` / the stored id (#1664), so no tab change was needed.
Incomplete-profile buyers: DancerAreaGate admits `/app/tickets` view-only, so they forward too.

The earlier trap (walk spec broke): `tests/e2e/ticket-thanks.spec.ts` uses a signed-in fake, so a
forward moved it off the page. It now runs `signedOut: true`. Unit tests that render the thank-you
page signed-in (orderQr, orderStatus) now render `ThanksFallback` directly; others mock a
signed-out `useAuth` (default context is `resolving`).

Left / next: nothing required. Ticketing flag stays OFF; owner flips it separately.
