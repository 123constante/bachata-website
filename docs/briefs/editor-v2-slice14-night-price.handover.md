# Editor v2 slice 14 handover (price sheet for this night)

Files: `PriceSheet.tsx` (new: `PriceSheet` + `NightPriceSheet` host), `NightCard.tsx` (Price "Change" opens it), `EditorV2.tsx` (`goTickets`, link sheet), `copy.ts` (`priceSheet` block), `__tests__/priceSheet.test.tsx` (new, 13 tests), `__tests__/openTickets.test.tsx` (shell test updated: tap 10 now opens the sheet). Flag `organiserEditorV2` stays OFF; no migration; no admin change; payMode/editorModel/saveNow/Facts/shared/p3/tickets untouched.

## Tap table
| Tap | Button | Destination | Prototype/OLD |
|---|---|---|---|
| 10 | Price "Change" | Sheet "Price", state by pay mode (`payModeOf` + Stripe + ticket list, read only while the sheet is open) | prototype |
| 53 | Done (door) | one-night `passes` override (first entry = door price), closes, toast "Saved for <date> only" (one-off "Saved") + Undo (old override). Empty/unchanged: closes, no write. Bad price: error line. Failed save: sheet stays open with the error | prototype; write = `occurrence.set_override passes` |
| 53 | Done (tickets here) | closes, NO write (see UNBUILT) | prototype look only |
| 54 | Back to the usual price(s) | `backToUsualStep(date,'price')`, closes, toast "Back to usual for <date>" + Undo | prototype |
| 55 | Change the usual price / All ticket settings / Change tickets for every <day> / Set up tickets / Add your first ticket | sheet closes; weekly: tab "Every <day>" then Tickets screen (`goTickets`) | prototype |
| 56 | Change the link (one-off, link mode) | Sheet "Link to buy tickets" (existing `LinkSheet`; saves the series link through `saveNow` with Undo) | prototype |

State mapping: door = no on-sale ticket and no link; link = link set; Stripe not connected = on-sale tickets but Stripe not `connected`; tickets = on-sale tickets of this night or the series; "No tickets yet" shows only if the on-sale list is empty while mode is "here" (rare: `payModeOf` needs an on-sale ticket for "here", so it is mostly reachable through the pure component).

## UNBUILT
- Tickets-here per-night ticket price save. Searched `ticket_type`, `occurrence`, `prices`, `night_price` in `src/modules/organiser` and `src/lib`: a ticket type can be tied to one night (`occurrence_id`) and carries base price + steps, but nothing sets a one-night price override for a series-wide type. Missing: a write like `ticket_type_night_price_set_v1(ticket_type_id, occurrence_id, price_pence)` plus its read. The sheet renders the fields exactly as the prototype; Done closes without saving (and the fields are NOT saved). "Back to the usual prices" clears the `passes`/`ticket_url` keys only, as the Price fact's chip does.

## Verified / Not verified
Verified: `npx vitest run src/modules/organiser/p3/v2`: 26 files, 338 pass. tsc (`tsconfig.app.json`) run on the branch: 0 errors in files I touched (1 pre-existing in `__tests__/eventPage.proto.test.ts`). `npm run check:mojibake` run (see commit).
Not verified: 390x844 walk; prod data-shape survey; /code-review; pre-ship; tests not run against unfixed code (new feature).
