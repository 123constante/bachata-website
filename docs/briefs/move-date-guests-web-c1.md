# BRIEF: move-date-guests-web-c1 (WEBSITE, BUILD-visual continuation, normal lane; Sonnet, medium effort). Continue claude/move-date-guests-web: prove the refusal-to-confirm path against the REAL error shape, make the confirm copy true now that guests are emailed, verify the taps.

Brief-version: 2
Branch: `claude/move-date-guests-web` (continue it: `git fetch origin claude/move-date-guests-web`, check out that branch, do NOT start from main; head d9e5158689a75b950fda8b12448fb4d4c1a0eb68). Parent brief: `docs/briefs/move-date-guests.md` on the admin-side brief branch; handover of the first worker: `docs/handovers/move-date-guests-web.md` on the branch.

Context line: stay under 50% of your context; early checkpoint push, push + handover by 50%. Never approve/merge/--no-verify. Plain git only, never `gh api`. Supabase READ-ONLY. No migration (admin PR #1223, branch `claude/move-date-guests` at cf312c84, holds the DB half; it is NOT applied yet, so every server reply here is stubbed). Never end a turn on a background task. Source files over 2 KB go through scripts/safe-edit.py / safe-write.py (read the hook message). Flag `organiserP3` is OFF on prod: keep everything behind it.

## What main lacks
Proofs read 2026-11-04 on the branch head and admin cf312c84.
- The confirm step ("Move it anyway" / "Choose another day") is not verified against the real refusal. Independent walk (website-18, mocked RPCs, 390x844): a stubbed refusal with message `date_has_people: 3 on the guest list, 4 going, 2 with tickets` and a details JSON showed the generic red "Something went wrong. Please try again." in the move sheet, not the confirm step. Verdict from reading the code: probably a mock artefact, NOT proven. Evidence: the real server raises `RAISE EXCEPTION 'date_has_people: % guest-list, % going, % tickets on %; send acknowledge_people true to move it anyway' ... USING ERRCODE='P0001', DETAIL = <counts jsonb as text>, HINT='date_has_people'` (admin `supabase/migrations/20270309210000_p3_move_guard_db_v1.sql:119-121`); the dispatcher audit wrapper re-raises unchanged (`RAISE;`, migrations_archive/20260902010000...:350-351); `runOccurrenceCommand` throws the PostgREST error as is (`src/modules/organiser/shared/selfServeApi.ts:287-291`, `if (error) throw error`); a single-command move is not wrapped in `PlanStepError` (`data/dates.ts:300-307`, only i > 0); and `go()`'s `intercept` reads `(e as {message}).message` against `DATE_HAS_PEOPLE = /^date_has_people:/` (`screens/DateSheet.tsx:171-182`, `model/labels.ts:343`). A real `supabase-js` error carries `message`, `details` (the counts as a JSON STRING), `hint`, `code`. Note the real message says `guest-list` (hyphen), not `guest_list`. -- extends: src/modules/organiser/p3/screens/DateSheet.tsx
- Nothing proves the path through the real client error object. `dateMove.warn.test.tsx` stubs the sender with its own error shapes. -- extends: src/modules/organiser/p3/screens/__tests__ (new test)
- The confirm copy says the people "are not told automatically". Once admin #1223 is applied that is false: it queues one email per distinct paid ticket order and per distinct "going" user; guest-list entries store no contact and cannot be emailed. The move reply gains `notices: {queued, guest_list_unreached}` (`99990101000000_move_date_notices_v1.sql` header). `moveNoticesOf` and `moveOutcomeCopy` exist; the confirm line does not match them. -- extends: src/modules/organiser/p3/model/labels.ts, DATE_COPY
- Never verified: "Move it anyway" and "Choose another day" taps and 44px size, the repeat refusal (second refusal with NEW counts), every 320x568 case. -- extends: src/modules/organiser/p3/screens/__tests__

## Files
- `src/modules/organiser/p3/screens/DateSheet.tsx` (only if the new test finds a real defect; otherwise leave it byte for byte)
- `src/modules/organiser/p3/model/labels.ts` (confirm copy; `peopleCountsOf` must also parse a `guest-list` hyphen message)
- `src/modules/organiser/p3/data/dates.ts` ONLY if a real defect is found there
- tests: NEW `src/modules/organiser/p3/screens/__tests__/dateMove.realShape.test.tsx`, edit `dateMove.warn.test.tsx` and `src/modules/organiser/shared/__tests__/moveDate.payload.test.ts` as needed
- `docs/handovers/move-date-guests-web-c1.md`

Do NOT touch `EditTray.tsx`, the rights/gating files (`manager-full-edit` owns them), the Details/Prices screens (`p3-scope-ask-web` owns them), or anything under `supabase/`.

## What to build (tests first, red; say so)
1. Table-driven test through the real path: a stub of `supabase.rpc` returning `{ data: null, error: <object shaped exactly like a supabase-js PostgrestError> }` with `message`, `details` (JSON string), `hint: 'date_has_people'`, `code: 'P0001'`. Rows: (a) real message with `guest-list` hyphen and details JSON string; (b) details missing, counts only in the message; (c) details unparseable; (d) details object not string; (e) a different P0001 refusal (`version_conflict:`) must still show the generic error, not the confirm; (f) a second `date_has_people` after the confirm shows the confirm again with the NEW counts and sends nothing more. Drive the real `DateSheet` (not a mocked `go`). If every row is green on the unfixed code, say so: the original red line was a mock artefact, and the rows stay as regression proof. If any row is red, fix the cause in the smallest place.
2. Confirm copy (one shared mapping, no second copy): when the move would tell people, say who is emailed (ticket buyers and people who marked "going") and that guest-list entries cannot be emailed, with their number from the counts, e.g. "{n} on the guest list cannot be emailed. You may want to tell them yourself." No copy that points at a control that is not on screen. After a confirmed move, the done toast comes from `moveOutcomeCopy(moveNoticesOf(reply))`: rows for `notices` present, `queued` 0, `guest_list_unreached` > 0, and `notices` absent (server not yet applied: say nothing false, e.g. "Moved to {day}.").
3. Taps: "Move it anyway" sends the move WITH `acknowledge_people: true` and a NEW idempotency key; "Choose another day" returns to the day picker and sends nothing; each button is at least 44px tall (assert the class or inline size the other P3 sheet buttons use); no sideways scroll at 320 wide (assert no fixed widths over 320).
4. Everything stays behind `organiserP3`; flag off changes nothing.

## Tests (red against the branch head where a defect exists; table-driven; say counts red then green)
New `dateMove.realShape.test.tsx` as above. Existing `p3` and `organiser/shared` suites stay green.

## Run before you push (read `.github/workflows`; say the result of each)
`npx tsc --noEmit`, the `src/modules/organiser` vitest folders, `npm run lint`, `npm run check:mojibake`, and every other CI job step that applies. Keep PR body lines `## Verified on real data` and `## Phone QA` filled exactly as the dispatch prompt says (both check scripts exit 0).

## Hard limits specific to this brief
- No change outside the Files. No admin change, no migration, no new RPC, no new dependency.
- Do not merge or mark ready: this PR must NOT merge before admin #1223 is applied. Say so at the top of the PR body.
- Never log the counts or any person detail; no names or emails in tests or copy.
- One push at the end (early checkpoint pushes carry [skip preview]); final push without it.

## Done when
New rows red-then-green (or green with the artefact verdict stated), organiser tests, tsc, lint and guards green, one push, handover with Verified / Not verified. Not verified (say it): the real server reply (admin #1223 not applied), the actual email send, a real phone, 320x568 walk if you did not run one.
