# Handover FIX-INT4 -- the finishing pass on `claude/org-r1-integrate` (PR #809)

Brief: `docs/organiser-rebuild/briefs/FIX-INT4.md` on `arc/briefs-organiser-r1` (sha 47d172c2). Review it
answers: `docs/organiser-rebuild/reviews/REVIEW-INT4.md` on `claude/org-r1-review-INT4`.
Base: fa609c67. Ticket dt_02ac91d9f3e5. `A1_APPLIED` / `AW1_APPLIED` NOT flipped: everything here is still dark behind the gate.
Stopping rule (per the brief): this is the LAST pass for this delta, no further review round. Every change is red first and mutation-proven below.

## What changed

| Item | File | Change |
|---|---|---|
| S-1 | `shared/selfServeErrors.ts` | session-remove capture `(.{1,200})` -> `(.{0,200})`; a blank (or all-space) title says "One of the sessions has changes on some dates, so only an admin can remove it. Keep it, or ask the Bachata Calendar team to remove it." |
| S-3 | `shared/selfServeErrors.ts` | the INT4 rules (session-remove, stale/id-less ids, organiser consent) moved to the TOP of `COMMAND_COPY`, each anchored on `^permission_denied: ...` / `^invalid_payload: ...` |
| S-2 | `events/programmeSeriesModel.ts` | new `CHANGED_SESSION_REMOVE_CONFIRM` = "If this session was changed on any date, past ones included, only the Bachata Calendar team can remove it."; `removeConfirmCopy` uses it. `CHANGED_SESSION_REMOVE` ("those dates") stays, on the Differs card only (`ProgrammeSeries.tsx` untouched) |
| N-1 | `shared/__tests__/selfServe.test.ts` | chose the TEST (simpler: one row, no code or claim removed): a 120-character title is cut to its first 80. The client clamp stays as a second line behind the server's `left(title, 80)` |
| N-2 | `shared/selfServeErrors.ts` | maps the exact server text `permission_denied: series.set_organisers can only add a live organiser page` (admin `20261126230000` lines 790/1177/2658/2727 on `claude/org-r1-parity-aw1`, read from the migration, not guessed) to "That page isn't live, so it can't be added." No picker change (`organiser_home_v1` has no `is_active`) |

Tests: `selfServe.test.ts` AW1 table +5 rows (blank title, all-space title, two shadowing titles
`Bachata on a past date is admin-only` and `Drill: shift would collide`, live-page refusal) + the 120-char `it`;
`sw1.parity.test.tsx` and `fixSw1.matrix.test.tsx` now pin `CHANGED_SESSION_REMOVE_CONFIRM` in the confirm and assert
it contains no "those"; a new `fixSw1` test pins the exact confirm sentence and that the Differs sentence keeps "those dates".

## Red first (new tests against the unfixed code, fa609c67 source)

```
 FAIL fixSw1.matrix > the remove confirm says what really happens to the dates that changed that session
   AssertionError: expected 'Remove "Beginner class" from every da...' to include undefined
 FAIL fixSw1.matrix > the remove confirm points at no "those dates" and counts past dates too
   AssertionError: expected 'Remove "Beginner class" from every da...' not to match /those/i
 FAIL sw1.parity > the remove confirm says a session changed on a date is removed by the team (final AW1 refuses an owner; INT4)
   AssertionError: expected 'Remove "Beginner class" from every da...' to include undefined
 FAIL selfServe > permission_denied: removing the session "" would delete ...
   AssertionError: expected 'You cannot make that change here. Ask...' to match /^One of the sessions has changes on s.../
 FAIL selfServe > permission_denied: removing the session "   " would delete ...
   AssertionError: expected 'The session "" has changes on some da...' to match /^One of the sessions has changes on s.../
 FAIL selfServe > permission_denied: removing the session "Bachata on a past date is admin-only" would delete ...
   AssertionError: expected 'This date has already happened, so it...' to match /^The session "Bachata on a past date .../
 FAIL selfServe > permission_denied: removing the session "Drill: shift would collide" would delete ...
   AssertionError: expected 'Nothing was moved: one of the ticked ...' to match /^The session "Drill: shift would coll.../
 FAIL selfServe > permission_denied: series.set_organisers can only add a live organiser page
   AssertionError: expected 'You cannot make that change here. Ask...' to match /^That page isn't live, so it can't be.../
 Test Files  3 failed (3)
      Tests  8 failed | 138 passed (146)
```
(Curly quotes shown as straight quotes here.) The N-1 row is green on the unfixed code by design: it pins
existing behaviour, so its proof is mutant MD. After the fix: `Test Files 3 passed (3)  Tests 146 passed (146)`.

