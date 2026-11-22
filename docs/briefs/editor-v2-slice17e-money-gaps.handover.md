# Slice 17e handover (money gaps: per-night ticket price, per-date sold, Stripe Check again)

Branch claude/editor-v2-s1c. Flag organiserEditorV2 OFF. No migrations, no PR (per brief). NightCard.tsx NOT changed.

## Tap table (button | destination | prototype/OLD)
| button | destination | built |
|---|---|---|
| Price sheet Done (tickets) | validates changed fields, `ticket_night_price_set_v1` one ticket at a time, closes, toast + Undo; second failure puts the first back, sheet stays | prototype |
| Back to the usual prices (tickets) | `ticket_night_price_set_v1(.., null)` per overridden ticket; closes only if all succeed; toast "Back to usual for <date>" + Undo | prototype |
| Undo on the Done toast | writes each ticket's previous night price (null if none) | prototype |
| Undo on the Back-to-usual toast | restores each night price | prototype |
| Check again (Stripe warn) | `ret.again()`: poll restarts, warn hides until the next timeout; disabled while busy | prototype |
| Tickets per-date line | series-wide ticket reads `nights` of `ticket_sales_summary_v2`; night-bound unchanged; failed summary shows 0 | prototype |
| Change the usual price / Add your first ticket | unchanged links | prototype |

## Notes
- The toast must outlive the sheet (NightCard unmounts it on close and may not change), so PriceSheet.tsx renders it in its own React root on the body (`showToast`). `clearNightPriceToast` is exported for tests.
- `ticketModel.ts` (6th file) was not touched: `nights` lives on `SalesWithNights = TypeSales & { nights?: NightSold[] }` in ticketsApi.ts.
- Summary now calls `ticket_sales_summary_v2`; a v1-shaped answer parses to `nights: []`.
- Partial failure with a reason of `night_past` / `not_owner_or_admin` shows that reason's line; an unknown reason shows "Not saved. Try again.".
- In jsdom a number input drops "abc" to empty, so the bad-price test uses 0 and -5.

## UNBUILT
- End Undo (83.1) as in 17b. Hand-paused ticket + Sell here line (17d).

## Verified / Not verified
Verified: slice17e.test.tsx 24 tests, all fail on the 17d source (they fail at import/first assertion, not individually isolated); v2 + ticket unit tests green; tsc 0 errors (run on the commit before the handover); check:mojibake clean; eslint 0 errors on touched files. /code-review not run.
Not verified: the live RPCs were NOT exercised against prod (no writes, read-only SELECT access only); 390x844 browser walk; real-data shape survey; CI jobs; eslint; e2e; the Undo toast when two toasts overlap (the editor's own toast and this one share a position).
