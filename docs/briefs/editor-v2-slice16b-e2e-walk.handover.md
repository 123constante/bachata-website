# Handover: Editor v2 slice 16b (390x844 tap-walk spec) PARTIAL

Branch claude/editor-v2-s1c. No PR (brief). Tests only: `tests/e2e/organiser-editor-v2.spec.ts` rewritten (table-driven ROWS, OLD-URL guard on every tap, row 113, X-01..X-13). `organiserFake.ts` unchanged: tickets/Stripe/sales are mocked inside the spec with `page.route`.

## Run result (390x844, flag env as in MANUAL, 4 workers)
**61 passed, 50 failed, 2 skipped, 0 test.fixme applied.** NOT green.

## BUILT UI DIFFERS / OLD / FIXME
**Not yet classified.** The 50 failures are mostly click/fill timeouts on controls found by my guessed labels (Tickets screen, session sheet, Where search, price sheet field, When date input, Guest list switch) or wrong expected text. Each still needs one look: spec locator wrong (fix) vs built UI differs (then `test.fixme` + list here). No row is claimed OLD. Known UNBUILT (from earlier handovers, not fixed): row 36 move_date Undo, weekly per-night sold count, per-night ticket price write.

Likely real differences to check first: X-08 one-off still shows the `ev2-tab-night` element; X-06 'ends after' text absent for weekly with end date (fake `recurrence_rule.until` may be the wrong field); X-02 changed-venue state not produced by the fake (setup missing); row 83 End the event toast has no Undo with these inputs; row 50 venue pick toast text.

## Tap table with `built` column
X-14 past night: not defined by prototype (SKIPPED). Rows 1, 15, 18, 49, 57, 61, 88-90, 107-112 are STUB/PROTO-ONLY and not tested except row 88 (see list). Row 16 refund and row 19 note are LEFT OUT by owner: asserted ABSENT.

