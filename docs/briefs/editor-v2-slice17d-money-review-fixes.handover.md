# Slice 17d handover (money review fixes, slices 12-14)

Branch claude/editor-v2-s1c. Flag organiserEditorV2 OFF. No migrations, no PR (per brief).

## Tap table (button | destination | prototype/OLD)
| button | destination | built |
|---|---|---|
| Ticket sheet Undo (name / places edit) | writes the previous name / places back | prototype |
| Ticket sheet Done, new ticket, later write fails | half-made row closed; retry makes one ticket | prototype |
| Sell tickets here, nothing reopenable | "Not saved. Try again." instead of false "Selling tickets here" | prototype |
| Remove ticket / Done on a saved ticket | refused while sales are unknown | prototype |
| Price sheet (tickets state) inputs | read-only | prototype (no SH-PRICE editable proof found, so read-only) |
| Back to the usual price | closes only on success; failure shown | prototype |

## Findings
1 fixed (writeTicket `force` for restore/rollback). 2 fixed by closing the orphan (createdId). 3 fixed as no-false-success: the paused-by-switch set is still sessionStorage only. 4 fixed (non-midnight steps can exist: admin step RPC takes any instant; same London day keeps the stored instant). 5 fixed (soldKnown prop; openTicket refuses until summary ok). 6, 7 fixed.
Files outside the brief list: NightCard.tsx and EditorV2.tsx (onBack now returns the save result, needed for 7); moneyFixes.test.tsx (one test pinned the false success of 3).

## UNBUILT
- Slice 14 per-night ticket price write (inputs read-only until it exists).
- TicketsV2 per-date sold for series-wide tickets (~186); stripe poll `ret.again` (~204).
- A hand-paused ticket plus Sell here now also says "Not saved" (cannot tell it from a reload); a dedicated line needs copy.ts.
- End Undo (83.1) as in 17b.

## Verified / Not verified
Verified: v2 unit tests 378 pass; 9 of 10 new tests fail on the old code (the success-close case passes on both); tsc 0 errors; check:mojibake run.
Not verified: 390x844 walk; real-data survey; CI jobs; eslint; e2e; a retried orphan whose close call also fails stays closed-less.
