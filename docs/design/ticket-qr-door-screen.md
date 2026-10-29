# Ticket QR door screen &mdash; design record (stages 3 and 4)

Layout **C** (owner pick) from `docs/design/qr-door-scanning/C.html` on branch
`claude/ticket-qr-door-mockups`: a **Scan** tab (camera, counter, the one answer, the code box) and a
**Tonight's list** tab (first name, quantity, In / Not in). Route `/account/p3/events/:seriesId/door`,
full screen (no P3 tab bar), behind `flags.organiserTicketing` inside the P3 area. Code:
`src/modules/organiser/p3/door/`.

Stages 5 (critique) and 6 (walk) are the orchestrator's.

## Stage 3: tokens

All colour comes from `src/modules/organiser/p3/theme/p3.css`. Added:

| Token | Light set | Dark set (phone setting and forced) | Use |
|---|---|---|---|
| `--amber` | `#8a5a00` | `#ffc061` (owner-approved) | ALREADY IN band |
| `--cam` | `#0b0c0e` | `#0b0c0e` | camera box ground (dark in both sets: it frames a video) |
| `--cam-fg` | `#f1f2f4` | `#f1f2f4` | words / finder corners over the camera |

Everything else reuses existing p3 tokens. A result band is a SOLID status colour with
`--danger-fg` text (p3's "text on a solid status fill" token: white in light, `#1d0a03` in dark):

| Band | Fill token | Results |
|---|---|---|
| ok | `--ok-fg` | `ok` |
| warn | `--amber` | `already_in` |
| bad | `--danger` | `wrong_event`, `not_valid`, `unknown_code` |
| grey | `--mut` | `not_allowed`, `no_signal` (client side) |

The mockup's "light text-colour used solid" idea holds in dark; in light the same tokens are the
dark text colours, so they carry white text instead.

## Stage 3: contrast (computed in `__tests__/p3Theme.contrast.test.ts`, >= 4.5 everywhere)

| Pair | Light | Dark |
|---|---|---|
| `--danger-fg` on `--ok-fg` (LET IN) | 6.98 | 12.60 |
| `--danger-fg` on `--amber` (ALREADY IN) | 5.93 | 11.82 |
| `--danger-fg` on `--danger` (NOT VALID etc.) | 6.54 | 7.52 |
| `--danger-fg` on `--mut` (NO SIGNAL, not on team, the offline banner) | 7.53 | 8.10 |
| `--amber` on `--card` (amber as text) | 5.93 | 8.53 |
| `--cam-fg` on `--cam` (camera words) | 17.47 | 17.47 |
| `--fg` / `--mut` on `--tab` (tabs, counter chip) | 19.14 / 7.53 | 15.85 / 7.51 |

## Stage 4: sizes (px only; the site's html font-size is about 13.5px on phones)

| Control | Height | Notes |
|---|---|---|
| Scan / Tonight's list tabs | 52 px | full-width halves |
| Result actions (Scan next, Type code, Open tonight's list) | 56 px | 18 px bold |
| Code box input and Check | 52 px | visible label above |
| Search input | 44 px (`--tap`) | visible label above |
| Back link (&larr; Event), Try again, Clear search, Back to scanning | >= 44 px | |
| In / Not in on a list row | 32 px | a STATUS CHIP, not a control (see below) |

The e2e spec asserts every visible `a` / `button` / `input` is >= 44 px tall and inside 390 px wide,
no sideways scroll, and the result card fully in the viewport, for every state at 390x844.

Camera box 400 px tall when nothing is shown, 280 px when an answer is up, so camera + band +
person + action fit on 390x844 without scrolling (see the screenshots).

## Departures from the mockup (all forced by data or the brief)

- **List rows are read-only.** C draws "Not in &middot; tap" buttons; there is no RPC that checks a
  ticket in by id (brief), so In / Not in is a status chip and the list note says how to check
  someone in (scan or type their code).
- **NO SIGNAL** does not promise "tap their name in, it syncs": nothing syncs. It opens the list
  (as last loaded, with the time) and says to scan again when signal is back.
- **ok** says "1 person &middot; ticket 1 of an order of 2" and "Let 1 person in. The other ticket in
  this order has its own code." because each ticket row has its own QR token (prod: an order of 3
  has 3 ticket rows). C's "Let 2 people in" would let a whole order in on one scan.
- **NOT FOR THIS EVENT / NOT VALID** sub-lines are generic ("a different event", "refunded or
  cancelled"): the RPC does not return the other event or the refund date.
- **No "Call organiser" / "Share event link" / "Add a guest" buttons**: no phone number, no share
  or add-guest action exists for this screen to call. Copy points only at controls on screen.
- **Code box**: a text field (paste or type), not C's 8-digit keypad: the token is 64 hex
  characters and the ticket email prints it as text.
- **not_allowed** ("You're not on this event's team") is its own grey answer; it also replaces the
  camera and the list when the list read says so.
