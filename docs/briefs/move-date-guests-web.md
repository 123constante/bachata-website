# move-date-guests-web (Website, BUILD-visual, normal lane, small; Sonnet, medium). The warning step when an organiser moves a date that has people on it.

Brief-version: 2
Branch: `claude/move-date-guests-web`. Serves: PRIORITY-QUEUE "Q10 moving a date with guests: warn, move, tell the guests" (owner 2026-11-04), the Website half. The admin half (`move-date-guests`, careful lane) tells the people by email and is independent: this slice works before AND after it (see "Reply tolerance").

Context line: stay under 50% of your context; early checkpoint push, push + handover by 50%. Never approve/merge/--no-verify. Plain git only. Supabase READ-ONLY (you will not need it). No migration. Never ends a turn on a background task. Source files over 2 KB go through scripts/safe-edit.py / safe-write.py (read the hook message). Hard limits are at the end.

Read first: admin `docs/design/move-guard-api.md` and `docs/handover/p3-move-guard-db.md` (path: `C:/dev/bachata-admin-11april`, origin/main), `src/modules/organiser/p3/screens/DateSheet.tsx` (the `move` step, lines ~228-245), `src/modules/organiser/p3/data/dates.ts` (`PLAN.move`, line ~188), `src/modules/organiser/shared/seriesCommands.ts` (`moveDateCommand`, line 276; the occurrence-envelope variant at 286), `src/modules/organiser/shared/selfServeErrors.ts`.

## What main lacks (proofs, Website origin/main 2b8831448; admin guard applied on prod, read 2026-11-04)
- The database ALREADY refuses a move of a date with people (`date_has_people:` P0001, `details` = counts JSON `{guest_list, going, tickets, total}`) unless the payload has `acknowledge_people: true` (prod `_cmd_occurrence_move_date_p5` carries the `P3 move guard`). The Website never sends the flag and never matches the code: `git grep -n "date_has_people\|acknowledge_people" src` finds NOTHING. So today an organiser moving a date with people gets whatever the generic refusal path shows, and can never complete the move. -- extends: src/modules/organiser/shared/seriesCommands.ts (`moveDateCommand` builds `{ to_date }` only), src/modules/organiser/shared/selfServeErrors.ts (no `date_has_people` row)
- The sheet's move step sends at once on tap (`data-testid="p3-move-go"` -> `go(PLAN.move(d, text), ...)`), with no warning step. -- extends: src/modules/organiser/p3/screens/DateSheet.tsx
- `PLAN.move(d, to)` is `onDate(d, moveDateCommand(to))`: one command, one idempotency key from `newIdempotencyKey`; a confirmed resend needs a NEW key and the flag. -- extends: src/modules/organiser/p3/data/dates.ts
- Copy lives in `p3/model/labels.ts` (`L`, `DATE_COPY`); every refusal needs plain copy there (the existing pattern: `date_time_session_has_people` has a `COMMAND_COPY` row). -- extends: src/modules/organiser/p3/model/labels.ts

