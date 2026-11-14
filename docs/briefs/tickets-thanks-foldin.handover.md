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

Checks: `npx vitest run src/modules/tickets` 844/844; `check:mojibake` clean; `check-e2e-spec-coverage` OK;
e2e (flag on) `ticket-thanks.spec.ts` 3/3 and new `ticket-thanks-forward.spec.ts` 2/2 at 390x844.
Full `tests/` run has unrelated failures (eventViewCompat DB contract needs network, integrityCouldNotRun, plan hygiene --norender): not touched by this branch, not compared against main.
tsc run on the pre-final commit: 0 errors in branch files.
Not verified: `npm run pre-ship`, `npm run test:e2e` gate, real Stripe return, prod-shaped data (route is behind the OFF flag).
