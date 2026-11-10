# Review 1527 r1 -- PR #1527 at head c1c4307cb2853f7e433199db7f7e1220e4975c2e
Reviewed: head c1c4307cb (branch `claude/welcome-w1b-join-note`, base main 09f0355), independent review, read-only on the PR branch.
The PR head moved during this review: the brief named 260c2df33; the builder pushed 26dd483 + c1c4307 at 18:17Z (round-1 fixes F2-F5 and the PR body). Everything below was re-run at c1c4307 unless it says otherwise; the 260c2df33 results are kept where they show what changed.
Ticket dt_e12cd704c75a (re-dispatch of r1; replaces the write-up at dd82546, ticket dt_8cf56a2ba38e, which reviewed 260c2df33). Fresh clone, fresh `npm ci`, own test and mutant runs.
PR title: feat(onboarding): Ask-to-join note required, min 3 chars (W1b). Builder: Sonnet. Build brief: `docs/briefs/welcome-w1b-join-note.md` (brief branch cd83365).

## Verdict: PASS-with-fixes

The code is correct, small and in scope: the onboarding Ask-to-join sheet imports `REQUEST_NOTE_MIN` from the public claim card (not a copied 3), disables send while `note.trim().length < REQUEST_NOTE_MIN`, shows the reason line in the public card's exact words, points both the textarea and the button at that line with `aria-describedby`, keeps `maxLength={500}`, drops "(optional)" from the label, and guards inside `request()` as well. No server code and no public-card file changed (5 files: the sheet, a new test, two edited tests, a handover note). The new test is red on main's sheet (8 failed, 2 passed) and green at the head (50/50 with the two edited files). 15 mutants: 14 killed, 1 survived (the defence-in-depth guard, which the UI cannot reach). `tsc --noEmit`: 0 errors. The PR body is filled and both body-check scripts exit 0.

The one remaining fix is outside the code: the build brief's step 6 (walk the sheet at 390x844 and put screenshots on the PR: empty, 2 chars, 3 chars, server error) has not been done by anyone, and the body says so honestly. By this repo's definition of done (CLAUDE.md, "Browser walk at 390x844 with prod-shaped data") that is the owner's call to waive or to have done before merge. Nothing else blocks.

## Findings