## Files
- `src/modules/organiser/shared/seriesCommands.ts` (`moveDateCommand(toDate, acknowledgePeople?)`; payload gets `acknowledge_people: true` only when asked; the default payload stays byte-identical to today's)
- `src/modules/organiser/p3/data/dates.ts` (`PLAN.move(d, to, acknowledge?)`; parse the refusal counts)
- `src/modules/organiser/p3/screens/DateSheet.tsx` (a confirm step inside the `move` step)
- `src/modules/organiser/p3/model/labels.ts` (the new strings)
- `src/modules/organiser/shared/selfServeErrors.ts` (one row for `^date_has_people:` so no other screen shows raw text)
- tests: `src/modules/organiser/p3/data/__tests__/dates.data.test.ts` (extend), a new `src/modules/organiser/p3/screens/__tests__/dateMove.warn.test.tsx`, `src/modules/organiser/shared/__tests__` (the command payload, extend or add), `src/modules/organiser/p3/model/__tests__/dates.matrix.test.ts` only if a row changes
- `docs/handovers/move-date-guests-web.md`

Do NOT touch `p3/screens/DetailsScreen.tsx`, `PricesScreen.tsx`, `p3/model/repeat.ts` (the all-dates rule brief owns those), `p3/model/roles.ts` or any rights gating (the manager-rights brief owns those). If you must edit a file outside this list, stop and say so in the handover instead.

## What to build (tests first, red on main; say so)
1. `moveDateCommand(toDate, acknowledgePeople = false)`: payload `{ to_date }` when false (unchanged, pinned by a test), `{ to_date, acknowledge_people: true }` when true.
2. The move step: first tap sends WITHOUT the flag, as today. Reply handling:
   - success -> as today.
   - refusal whose message starts `date_has_people:` -> read the counts from the error `details` (`JSON.parse`, tolerant: a missing or bad `details` falls back to the three numbers parsed from the message, and to "people" with no numbers if neither parses) and show the confirm step IN THE SAME SHEET: title `{total} people are on this date`, body listing only the non-zero parts (`{guest_list} on the guest list`, `{going} going`, `{tickets} with tickets`), then the honest line (see "Reply tolerance"), two buttons `Move it anyway` (filled) and `Choose another day` (outlined, returns to the day field with the typed day kept). Both `min-h-[44px]` explicit px. No auto-confirm, no timer.
   - `Move it anyway` resends the same move with `acknowledge_people: true` and a NEW idempotency key. A second `date_has_people` after the confirm (a person arrived meanwhile) shows the confirm again with the new counts, never loops silently.
   - the other refusals (`date_taken`, cancelled, festival) keep their existing copy and never reach the confirm step.
3. Reply tolerance (the admin "tell" brief adds `notices: {queued, guest_list_unreached}` to the command reply; it may or may not be applied when this ships):
   - Reply HAS `notices` -> after the move say: `Moved. We emailed {queued} people about the new date.` plus, when `guest_list_unreached` > 0: `{n} guest-list people have no contact details, so please tell them yourself.`
   - Reply has NO `notices` (today) -> confirm line `They are not told automatically. Tell them yourself.` and after the move `Moved. Tell the people on it yourself: they are not told automatically.`
   One mapping function in the model (`moveOutcomeCopy(notices | undefined)`), used by both lines; no second copy of the words in the screen.
4. `selfServeErrors.ts`: a row for `^date_has_people:` with plain copy `Some people are on this date. Open the date and confirm the move to go ahead.` (a safety net for any other caller; the sheet handles it before it gets there).

## Tests red first
Table, move step: reply (ok, `date_has_people` with details, `date_has_people` with only the message, `date_has_people` with garbled details, `date_taken`, cancelled, festival, network error) x action (first tap, confirm, choose another day) -> shown step, command payload sent (flag absent / present), idempotency key (new on the confirm). Table, copy: counts (guest list only, going only, tickets only, all three, `total` 1 singular "1 person is on this date") x reply (with / without `notices`) -> exact strings. Payload test: default `moveDateCommand('2026-11-20')` equals `{ kind, payload: { to_date } }` byte for byte. The confirm step has no `data-testid` that duplicates an existing one.

## Run before you push (read `.github/workflows`; say the result of each)
`npx vitest run src/modules/organiser`, `npx tsc --noEmit`, `npm run lint`, and the CI guards that look at organiser copy or error tables (find them: `scripts/check-*` for self-serve errors and the labels table). Per-job table in the handover.

## Phone QA (the orchestrator walks it)
390x844 and 320x568: the move step with no people (as today), with people (confirm step, each count shape), `Choose another day`, `Move it anyway`, a taken day, a cancelled date. Tap targets 44px; no sideways scroll; the confirm step reachable with the keyboard open. Flag `organiserP3` is OFF on prod: say so; the walk runs on a preview with the flag on.

## Hard limits specific to this brief
No change outside the Files. No new dependency. No migration, no admin change. Nothing is sent without the organiser's second tap. Never hide or reword a refusal other than `date_has_people`. British English, full weekday names, `&rsquo;`/`&mdash;` entities in JSX.

## Done when
New cells red-then-green, tests, tsc and lint green, one push, handover with Verified / Not verified (Not verified: a real move of a date with people on prod; the admin `notices` reply, until the admin brief is applied; a real phone). Then: orchestrator walk, pack, owner Approve/merge per the normal lane.