| # | button | state | built |
|---|---|---|---|
| 2 | This night tab | weekly | prototype (spec passes) |
| 3 | Every <day> tab | weekly | prototype (spec passes) |
| 4 | date chip | weekly | prototype (spec passes) |
| 5 | More dates | weekly | prototype (spec passes) |
| 6 | date row in All dates | weekly | prototype (spec passes) |
| 7 | Flyer and photos | weekly | prototype (spec passes) |
| 8 | When Change | weekly | prototype (spec passes) |
| 9 | Where Change | weekly | prototype (spec passes) |
| 10 | Price Change | weekly | prototype (spec passes) |
| 11 | Description Change | weekly | prototype (spec passes) |
| 13 | Cancel this night | weekly | prototype (spec passes) |
| 16 | refund row (left out by owner) | weekly | prototype (spec passes) |
| 17 | Guest list | weekly | FAILING (unclassified) |
| 19 | Note for this night (left out by owner) | weekly | prototype (spec passes) |
| 20 | Share this night | weekly | prototype (spec passes) |
| 66 | Copy link (share sheet) | weekly | prototype (spec passes) |
| 33 | Close x | weekly | prototype (spec passes) |
| 35 | Name Done empty error | weekly | prototype (spec passes) |
| 35.1 | Name Done saves | weekly | prototype (spec passes) |
| 34 | Undo | weekly | prototype (spec passes) |
| 37 | session row (When sheet) | weekly | FAILING (unclassified) |
| 38 | Add a class or party (When sheet) | weekly | prototype (spec passes) |
| 39 | Back to the usual times | changedVenue | FAILING (unclassified) |
| 43 | session Type chips | weekly | FAILING (unclassified) |
| 44 | session Level chips | weekly | prototype (spec passes) |
| 47 | session Done: ends before start | weekly | FAILING (unclassified) |
| 48 | Remove this one | weekly | FAILING (unclassified) |
| 50 | venue row | weekly | FAILING (unclassified) |
| 51 | typed venue | weekly | FAILING (unclassified) |
| 52 | Back to the usual venue | changedVenue | FAILING (unclassified) |
| 53 | Price Done (night) | door | FAILING (unclassified) |
| 55 | Price sheet: change usual -> Tickets | here | FAILING (unclassified) |
| 56 | Change the link (price sheet) | link | FAILING (unclassified) |
| 58 | Remove the flyer | weekly | prototype (spec passes) |
| 62 | Add a video | weekly | FAILING (unclassified) |
| 67 | Guest list switch | weekly | FAILING (unclassified) |
| 70 | Cancel this night (sheet) | weekly | prototype (spec passes) |
| 71 | Keep this night | weekly | prototype (spec passes) |
| 74 | Description Done | weekly | prototype (spec passes) |
| 75 | Back to the usual description | changedVenue | FAILING (unclassified) |
| 14 | Bring this night back | cancelledNight | prototype (spec passes) |
| 72 | Bring it back | cancelledNight | prototype (spec passes) |
| 73 | Keep it cancelled | cancelledNight | prototype (spec passes) |
| 21 | Every When Change | weekly | FAILING (unclassified) |
| 22 | Every Price Change | weekly | prototype (spec passes) |
| 9.1 | Every Where Change | weekly | prototype (spec passes) |
| 23 | Name | weekly | prototype (spec passes) |
| 24 | Description (every) | weekly | prototype (spec passes) |
| 25 | Music | weekly | prototype (spec passes) |
| 26 | Repeats | weekly | prototype (spec passes) |
| 28 | Organisers | weekly | prototype (spec passes) |
| 30 | Pause the event | weekly | prototype (spec passes) |
| 31 | End the event | weekly | prototype (spec passes) |
| 32 | Cancel the event | weekly | prototype (spec passes) |
| 40 | session row (Classes and party) | weekly | FAILING (unclassified) |
| 41 | Add a class or party (Classes and party) | weekly | FAILING (unclassified) |
| 42 | Done (Classes and party) | weekly | FAILING (unclassified) |
| 76 | Music chip | weekly | prototype (spec passes) |
| 77 | Music Done | weekly | prototype (spec passes) |
| 78 | Repeats Done | weekly | prototype (spec passes) |
| 81 | Organisers Done | weekly | prototype (spec passes) |
| 82 | Pause the event (sheet) | weekly | prototype (spec passes) |
| 83 | End the event (sheet) | weekly | FAILING (unclassified) |
| 84 | Keep it live | weekly | prototype (spec passes) |
| 85 | Cancel the event (sheet) | weekly | prototype (spec passes) |
| 86 | Keep the event | weekly | prototype (spec passes) |
| 29 | Make it live again (paused) | paused | prototype (spec passes) |
| 29.1 | Make it live again (ended) | ended | prototype (spec passes) |
| 87 | <- event name | here | prototype (spec passes) |
| 91 | ticket card | here | FAILING (unclassified) |
| 92 | Add a ticket | here | FAILING (unclassified) |
| 94 | Pay at the door (nothing sold) | here | FAILING (unclassified) |
| 94.1 | Pay at the door (sold) asks | sold | FAILING (unclassified) |
| 96 | Keep selling | sold | FAILING (unclassified) |
| 95 | Switch | sold | FAILING (unclassified) |
| 93 | Sell tickets here (door) | door | FAILING (unclassified) |
| 97 | add a link (door) | door | FAILING (unclassified) |
| 98 | link Done empty error | door | FAILING (unclassified) |
| 98.1 | link Done saves | door | FAILING (unclassified) |
| 99 | Change the usual price (door) | door | prototype (spec passes) |
| 100 | door usual Done | door | FAILING (unclassified) |
| 101 | Change how dancers pay | door | prototype (spec passes) |
| 88 | Sell tickets here (no Stripe) | noStripe | FAILING (unclassified) |
| 102 | Free ticket switch | here | FAILING (unclassified) |
| 103 | Add an early bird price | here | FAILING (unclassified) |
| 104 | Remove this early bird price | here | FAILING (unclassified) |
| 105 | ticket Done | here | FAILING (unclassified) |
| 106 | Remove this ticket | here | FAILING (unclassified) |
| 27 | Tickets (Prices and how dancers pay) | oneOff | FAILING (unclassified) |
| 36 | Save the date: empty error | oneOff | FAILING (unclassified) |
| 36.1 | Save the date saves | oneOff | prototype (spec passes) |
| 53.1 | one-off Price Done toast | oneOff | FAILING (unclassified) |

Rows with no entry in the spec yet: 12 (Back to usual under a changed fact, only via 39/52/75), 45/46 (add/remove person chip), 60/61/63/64 (gallery photo sheet), 68/69 (refund, left out), 79/80 (Change repeat? sheet), 59 (Back to the usual flyer), 54, 65 (note, left out), 15 STUB.

## Verified / Not verified
Verified: spec runs to completion at 390x844; counts above; `expectNoHorizontalScroll` runs after each row.
Not verified: green run; classification of the 50 failures; the missing rows above; `tsc` on the spec (tsconfig.app.json does not include tests; 0 errors mention it); `npm run check:e2e-spec`; real-data shape survey (tests only); screenshots under docs/design/editor-v2/shots are only written by passing X-tests.
