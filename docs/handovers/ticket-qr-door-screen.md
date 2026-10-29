# Handover &mdash; ticket QR door screen (dt_95211a94c563)

Branch `claude/ticket-qr-door-screen`. Brief: `docs/briefs/ticket-qr-door-screen.md` on
`brief/ticket-qr-door-screen`. Design record: `docs/design/ticket-qr-door-screen.md`.
Screenshots (390x844, dark set, harness = route-mocked organiser fake + Chromium fake camera):
`docs/handovers/ticket-qr-door-screen/` &mdash; 1 ready, 2 ok, 3 already_in, 4 wrong_event,
5 not_valid, 6 unknown_code, 7 not_allowed, 8 offline (NO SIGNAL), plus 9 list and 10 empty (0 sold).

## Done

- `/account/p3/events/:seriesId/door` (lazy chunk, behind `flags.organiserTicketing`, full screen),
  entered from a **Scan tickets** row on the P3 event page right under `TicketsEntry`.
  Old `src/modules/organiser/tickets/*` untouched. No flag default changed.
- `door/model.ts`: the ONE table (result -> band, headline, sub, detail, vibration, actions, keep
  scanning) for the 6 RPC results + client `no_signal`; `parseCode`; the 2.5 s scan gate; London
  clock; counter; code-box disabled reasons; camera words.
- `door/data.ts`: `ticket_check_in_v1` / `ticket_door_list_v1` via `supabase.rpc` (POST). 42501 ->
  "You were signed out" card. Any other failure -> NO SIGNAL (opens the list). No role checks.
- `door/camera.ts`: `BarcodeDetector` (qr_code) where supported, else **jsQR 1.4.0** loaded by
  dynamic import only inside the door chunk. Camera stops on tab hide and unmount.
  Denied / no camera / failed -> says so plainly and opens the list tab with the code box.
- Token `--amber` (+ `--cam`, `--cam-fg`) in `p3.css`, contrast pairs added to the p3 contrast test.
- Tests: `door/__tests__/door.model.test.ts` (table matrix, parsing, gate, clock, hygiene) and
  `door.screen.test.tsx` (every result x Scan screen, no signal, signed out, Type code focus,
  disabled reason, camera-mock debounce, dead cameras x3, tracks stopped on unmount, every list
  state). e2e `tests/e2e/ticket-door-scanner.spec.ts`, added BY NAME to `test:e2e`.

## Data facts proved (prod `stsdtacfauprzrdebmzg`, read-only SELECTs)

- Read both function bodies from `pg_proc` (match the brief). `_ticket_door_counts_v1` counts
  ticket ROWS (paid order, not void), so "37 of 120 in" is people.
- `tickets.qr_token` default `encode(gen_random_bytes(32), 'hex')`: **64 lowercase hex**. All 6
  prod tickets are 64 chars, URL-safe.
- **What the buyer's QR encodes: nothing yet.** No QR is rendered anywhere: the admin
  `ticket-email` handler (`supabase/functions/_shared/ticketingHandlers.ts`) sends plain text with
  one line per ticket, `Ticket N: <qr_token>`, and the website has no thank-you QR (no `qr_token`
  reference in `src/` besides generated types). `parseCode` accepts the bare token (any case,
  spaces dropped) and a URL whose `t` / `token` param or last path segment is the token, so a
  future QR image of either form works unchanged.
- **Quantity vs QR codes**: one ticket row = one QR token = one person. `quantity` is the ORDER's
  size (prod: orders of 1 have 1 ticket row, an order of 3 has 3). So `ok` lets ONE person in and
  says the order size; the list has one row per ticket, `x3` = an order of 3.

## Bundle (`npm run check:bundle-budget`, main vs branch)

- Flags as in prod/CI (ticketing off): every route identical to main to 0.1 KB (dancer-app 373.6 KB
  both); the door code is not in the build at all.
- Flags ON (self-serve + P3 + ticketing): identical to main on every route; dancer-app reads
  375.5 KB on main too (over its 374 KB budget on main already, not this PR). Door chunk
  `DoorScreen-*.js` 19.9 KB raw / 7.4 KB gz; `jsQR-*.js` 130 KB raw / 46 KB gz, fetched only on a
  phone without `BarcodeDetector` (iPhone Safari), only from the door screen. jsQR chosen: no deps,
  pure JS, Apache-2.0, last published 2025; the alternatives were zxing-wasm / barcode-detector
  polyfill (~900 KB wasm) or qr-scanner (last release 2022).

## Left / next

- Real camera scan on a phone: NOT verified (no device here). The camera path is proven only with
  Chromium's fake device (no QR in it) and a unit camera mock.
- Typing a 64-character code at the door is slow; a shorter human code would need a DB change
  (out of scope). The buyer can paste it from the email.
- No check-in-from-list RPC exists, so the list is read-only (C drew tap buttons).
- `unit-tests` locally: `tests/integrityCouldNotRun.test.ts` fails 5 in this sandbox on main too
  (precondition "typescript resolved in the temp repo"), not this diff.
- Stage 5 critique and stage 6 walk: the orchestrator's.
