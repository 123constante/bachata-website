# Review 1527 r2 -- PR #1527 at head c1c4307cb2853f7e433199db7f7e1220e4975c2e
Reviewed: head c1c4307cb (branch `claude/welcome-w1b-join-note`, base main 09f0355), delta `260c2df33..c1c4307cb` after review r1 (`docs/review/review-1527-r1.md` on branch `claude/review-1527-r1`, verdict PASS-with-fixes). Independent re-review, read-only on the PR branch. Ticket dt_07e59337bd1a.

## Verdict: PASS-with-fixes

The code is done. The fix round is two commits touching only `OrganiserSheet.tsx` (one added attribute: `aria-describedby` on the textarea) and the new test file; no server, public-card or workflow file changed. F2, F3 and F5 are fixed at the code and each fix is pinned by a test that I made fail by reverting the source. F4 was closed by the alternative r1 offered (the no-op "Enter" step and its claim were removed); the guard inside `request()` is still correct and still untested (mutant M3 survives, see finding 1). The 13 mutants below: 12 killed, 1 survived.

What still blocks "ready" is process, not code (finding 2 and 3): the 390x844 walk with the four screenshots has not been done by anyone, and the PR body carries a one-line CI summary of the PREVIOUS head instead of a per-job table. The body is otherwise filled, honest and passes both body checks (exit 0, zero `TO FILL`). No code change is requested from the builder.

## F1-F5 status (verified at the code, not the commit message)