## Mutants (one at a time, restored with `git checkout`, tree clean after)

| # | Mutant | Tests | Result |
|---|---|---|---|
| MA | S-1: capture back to `(.{1,200})` | selfServe.test.ts | RED 1 failed / 42 (blank title) |
| MB | S-1: blank-title branch removed (`return title` -> `return true`) | selfServe.test.ts | RED 2 failed / 42 (blank, all-space) |
| MC | S-3: session-remove rule moved back to the bottom, just above the generic `^permission_denied` | selfServe.test.ts | RED 2 failed / 42 (both shadowing rows) |
| MD | N-1: `.slice(0, 80)` removed | selfServe.test.ts | RED 1 failed / 42 (120-char row) |
| ME | N-2: live-page rule deleted | selfServe.test.ts | RED 1 failed / 42 |
| MF | S-2: "those dates" put back in the confirm sentence | sw1.parity + fixSw1.matrix | RED 2 failed / 104 |

(MB first ran green because the harness's `sed` anchored on `$` against a CRLF file and did not apply; re-run with a CRLF-safe pattern, red as above.)

## Accepted, no change (N-3 .. N-6)

- **N-3** (a removed co-organiser page cannot be re-added unless it is the viewer's): accepted. The fix is "leave without saving"; widening `addablePages` to stored pages is a picker change the brief rules out for this pass; no data is lost (nothing is saved until Save).
- **N-4** (`ADD_NONE_LEFT` on an owner with no live pages): accepted. Prod has 0 such users (every owner/manager page is live), and N-2's new copy covers the server side if one appears.
- **N-5** (stale-id copy also covers two client bugs): accepted. Reload rebuilds the tree from the server, which fixes both.
- **N-6** (shell spacer): accepted. Same 44x44 box as the switcher's own Suspense fallback; the only change where the switcher renders nothing is title width, no vertical shift. The shell was not touched in this pass, so the shell e2e spec was not re-run.

## Note for the review pack

The cold-start e2e flake REVIEW-INT4 saw (the FIRST test after a cold dev server is red, `dancer-home.spec.ts`,
on branch AND on main fddd4f4) is not this PR's: it reproduces on main with no organiser change, and this pass does not touch the shell.

## Commands run (sandbox)

See the gate table in the final commit / report: organiser vitest, `npm run lint`, `npm run lint:architecture`,
`npm run check:mojibake`, `npm run build` (production), `npm run check:bundle-budget`.

| Command | Result |
|---|---|
| `npx vitest run src/modules/organiser` | exit 0: 112 files, 3524 passed, 2 skipped (reviewer's 3534 included a 17-test scratch probe; 3517 + 7 new = 3524) |
| `npm run lint` | exit 1: 19/20 links PASS; `check:integrity` exit 126 because `bin/check-integrity.sh` is mode 100644 in git (same on main, same as REVIEW-INT4 saw). Run directly, `bash bin/check-integrity.sh`: exit 0, "ok (1970 files checked, 0 issues)". `lint:eslint` skipped by the chain (informational) |
| `npm run lint:architecture` | exit 0 |
| `npm run check:mojibake` | exit 0 (1600 files, no cp1252 corruption) |
| `npm run build` (production) | exit 0 |
| `npm run check:bundle-budget` | exit 0, "All first-load JS budgets respected" |
| e2e | not run: the shell was not touched (per the brief) |

## Verified
- Exact server texts for the session-remove and live-page refusals read from the admin migrations (`20261126220000:1225`, `20261126230000:790`).
- Red first: 8 new/updated assertions red on the unfixed code for the intended reason; green after.
- 6 of 6 mutants red.
- No raw Unicode punctuation added (curly quotes are `\u201c`/`\u201d` escapes); `check:mojibake` run.

## Not verified
- Browser walk at 390x844 of the remove confirm and the refusal lines: copy-only change, dark behind `AW1_APPLIED`, so prod cannot show it; vitest render tests (`sw1.parity`) cover the confirm text on screen.
- The live-page refusal against a real deactivated page: prod has 0 (the AW1 migrations are not applied on prod; `pg_proc` has no function carrying that text yet).
- GitHub checks on the new head (one push at the end; not waited for).
- Vercel preview (see the report).