1. **MEDIUM (process; owner's call). No 390x844 walk and no screenshots on the PR.** The build brief step 6 asked for `preview-deploy.mjs` screenshots (empty / 2 chars / 3 chars / server error). `scripts/preview-deploy.mjs` does not exist on the PR head (`ls` fails), the PR has 0 comments and no image, and the body's Phone QA block says "390x844 NOT checked" and "nothing in a browser". I could not do it either: the sheet needs a signed-in session with a claimable organiser and there is no preview credential in this run. The jsdom tests cover behaviour, not layout (see F5). Fix: owner or a worker with a preview credential walks it once, or the owner waives it for a one-line copy and disabled-state change.
2. **LOW (test gap, acknowledged in the PR body). The guard inside `request` is still untested.** `OrganiserSheet.tsx:126` `if (noteTooShort) return Promise.resolve();`. Mutant M3 (guard removed) survives the 50 tests; M10 (guard and `disabled` removed together) is killed, so the behaviour users see is pinned. The builder removed the misleading "Enter must not send" step (it was `fireEvent.submit` on a textarea in no form, a no-op) and now calls the guard defence in depth. Agreed: there is no `<form>`, `onSubmit` or `onKeyDown` in the sheet, Enter in a textarea inserts a newline, double tap is stopped by `disabled` and then by `loading` (`PrimaryButton` sets `disabled={disabled || loading}`). Keep the guard; a direct unit test of `request` would be nice-to-have, not required.
3. **INFO. Label wording differs from the public card.** Sheet: "Who are you?"; public card (`PublicClaimCard.tsx:328`): "Who are you? (required)". The build brief asked only to drop "(optional)", so this is in scope as built. The reason line carries the rule. Noted for the J3.1 one-rule audit.
4. **INFO. The raw note is sent, padding included.** `requestOrganiserAccess(org.id, note)` sends the untrimmed value and the test pins it (mutant M12, sending `note.trim()`, is killed by the `'  abc  '` case). The public card does the same (`PublicClaimCard.tsx:246` trims only for the check), so both paths agree. Noted so nobody "fixes" one side alone.
5. **INFO (not seen in a browser). Layout.** The reason paragraph is the last child of the content `space-y-[12px]` block; the send button lives in the sheet footer. When the third character is typed the paragraph unmounts, so the content shrinks by about one 14px line plus the 12px gap. Whether that moves the footer depends on whether the sheet is content-sized at 390x844. Covered by F1.
6. **INFO. The PR body's test count is from a wider run than mine.** Body: "src/modules/organiser 314 files 13078 tests pass; pre-ship exited 0". I ran the three touched test files (50/50) and the full `test:unit` at 260c2df33 only (see Tests run); I did not re-run `pre-ship`. Not contradicted by anything I saw.

Fixed since 260c2df33 (round-1 findings, verified at c1c4307): F2 the 501-char case replaced by an assertion on the `maxlength` attribute (M7 and M7b now killed); F3 trim pinned by `'   '` and `' a '` (M2 killed); F4 the no-op Enter step removed; F5 `aria-describedby` added on the textarea and asserted on both elements (M9a, M9b killed); the PR body filled (both body checks exit 0).

## Requirement table (build brief, item by item)

| Brief item | Status | Evidence |
|---|---|---|
| Label no longer says "(optional)" | OK | diff; M8 killed (8 fail) |
| `REQUEST_NOTE_MIN` imported, not copied | OK | `import { REQUEST_NOTE_MIN } from '../../shared/components/PublicClaimCard'`; test pins value 3; M1a/M1b killed |
| Send disabled while trimmed note is short | OK | M4 killed (8 fail); M2 (drop trim) killed (2 fail) |
| Reason line in the public card's words | OK | sentence identical to `PublicClaimCard.tsx:350`; M5 and M11 killed |
| 500-char limit kept | OK | `maxLength={500}` on the textarea; test asserts the attribute; M7, M7b killed |
| Guard inside `request` (Enter, double tap, programmatic) | OK in code; untested (F2) | guard present; no form/keydown path; double tap stopped by `disabled` then `loading`; M3 survives, M10 killed |
| Untouched sheet sends nothing | OK | `empty` case: button disabled, reason shown, 0 RPC calls |
| No change to public card or server | OK | `git diff --stat origin/main...c1c4307`: 5 files, none under `shared/components/`, `supabase/` or `app/` |
| Edited existing tests changed only for the old optional rule | OK | `dancerFirst.refusal.test.tsx` +3: types `I run it` when the note field exists (sheet parametrised over claim/request/create). `ClaimStates.test.tsx` 6c: asserted `toHaveBeenCalledWith('o1', '')`; now asserts disabled first, types a note, expects it sent. Nothing else loosened |
| Reason line tied to the field (`aria-describedby` or equivalent) | OK | on the textarea and on the button while short, `undefined` once ok; asserted; M9a/M9b killed |
| Disabled button says why without colour | OK | visible text line under the field; `opacity-60` is extra |
| Tap targets >= 44px | OK | `PrimaryButton` default size `md` = `h-[52px]` (`src/modules/organiser/ui/Buttons.tsx`); textarea `min-h-[88px]` |
| No layout jump at 390x844 | NOT CHECKED | code reading only (F5, F1) |
| Screenshots on the PR / 390x844 walk | MISSING | F1 |
| PR body filled, Verified / Not verified | OK | no `TO FILL`; `check-pr-real-data-verified.mjs` exit 0; `check-pr-phone-qa.mjs` exit 0 (4 UI paths) |
| `npm run pre-ship` | claimed by builder (exit 0) | not re-run by me |

## Mutant table

Each mutant applied to `OrganiserSheet.tsx` in a worktree at c1c4307, then `vitest run` on `OrganiserSheet.note.test.tsx` + `ClaimStates.test.tsx` + `dancerFirst.refusal.test.tsx` (50 tests), then reverted (git status clean after each). The 260c2df33 column is the same mutant against the previous head (48 tests).

| # | Mutant | at c1c4307 | at 260c2df33 |
|---|---|---|---|
| M1a | min 3 -> 4 (`REQUEST_NOTE_MIN + 1`) | KILLED (2 fail) | KILLED (2) |
| M1b | min 3 -> 2 (`REQUEST_NOTE_MIN - 1`) | KILLED (1 fail) | KILLED (1) |
| M2 | drop `.trim()` | KILLED (2 fail) | survived |
| M3 | drop the guard inside `request` | **SURVIVED** (F2) | survived |
| M4 | drop `disabled={noteTooShort}` | KILLED (8 fail) | KILLED (6) |
| M5 | drop the reason line | KILLED (5 fail) | KILLED (3) |
| M6 | `<` -> `<=` | KILLED (2 fail) | KILLED (2) |
| M7 | remove `maxLength={500}` | KILLED (1 fail) | survived |
| M7b | `maxLength` 500 -> 400 | KILLED (1 fail) | not run |
| M8 | restore "(optional)" | KILLED (8 fail) | KILLED (7) |
| M9a | drop `aria-describedby` on the button | KILLED (5 fail) | survived |
| M9b | drop `aria-describedby` on the textarea | KILLED (5 fail) | n/a (not present) |
| M10 | drop guard AND disabled together | KILLED (8 fail) | KILLED (6) |
| M11 | change the reason sentence | KILLED (5 fail) | KILLED (3) |
| M12 | send `note.trim()` instead of `note` | KILLED (1 fail) | KILLED (1) |

c1c4307: 15 mutants, 14 killed, 1 survived. (260c2df33: 13 mutants, 9 killed, 4 survived.)

## Tests run (worktree, fresh `npm ci --ignore-scripts`, 751 packages)

At c1c4307:
- New test + the two edited tests: exit 0, 50/50 passed (3 files; the new file has 10 tests).
- Red first: new test against main's `OrganiserSheet.tsx`: exit 1, 8 failed / 2 passed (the passes are the constant check and the `maxlength` attribute, which main also has).
- `npx tsc --noEmit -p .`: exit 0, 0 errors.
- `npm run check:mojibake`: 2662 files, clean.
- PR body checks with the live body saved to a file: `check-pr-real-data-verified.mjs` exit 0; `check-pr-phone-qa.mjs` (`PR_FILES` = the PR's changed files) exit 0.

At 260c2df33 (before the head moved):
- New test + edited tests: 48/48. Red first: 7 failed / 1 passed. tsc 0 errors. mojibake clean.
- `npm run test:unit` (full, 8m53s): 15 failed / 29429 passed / 31 skipped; 4 files failed of 909: `tests/eventViewCompat.contract.test.ts`, `tests/occurrenceProgram.contract.test.ts`, `tests/publicEventPageLineup.contract.test.ts` (live-DB contract tests, no DB credentials in the sandbox) and `tests/integrityCouldNotRun.test.ts` (linked-worktree fixture; I ran inside a `git worktree`). None imports the PR's files. Not re-run at c1c4307: the two new commits touch only the sheet's `aria-describedby` and the new test file; CI `unit (Europe/London, full)` covers it (see CI table).
- Both body checks with the then-live template body: exit 3 each (fixed at c1c4307).

## CI table (head c1c4307)

The head's workflows started 18:17Z. Read at 18:22Z: 36 check runs; 30 completed (19 success, 11 skipped, 0 failure); 6 in progress: `unit (Europe/London, full)`, `e2e-smoke`, `phone-qa (1)`, `phone-qa (2)`, `phone-qa (3)`, `build-smoke`. Final read: the line under the table.

| Job | Result at 18:22Z | Final read |
|---|---|---|
| integrity | success | success |
| unit (Europe/London, full) | in progress | success (18:25Z) |
| unit (Australia/Sydney, tz-sensitive) | success | success |
| unit (America/New_York, tz-sensitive) | success | success |
| e2e-smoke | in progress | success (18:36Z) |
| build-smoke | in progress | success (18:23Z) |
| phone-qa (1), (2), (3) | in progress | success (18:24-18:25Z) |
| phone-qa-section | success | success (18:24-18:25Z)_section |
| real-data-verified | success | success |
| contract-check, live-db-gate | success | success |
| bundle-budget | success | success |
| bom-check, bom-check-routed, route, decide | success | success |
| dancer-area-isolation, masking-check, notification-check, wallclock-brand | success | success |
| no-preview-reason (x4), open-pr | success | success |
| lighthouse, doc-weight, enable, og-check, og-preview, synthetic, synthetic-preview, seo-check, seo-preview | skipped | skipped |

Final read at 18:37Z (after the last job finished at 18:36:12Z): 36 check runs, all `completed`, none pending; 25 success, 11 skipped, 0 failure. PR head still c1c4307, `mergeable_state: clean`, 0 comments, 0 reviews.

At 260c2df33 the same 36 jobs had all completed: 25 success, 11 skipped, 0 failure. PR state at 18:19Z: open, not draft, `mergeable_state: blocked` (checks running), 3 commits, 5 files, +105/-5, 0 comments, 0 reviews.

## Verified
- Diff read line by line against `docs/briefs/welcome-w1b-join-note.md`, at 260c2df33 and again for the two new commits.
- Red-first, the 50-test run, tsc, mojibake and the 15 mutants were run by me at c1c4307 in a fresh clone; the full unit suite at 260c2df33.
- CI state read through GitHub three times; the final read is recorded above.
- PR body run through both body-check scripts (exit 0 each); PR comments listed (none).
- `PrimaryButton` source read: passes `disabled` and `aria-*` through (`...rest`), `disabled || loading`, height 52px.
- The reason sentence and `REQUEST_NOTE_MIN` compared with `PublicClaimCard.tsx` lines 50, 246, 350.

## Not verified
- Browser walk at 390x844, the visual layout and the server-error state (F1, F5). No preview credential and no claimable-organiser session in this run; no screenshots on the PR.
- Prod data shapes: no new survey; the handover's read-only count (8 requests, 6 with an empty note, 0 with 1-2 chars) was not re-queried.
- `npm run pre-ship`: not run by me (the body says the builder ran it, exit 0).
- The full `test:unit` was not re-run at c1c4307 (run at 260c2df33; CI covers the head).
- Server behaviour: that `request_organiser_access_v1` accepts an empty note (parked W2) is taken from the handover, not re-read.