| # | r1 finding | Status at c1c4307cb | Evidence |
|---|---|---|---|
| F1 | PR body unfilled, no screenshots | **PARTIAL** | Body read through the GitHub API: zero `TO FILL`; `check-pr-real-data-verified.mjs` exit 0; `check-pr-phone-qa.mjs` (PR_FILES = the 5 PR files) exit 0. Verified-on-real-data counts are copied from the handover ("not re-queried this round"); I re-queried them read-only and they match (below). Not-verified lines are honest. MISSING: 390x844 screenshots for empty / 2 chars / 3 chars / server error (no PR comments, no reviews, no images in the body) and a per-job CI table (body has "36 checks, 25 success, 11 skipped, 0 failure" for the previous head only). |
| F2 | 501-char case tested nothing | **FIXED** | Case removed; new test asserts `getAttribute('maxlength') === '500'` (`OrganiserSheet.note.test.tsx:44-47`). Mutant M7 (remove `maxLength={500}`): 1 fail. |
| F3 | `trim` not pinned | **FIXED** | Cases `'   '` (three spaces) and `' a '` added, both expected disabled (`OrganiserSheet.note.test.tsx:30-31`). Mutant M2 (drop `.trim()`): 2 fail. |
| F4 | in-`request` guard never exercised | **ADDRESSED (alternative), guard still untested** | The no-op `fireEvent.submit(note)` and its "Enter must not send" comment are gone, so the test no longer claims something it does not check (r1's second option). The guard `if (noteTooShort) return Promise.resolve();` (`OrganiserSheet.tsx:126`) is unchanged and unreachable from the UI under test because the button is disabled. Mutant M3 (drop guard): 50/50 pass, SURVIVED. See finding 1. |
| F5 | `aria-describedby` only on the button | **FIXED** | `OrganiserSheet.tsx:248`: `aria-describedby={noteTooShort ? \`${ids}-note-required\` : undefined}` on the textarea; test asserts both the field and the button point at the reason line's id while it shows and carry no attribute once the note is long enough (`OrganiserSheet.note.test.tsx:58-61`). Mutant M11 (drop it): 5 fail. Mutant M12 (point it at the wrong id): 5 fail. |

## New findings (delta `260c2df33..c1c4307cb`)

1. **LOW (test gap, carried from F4): the guard inside `request()` is still not exercised.** `OrganiserSheet.tsx:125-128`. Removing the guard line leaves all 50 tests green (M3). The guard is defence in depth behind `disabled={noteTooShort}` (M4 and M10 show the disabled attribute alone is pinned by 8 tests), and React does not deliver a click to a disabled button, so there is no UI path to test it from. Acceptable as is; the source comment ("Guarded here too, so no path ... reaches the server with a short note") describes the code truthfully. If anyone wants it pinned, the cheap way is to lift `noteTooShort` + the early return into a tiny exported helper and unit-test the helper; not required for this PR.
2. **MEDIUM (process, blocks "ready" under CLAUDE.md step 4): no 390x844 browser walk and no screenshots.** Nobody has walked the sheet on a phone-sized viewport: not the builder (two rounds), not r1, not this review. The PR body says so under NOT verified and Phone QA. The builder's stated reason (no preview-deploy script in the checkout, no signed-in session with a claimable organiser) also held in this run: the sheet needs an authenticated onboarding session, and there is no preview credential here. Fix: the owner, or a worker with a preview credential, walks empty / 2 chars / 3 chars / server error at 390x844 and attaches the four screenshots to the PR. This is the only remaining item that needs a person.
3. **LOW (process): PR body has no per-job CI table.** "Checks run" ends with "CI at the previous head: 36 checks, 25 success, 11 skipped, 0 failure (re-run on this push)". That is the r1 summary of 260c2df, not the current head. Fix: paste the per-job table below into the body (all 36 jobs are complete at the final read).
4. **INFO: prod counts re-checked and match.** Read-only on prod project `stsdtacfauprzrdebmzg`, table `entity_decision_audit`, `action = 'access_requested'`: 8 rows; 6 with an empty `reason`; 0 with a trimmed `reason` of 1-2 characters. `after_state` has only `requested_role`, so the note lives in `reason`. Same numbers as the handover and the body. No personal data read, no write.
5. **INFO: no new risk in the source delta.** The only source change is the one attribute (F5). It renders `undefined` (attribute absent) once the note is long enough, and the id it points at is the same literal the reason `<p>` and the button already use. tsc at the head: 0 errors.
6. **INFO: body claims cross-checked.** "new note test 10/10": the file has 10 tests (1 constant, 1 maxlength, 8 table cases), all pass. "removing .trim() now fails 2 tests": matches M2. "removing it [aria-describedby] fails 5 tests": matches M11. "pre-ship exited 0": not re-run here (see Not verified).

## Mutant table

Run against `OrganiserSheet.note.test.tsx` + `ClaimStates.test.tsx` + `dancerFirst.refusal.test.tsx` (50 tests, baseline exit 0). Each mutant was applied to `OrganiserSheet.tsx` at c1c4307cb in a fresh worktree (`npm ci --ignore-scripts`), the diff was printed to confirm it applied (the file is CRLF; a first pass with `$`-anchored patterns silently missed six lines and was discarded), the three files were run, and the file was reverted.

| # | Mutant | r1 (260c2df) | r2 (c1c4307cb) |
|---|---|---|---|
| M1 | min 3 -> 4 (`< REQUEST_NOTE_MIN + 1`) | KILLED | KILLED (2 fail) |
| M1b | min 3 -> 2 (`< REQUEST_NOTE_MIN - 1`) | KILLED | KILLED (1 fail) |
| M2 | drop `.trim()` | survived | **KILLED** (2 fail) -- F3 |
| M3 | drop guard inside `request` | survived | **SURVIVED** (50 pass) -- F4, finding 1 |
| M4 | drop `disabled={noteTooShort}` | KILLED | KILLED (8 fail) |
| M5 | drop reason line (`{false && (`) | KILLED | KILLED (5 fail) |
| M6 | `<` -> `<=` | KILLED | KILLED (2 fail) |
| M7 | remove `maxLength={500}` | survived | **KILLED** (1 fail) -- F2 |
| M8 | restore "(optional)" in the label | KILLED | KILLED (8 fail) |
| M9 | drop `aria-describedby` on the button | survived | **KILLED** (5 fail) -- F5 |
| M10 | drop guard AND disabled | KILLED | KILLED (8 fail) |
| M11 | drop `aria-describedby` on the textarea (new) | n/a | KILLED (5 fail) -- F5 |
| M12 | textarea `aria-describedby` -> wrong id `${ids}-note` (new) | n/a | KILLED (5 fail) -- F5 |

Result: 12 killed, 1 survived out of 13 (r1: 7 of 11 killed).

## Tests run (PR head c1c4307cb, own worktrees, fresh `npm ci --ignore-scripts`)

- New test + the two edited tests: exit 0, 50/50 passed (3 files).
- `npm run test:unit`: exit 1, 15 failed / 29431 passed / 31 skipped (4 files failed of 909). The failing files are the same four as in r1: `tests/eventViewCompat.contract.test.ts`, `tests/occurrenceProgram.contract.test.ts`, `tests/publicEventPageLineup.contract.test.ts` (live-DB contract tests, no DB credentials in the sandbox) and `tests/integrityCouldNotRun.test.ts` (worktree fixture). Same 15 failures as r1 at 260c2df; passed count is up by exactly 2, which is the two new table cases. Environmental, not caused by the PR; CI `unit (Europe/London, full)` is green on this head.
- `npx tsc --noEmit -p .` at c1c4307cb: exit 0, 0 errors.
- PR body checks with the live body: `check-pr-real-data-verified.mjs` exit 0; `check-pr-phone-qa.mjs` exit 0 (PR_FILES = 4 UI paths + 1 doc).

## CI table (head c1c4307cb)

36 check runs. First read (about 18:19 UTC, two minutes after the push): 6 in progress -- `unit (Europe/London, full)`, `e2e-smoke`, `build-smoke`, `phone-qa (1)`, `phone-qa (2)`, `phone-qa (3)`. Re-read at about 18:27 and 18:35 UTC: only `e2e-smoke` still in progress. Final read at 18:36 UTC: all 36 completed (25 success, 11 skipped, 0 failure); `e2e-smoke` completed success at 18:36:12 UTC.

| Job | Result (final read) |
|---|---|
| integrity | success |
| unit (Europe/London, full) | success |
| unit (Australia/Sydney, tz-sensitive) | success |
| unit (America/New_York, tz-sensitive) | success |
| e2e-smoke | success (completed 18:36:12 UTC, the last job to finish) |
| build-smoke | success |
| phone-qa (1) / (2) / (3) | success |
| phone-qa-section | success (body filled; exit 0 locally) |
| real-data-verified | success (body filled; exit 0 locally) |
| contract-check, live-db-gate | success |
| bundle-budget | success |
| bom-check, bom-check-routed, route, decide | success |
| dancer-area-isolation, masking-check, notification-check, wallclock-brand | success |
| no-preview-reason (x4), open-pr | success |
| lighthouse, doc-weight, enable, og-check, og-preview, synthetic, synthetic-preview, seo-check, seo-preview | skipped |

## Verified
- The delta diff `260c2df33..c1c4307cb` was read line by line: 2 files, +12/-3, one source line.
- Each of F2, F3, F5 was proven at the code by reverting the fix and watching the named test fail (M7, M2, M11/M12).
- F4 was proven still unpinned by removing the guard and watching all 50 tests pass (M3).
- The PR body was read through the GitHub API and run through both body scripts.
- Prod counts re-queried read-only (finding 4).
- CI check runs read twice through the GitHub API (first read about 18:19 UTC with 6 jobs in progress; final read 18:36 UTC with all 36 completed, table above).
- No PR comments or reviews exist (so no screenshots anywhere on the PR).

## Not verified
- Browser walk at 390x844 and the visual layout of the reason line / disabled button / server-error state (finding 2). Needs an authenticated onboarding session with a claimable organiser and a preview deploy; neither is available in this run.
- `npm run pre-ship` was not re-run here; the body says it exited 0 for the builder.
- Server behaviour (`request_organiser_access_v1` accepting an empty note, parked W2): not re-checked, out of scope for this PR.
