# Brief: Editor v2 PriceSheet defects (stale Undo snapshot, Back to usual leaves prices cleared)

Branch: claude/editor-v2-pricesheet-fix
Size: 2 files, 150 lines
Repo: 123constante/bachata-website. Base: origin/main (PR 1865 is merged). Flag `organiserEditorV2` stays OFF; zero migrations; no visual change; no copy change.
Design: no visual change. Behaviour only, in `src/modules/organiser/p3/v2/PriceSheet.tsx` (`NightPriceSheet`, functions `writeAll`, `toastWithUndo`, `saveTickets`, `backTickets`).

## Files (touch only these; max 2)
- src/modules/organiser/p3/v2/PriceSheet.tsx
- src/modules/organiser/p3/v2/__tests__/priceSheetFix.test.tsx (new; reuse the mocks/harness style of `slice17e.test.tsx` in the same folder)
Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only (no raw Unicode punctuation outside comments).

## Defect 1: Undo rollback restores from a stale snapshot
Today `writeAll(changes)` records `before: byId.get(c.id)?.nightPence ?? null` where `byId` is the night-prices read captured at render time. After a save the read is stale, so when an Undo (which itself calls `writeAll`) fails half way, its rollback writes the PRE-SAVE price back instead of the price that was live just before the Undo ran. `saveTickets` and `backTickets` also compute their Undo `restore` lists from the same closure.
Fix: `writeAll` takes each change WITH its own `before` (`{ id, pence, before }[]`), supplied by the caller at call time, and uses only that for its rollback. Callers:
- `saveTickets`: `before` = `byId.get(c.id)?.nightPence ?? null` read at tap time (fresh); the Undo restore entries are `{ id, pence: thatBefore, before: c.pence }` (the Undo's own rollback target is the price just written).
- `backTickets`: write entries `{ id, pence: null, before: t.nightPence }`; Undo restore entries `{ id, pence: t.nightPence, before: null }`.
- The Undo path never reads `byId`.

## Defect 2: backTickets leaves night prices cleared when onBack fails
`backTickets` (tickets state, `changed` true) clears every night price, then calls `onBack()` (the occurrence override revert). If `onBack()` returns `{ok:false}` or throws, the night prices stay cleared while the sheet stays open showing the failure.
Fix: if `onBack()` does not return ok (not `{ok:false}`, no throw), write the cleared prices back with `writeAll` (entries `{ id, pence: t.nightPence, before: null }`), then return the `onBack` failure (its `error`, or `P.notSaved` when it threw). Success path unchanged. Never a false "Saved".

## Checklist (each is a test in priceSheetFix.test.tsx that FAILS on current main)
- [ ] D1a Save 2 tickets (10 -> 12, 8 -> 9), then Undo where the second restore write fails: the first restore is rolled back to 12 (the price live just before the Undo), NOT to 10
- [ ] D1b Back to usual prices toast Undo where the second restore fails: first ticket rolled back to null (cleared), not to its old night price
- [ ] D1c Undo happy path still writes each ticket's previous night price (null when none) (regression)
- [ ] D2a `changed` true, night prices exist, `onBack` returns `{ok:false,error:'x'}`: night prices are written back (RPC called with each original `nightPence`), the sheet stays open, the failure line shows
- [ ] D2b same with `onBack` throwing: prices written back, `P.notSaved` shown
- [ ] D2c `onBack` ok: prices stay cleared, no restore write, sheet closes (regression)
- [ ] D2d `changed` false: no `onBack`, toast with Undo as today (regression)
- [ ] Existing v2 tests (slice17d, slice17e, priceSheet) all green

## Handover
`docs/briefs/editor-v2-pricesheet-fix.handover.md`: what changed, the tests, Verified / Not verified (no live RPC calls, no writes). Run `npm run test:unit -- src/modules/organiser/p3/v2` and `npx tsc --noEmit -p .`, `npm run check:mojibake`. No secrets. Commit, push to claude/editor-v2-pricesheet-fix, open ONE PR against main (body from `~/.claude/docs/pr-body-template.md`). Do not merge.
