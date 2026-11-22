# Editor v2 slice 11c handover (Cancel the event, weekly Every tab)

Cancel = one `occurrence.cancel` step per coming, not-yet-cancelled night, one `saveNow(steps, [], 'Event cancelled', { noUndo: true })`. Cancelled state is derived: series cancelled OR every coming night cancelled (reason = first coming night's `cancellationReason` from date detail). "Make it live again" in the derived state sends `uncancelCommand()` per cancelled coming night in one save, with Undo (befores carry the reason). `soldCount` = 0 (same as night sheet; slice 15 supplies it). Files: EveryBody.tsx, everyStatus.test.tsx.

| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 32 | Cancel the event | card (weekly) -> Sheet "Cancel the event" | prototype |
| 85 | Cancel the event | sheet: closes; chips Cancelled; toast "Event cancelled" (no Undo) | prototype |
| 86 | Keep the event | sheet: closes, nothing sent | prototype |
| 29b | Make it live again (cancelled) | card: uncancel every coming night; toast "Event is live again" | prototype |

Verified: vitest p3/v2 19 files, 242 pass; tsc -p tsconfig.app.json: 0 errors in branch files (only pre-existing eventPage.proto.test.ts); check:mojibake clean.
Not verified: 390x844 walk, prod data-shape survey, pre-ship, /code-review, live server acceptance. No PR (per brief). Series with lifecycle 'cancelled' and no cancelled nights falls back to set_lifecycle live.
