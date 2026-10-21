# ER-C4 handover: session editor

Branch `claude/er-c4-sessions` (from `claude/er-s1-rules`, ER-C3). Module root `src/modules/organiser/sessions/`.

## Pinned interface (later slices import these)
- `sessionsModel.ts` (pure): `SessionDraft {id, kind, name, start, end, otherLength, levels, room, showRoom, people}`; `newSession(kind, start, id?)`, `setKind/setStart/setEnd/setLength/chooseOtherLength/toggleLevel/setRoom`, `startOptions(keep?)`, `endOptions(start, keep?)` (later times only, "(next day)" past midnight), `roomVisible/addRoom/removeRoom` (list-wide), `addPerson/removePerson/pushRecent/recentFor/hitsFor`, `sortSessions/addAnother/removeSession`, `sessionIssues/listIssues` (reasons: "Name needed", "End after start", "Pick a level"), `nightSpan`, `searchRole`. Rules come from `shared/eventRules.ts` (`sessionKindRules`, `validSessionPair`, `startFromSessions`, `endFromSessions`).
- `SessionCard.tsx`: one session. Props `session,title,onChange,onRemove|null,roomShown,onAddRoom,onRemoveRoom,recent,onPicked,search,showIssues`.
- `SessionSheet.tsx`: `<SessionSheet open onOpenChange sessions onSave search recent onRecentChange max? returnFocusRef? />` edits a copy, Done saves the time-ordered list (disabled with the reason while invalid), Escape/Close drops it. Mount it only while open; the parent passes `returnFocusRef` from `useOpenerRef`.
- `search` is injected: `(term, role: 'teaching'|'djing') => Promise<{id,name}[]>`. Callers wrap `searchPickerRows` (dates/peoplePicker) or `searchPeople`. Recent (last 3) is owned by the caller (state or storage).
- Not done here: nothing maps stored sessions <-> `SessionDraft`, and no screen uses the card yet (create, event page, one date, festival days wire it in their own slices). One edit outside the dir: `__tests__/focusReturn.test.tsx` lists `sessions/SessionSheet.tsx` (its ratchet of SheetView call sites).

## Verified on real data
Read-only survey of prod `stsdtacfauprzrdebmzg`, `event_series_program_item_p5` (counts only):
| type | n | no times | end<=start (wraps) | with room | with level |
|---|---|---|---|---|---|
| party | 365 | 220 | 71 | 33 | 0 |
| class | 272 | 3 | 7 | 70 | 138 |
| masterclass | 19 | 0 | 0 | 7 | 11 |
| workshop | 2 | 0 | 0 | 0 | 0 |
| performance | 2 | 0 | 0 | 0 | 0 |
| competition | 1 | 0 | 0 | 0 | 0 |
| show (old type) | 1 | 0 | 0 | 0 | 0 |
Shapes the model is tested against: wraps past midnight (71 parties), after-midnight starts sorted last, off-grid stored times kept selectable, room on some sessions only (the box then shows on all), level only on class + masterclass (6 of 8 stored kinds carry none). Shapes it does NOT cover yet: untimed sessions (220 parties) and level-less classes (134) both block Done until filled; the screen that loads them decides how to pre-fill (parked). Type `show` is not one of the six kinds.
The festival shape survey from ER-COMMON (7 live festivals, median 6 sessions, max 14) is covered by the 14 cap; not queried again.

## Phone QA (390x844)
NOT DONE. No route renders the card yet and the slice may touch only `sessions/**`, so no browser walk was run. Sizes are explicit px (44px targets, 48px fields, 16px text) per ER-COMMON. First slice that mounts the card owes the walk.

## Checks run in the sandbox
| Command | Exit |
|---|---|
| `npx vitest run src/modules/organiser/sessions` (123 tests: 6 kinds x 4 lengths x 5 starts, midnight wrap, levels, room rule, impossible end, focus + Escape) | 0 |
| `npm run lint` chain | 1 only on `check:integrity` ("Permission denied": exec bit missing in sandbox); `bash bin/check-integrity.sh` exit 0; all other 18 links PASS; `lint:eslint` skipped by the chain, `npx eslint` on the new dir + edited test: clean |
| `npx tsc --noEmit -p tsconfig.app.json` (no errors in `organiser/sessions`) | 0 errors in the dir |
| `npm run build` | 0 |
| `npm run test:unit -- src/modules/organiser` | first run 2 failures (`focusReturn`: new SheetView call site); fixed and re-run those + the new tests: 0 |
Not run: full `test:unit` for the whole repo, e2e smoke (no screen yet), `check:og` (needs a live deploy), real phone.

## Verified / Not verified
Verified: the pure model and the sheet in jsdom (see table). Not verified: any screen using it, browser walk at 390x844, real phone, server round trip (nothing is saved here).
