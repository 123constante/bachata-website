# Handover -- my-tickets-screen (queue B)

Branch `claude/my-tickets-screen`. Brief `docs/briefs/my-tickets-screen.md` v2.

## Built
- `/account/my-tickets` (`src/modules/tickets/MyTicketsPage.tsx`): a signed-in buyer's paid tickets from
  `my_tickets_v1()`, grouped Upcoming / Past by the London day, each with a door QR of the bare
  `qr_token` (what `p3/door/model.ts parseCode` accepts). Past tickets start collapsed ("Show QR code").
  Checked-in tickets show "Checked in at <time>" (same `londonClock` as the door) and keep the QR
  behind "Show anyway". Series-wide tickets with no scheduled night read "Date to be confirmed".
  Over 500 tickets: "Showing 500 of N" note. States: loading, signed out (Sign in link back here),
  error (Try again), empty (Find an event), auth unavailable (Try again -> retryAuth).
- `myTicketsModel.ts` (pure), `myTicketsApi.ts` (one RPC wrapper; 42501 -> signed out; malformed
  reply -> error, never "no tickets"), `qr.ts` (`qrcode-generator@1.4.4`, pinned, only in the lazy
  MyTicketsPage chunk -- verified in the build output).
- Route in `AnimatedRoutes.tsx` behind `flags.publicTicketing` (off -> `<Navigate to="/" replace />`),
  catch-all path, breadcrumb id `myTickets` (Home > Your account > My tickets).
- Inventory: `docs/inventory/my-tickets-screen/INVENTORY.md` (19 of 28 rows covered; GAPs listed).

## Flag
`VITE_ENABLE_PUBLIC_TICKETING` (`flags.publicTicketing`), OFF on prod. Flag off: no route (redirect
home), no first-load bytes (bundle budget, first-load request pins and chunk-cycle check all green).

## Tests
- `__tests__/myTickets.matrix.test.tsx`: 15 shapes x state through the real page with a mocked
  rpc + useAuth, plus a token-leak check (not in DOM text/attributes, hrefs, console). Red against
  main first (no page to import).
- `__tests__/myTicketsQr.test.ts`: QR -> RGBA raster -> `jsqr` -> `parseCode` returns the token.
- `__tests__/flagOff.test.ts` extended: route shape, lazy import, catch-all, and `qrcode-generator`
  imported only by `qr.ts`, `qr.ts` only by the page.

## Not verified
- A real camera scan at the door (only the jsqr round trip in vitest).
- A real purchase end to end (no prod write allowed; prod has 1 paid order).
- Admin repo ticket views (source 1 of the inventory): repo not reachable from the worker session.
- `start_time` for materialised nights is converted from UTC by the RPC (GAP g4): in BST it would
  read one hour early. Needs an admin-repo RPC fix; the page prints what the RPC returns.
- The page is linked from nowhere yet (account menu link is a follow-up).

## Next steps
1. Owner: decide on an account-menu / thank-you-page link to `/account/my-tickets`.
2. Admin: GAP g4 (London start time), g2 (refunded tickets vanish), g3 (short code) need RPC changes.
