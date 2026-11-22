# Editor v2 slice 15 handover (one-off page + sold counts)

Files: `OneOffBody.tsx` (new), `EditorV2.tsx`, `EndCard.tsx`, `NightCard.tsx` (label + no tags/back-to-usual for one-off), `NameSheet.tsx` (hint hidden when no day), `copy.ts` (`oneOff` block), `__tests__/oneOff.test.tsx` (new, 10 tests), `priceSheet.test.tsx` + `openTickets.test.tsx` (their `tickets/data` mocks gained `useSummary`). NightCard and NameSheet are outside the brief's file list; each change is one line and needed for O-03/O-05 and the Name sheet. Flag stays OFF; no migration.

## Checklist
| Row | State |
|---|---|
| O-01 no tabs/chips | BUILT-EARLIER (weekly-only gates); test added |
| O-02 long date title, no scope line | BUILT-NOW (title uses full date incl. year; scope line weekly only) |
| O-03 label | BUILT-NOW |
| O-04 same card | BUILT-EARLIER |
| O-05 no Only-this-night tags / Back to usual | BUILT-NOW (NightCard) |
| O-06 Cancel this night + sold warning | BUILT-EARLIER; real `soldCount` BUILT-NOW |
| O-07 going card + tiles | going BUILT-EARLIER; real sold/money BUILT-NOW |
| O-08 On the night group | BUILT-EARLIER (Guest list, Raffle; no Note row exists; no refund row) |
| O-09 The event group | BUILT-NOW |
| O-10 Tickets row | BUILT-NOW in group (card row from 12c kept) |
| O-11 End card | BUILT-NOW (no Cancel row, End sub "Dancers see it as ended.") |
| O-12 Share this night | BUILT-EARLIER |
| O-13 toast "Saved" | BUILT-EARLIER (`savedLabel('oneOff')`), used by new rows |

## Tap table
| Tap | Button | Destination | Prototype/OLD |
|---|---|---|---|
| 27 | Tickets "Prices and how dancers pay" | Tickets screen (`openTickets`) | prototype |
| 36 | Save the date | empty: "Add a date."; unchanged: closes; else move_date, toast "Saved" | prototype, but NO Undo (see UNBUILT) |

## UNBUILT
- Undo on "Save the date": `inverseOf` (editorModel.ts, off limits) has no `occurrence.move_date` case; slice 7b deliberately sends `noUndo`. Needs an inverse case.
- Weekly per-night sold count: the sales read has per-type totals only. A night counts types tied to it (`occurrenceId`); series-wide types sold on that night are not counted. No RPC invented.
- One-off "End the event" uses a small confirm sheet (StatusSheet has a weekly last-night date field) and sends `series.end_run` with no "tonight" answer; not tried against the server.
- Cancelled one-off (series status cancelled): End card shows no rows; the night card brings it back.

## Verified / Not verified
Verified: `npx vitest run src/modules/organiser/p3/v2`: 27 files, 348 pass. tsc (tsconfig.app.json): 0 errors in touched files (1 pre-existing in `__tests__/eventPage.proto.test.ts`). `npm run check:mojibake` clean.
Not verified: 390x844 browser walk; prod data-shape survey; /code-review; pre-ship; tests against unfixed code. No PR opened (brief: stacked on claude/editor-v2-s1c).
