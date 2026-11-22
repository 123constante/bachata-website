# Editor v2 slice 13 handover (ticket sheet with early birds)

Files: `TicketSheetV2.tsx` (new), `EarlyBirds.tsx` (new), `TicketsV2.tsx` (taps 91/92 + loading gate), `copy.ts` (`ticketSheet` block), `__tests__/ticketSheet.test.tsx` (new, 21 tests). Flag `organiserEditorV2` stays OFF; no migration; no admin change; no edit to payMode / editorModel / saveNow / Facts / shared / p3/tickets.

## Tap table
| Tap | Button | Destination | Prototype/OLD |
|---|---|---|---|
| 91 | ticket card (`tk-ticket-<id>`) | Sheet "Ticket", filled from the type + its price steps | prototype; opens only once the steps read has landed (else "Not saved. Try again.") |
| 92 | Add a ticket (`tk-new`) | Sheet "Add a ticket", empty (50 places) | prototype |
| 102 | Free ticket switch (`t-free`) | same sheet: price + early birds hidden/shown, hint shown | prototype |
| 103 | Add an early bird price (`eb-add`) | +1 row (price = main-2, empty date); max 3 (the server's MAX_STEPS) | prototype + OLD limit |
| 104 | x (`eb-del-<i>`) | row removed | prototype |
| 105 | Done (`t-done`) | below sold: error line, no write; untouched: closes, no command; else write, close, toast "Saved" + Undo | prototype; writes = OLD (`ticket_type_upsert_v1`, `ticket_price_step_set_v1` / `_remove_v1`, `ticket_type_set_status_v1`) |
| 106 | Remove this ticket (`t-remove`) | `ticket_type_set_status_v1` closed, toast "Ticket removed" + Undo (restores prior status); disabled with hint when sold > 0 | prototype; "remove" = close, as OLD |

## How early birds are stored (no new RPC)
A type keeps a base price + up to 3 steps. Sheet "Price" = the price after the last step; each early bird row = one earlier price. Birds sorted by date: base = first bird price, step k starts the morning AFTER bird k's "Until" date (London midnight) at bird k+1's price, last step = main price. `formOfStored`/`wantedOf` in `EarlyBirds.tsx` are the two-way mapping (tested, incl. summer/winter).
Write order: remove vanished steps, upsert (name/base/places) if changed, set new/moved steps, new ticket then put on sale. A step already live is never moved/removed (refused before any write). Failure after a write: best-effort restore of the old ticket, error line + no Saved toast. `inFlight` ref + disabled/aria-busy buttons. Undo of an edit re-applies the old form against a fresh read of the steps.

Also: Connect-Stripe screen no longer shows while `stripe.state === null` (shows "Loading..." line instead).

## Verified / Not verified
Verified: `npx vitest run src/modules/organiser/p3/v2`: 25 files, 325 pass. tsc (`tsconfig.app.json`) run on the branch: 0 errors in files I touched (1 pre-existing error in `__tests__/eventPage.proto.test.ts`). `npm run check:mojibake` clean.
Not verified: 390x844 walk; real RPCs (all mocked, incl. step RPC argument shapes taken from `ticketsApi.ts`); prod data-shape survey; /code-review; pre-ship; new tests were not run against unfixed code (new feature).
Known gaps / decisions for the owner:
- "Busiest night" sold count: only a per-type total is read on this screen. For a type tied to one night it is that total; for a series-wide type it is `min(total, places)` so it can never block a save wrongly. Real per-night counts need a per-night read (slice 15 territory).
- "Until" date = new price starts the next morning (London); an existing step is read back as the day before.
- The `ticketPriceStepsEditor` flag is not consulted (v2 is behind its own flag); if the server has price steps off it will refuse and the sheet shows the server's words.
- Early birds on a type with orders: server's has_orders lock on base price applies.
- New ticket is put on sale at once (as the old editor's "Put on sale"); Stripe-not-connected gating of that is not replicated (the Tickets screen already shows Connect first).
