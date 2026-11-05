# Independent walk of PR #1294 (door code screen), r1

Head walked: `5a36f80` (branch `claude/ticket-door-code-screen`). Fresh worktree, `npm ci`, Vite dev server,
Playwright chromium at 390x844, dark scheme, flags `organiserP3` + `organiserTicketing` + `ticketDoorCode` ON
(and `ticketDoorCode` OFF for state 16). RPCs route-mocked in the live prod shapes (reused `OrganiserFake`;
reply shapes from `docs/handover/ticket-door-code-screen.md` and the spec). No prod call, no write.
Script: `walk.spec.ts.txt` (the spec as run; copy to `tests/e2e/` to re-run). Raw numbers: `measure.jsonl`.
Measured per picture, inside `[data-testid=door-screen]` only: tap targets (button, a, input) vs 44 px,
`documentElement.scrollWidth` vs 390, elements whose text overflows a clipping box, WCAG contrast of the result
banner text and of the reason / disabled text (alpha composited over real ancestor backgrounds).

Result across ALL 23 pictures: every tap target >= 44 px (smallest 44), scrollWidth 390 = viewport (no sideways scroll),
0 clipped elements. So those three columns are "pass" everywhere and not repeated below.

| # | State | Picture | Measured | Verdict | Finding (severity) |
|---|---|---|---|---|---|
| 1 | Ready | 01-ready | 5 taps, disabled Check in 6.46:1 | PASS | Check in is dimmed with no typed text, tap shows the reason (see 2). Low: the dimmed orange looks "broken" next to the camera panel; not a blocker. |
| 2 | Empty input | 02-empty | 0 RPC calls; reason "Type or paste the code first" 6.74:1 | PASS | Nothing sent, reason shown. |
| 3 | Malformed K7M2Q0 | 03-malformed-K7M2Q0 | 0 calls; reason 6.74:1 | PASS | Reason says 6 letters/numbers, never 0, 1, I, L, O. |
| 4 | Malformed IOL123 | 04-malformed-IOL123 | 0 calls; reason 6.74:1 | PASS | Same copy as 3. |
| 5 | `k7m-2qx` | 05-lowercase-dash | request body `p_code:"K7M2QX"`, LET IN banner 12.6:1 | PASS | Normalised to K7M2QX before send. |
| 6 | LET IN | 06-let-in | banner 12.6:1 | PASS | "Let them in. Then scan the next code." Scan next is on screen. |
| 7 | Already used | 07-already-used | banner 11.82:1 | PASS | "Do not let in again..." Clear. |
| 8 | Wrong code | 08-wrong-code | banner 7.52:1 | PASS | "Type the code ... or find their name on tonight's list": both Type code and Open list actions are on screen. |
| 9 | too_many_attempts | 09-too-many, 09b-too-many-list | banner 11.82:1; list banner 8.1:1; 6 of 6 rows have an enabled Check in | PASS | Copy says "Wait up to 15 minutes ... open tonight's list, find their name and tap Check in", and the Open tonight's list button is on screen; the list shows the banner and Check in on every row. |
| 10 | List, 0 rows | 10-list-0 | 4 taps | PASS | Empty state, no Check in buttons; text offers the next step. |
| 11 | List, 1 row | 11-list-1 | 1 row, 1 enabled Check in | PASS | |
| 12 | List, 120 rows (20 in) | 12-list-120, 12b-list-120-bottom | 104 taps, 100 enabled Check in (the 100 Not-in rows; 20 In rows have none), width 390 | PASS | Low: no sticky search on a 120-row list; staff scroll or type a first name (search works). Not a dead end. |
| 13 | Check in on a row | 13a-row-checking, 13b-row-let-in | during delay: the other 5 rows get the "Checking the last ticket... wait for the answer." line (6.74:1) and `aria-disabled`; id RPC sent once with `p_ticket_id`; then LET IN 12.6:1 and rows enabled again | PASS | Observed: the button label does not show "Checking..." in the screenshot window on the row itself, the page-level reason line does. Low (wording, not behaviour). |
| 14a | Refused role, list answers `not_allowed` on load | 14a-refused-list-load | 0 Check in buttons; banner 8.1:1 | PASS with note | Brief asked for "disabled with a reason"; the screen instead removes the rows and shows CANNOT CHECK TICKETS + what to do. No enabled Check in exists, so the intent holds. Info. |
| 14b | Refused role on a row Check in | 14b-refused-row-checkin | id RPC called once, then 0 Check in buttons, card 8.1:1 | PASS with note | Same as 14a. Medium (dead-end, see below): the person is left on a card with no button. |
| 14c/d | Refused role on a typed code, then open the list | 14c-refused-typed, 14d-refused-then-list | 0 Check in buttons | PASS with note | Same card on both tabs. |
| 15a | No signal on a typed code | 15a-no-signal | banner 8.1:1; the screen moves itself to the list | PASS | Banner says NO SIGNAL and shows when the list was loaded. Rows still have enabled Check in. |
| 15b | No signal, list | 15b-no-signal-list | same | PASS | |
| 15c | Check in on a row with no signal | 15c-row-checkin-no-signal | the id request never reaches a server; banner shown 8.1:1; rows stay enabled | PASS | Staff can retry by tapping again. |
| 16 | Flag OFF | 16a-flag-off-scan, 16b-flag-off-list | scan: 0 Check in, no reason line; list: 6 rows, 0 Check in buttons; the note reads "Read only: to check someone in, scan or type their code." | PASS | Matches main behaviour for the door screen (no Check in buttons). I did not run a pixel diff against a main build. |

## Dead ends for door staff at a busy door

1. **Refused role (14b) is the one true dead end.** A team member who is refused on a row Check in sees the
   CANNOT CHECK TICKETS card and nothing to tap except the two tabs; the copy says "open this screen again", which
   needs the browser reload. Medium. Suggest a Back/Reload button on that card.
2. **While one Check in is pending (13a) every other row is blocked** (by design, one at a time). On a slow network a
   line of people waits on one request; there is no timeout or cancel seen in this walk (the mock delay was 1.5 s, I
   did not test a hung request). Medium, unverified beyond 1.5 s.
3. **No signal on a row Check in (15c)** keeps the banner but the row itself gives no "failed, tap to retry" text.
   Low.
4. **Too-many-attempts (9) removes the typed-code route for up to 15 minutes**, and the only way forward is the
   list, which needs the name. A buyer who only has a code (no name given on the ticket row, "No name given") cannot be
   found by name. Low-Medium; real-data question for the owner.
5. The short code must reach the buyer (the PR handover says this is unverified). Not a screen issue, gating for flag ON.

## Verified
- All states above rendered and measured at 390x844 dark with the three flags on, plus flag OFF; 22 mocked-flag-on screenshots + 2 flag-off.
- Typed short-code normalisation and the malformed block verified at the network layer (request bodies in `measure.jsonl`).
- Contrast >= 4.5:1 everywhere measured (lowest 6.46:1 disabled button, 6.74:1 reason text, 7.52:1 banners).

## Not verified
- A real phone and a real camera (the camera tile in the pictures is Chromium's fake video device, the green pie).
- Real RPC replies, a real staff account, real prod data (mocks only; prod had 0 check-ins per the PR handover).
- A hung or very slow RPC (> 1.5 s), double-tap races, iOS Safari keyboard behaviour, haptics.
- Light theme (the screen ships dark).
- A pixel diff of flag-OFF against a main build; I checked structure (no Check in, same note) only.
- The role-based "disabled with a reason" the brief expected: the screen does not render disabled buttons for a refused role.
