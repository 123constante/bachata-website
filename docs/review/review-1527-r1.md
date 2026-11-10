# Review 1527 r1 -- PR #1527 at head 260c2df33ac16a7f11757b5da77717d190e958a0
Reviewed: head 260c2df33 (branch `claude/welcome-w1b-join-note`, base main 09f0355). Independent review, read-only on the PR branch. Ticket dt_8cf56a2ba38e.

## Verdict: PASS-with-fixes

The code change is correct and small: the onboarding Ask-to-join sheet now uses the public card's `REQUEST_NOTE_MIN` (imported, not copied), disables send while `note.trim()` is short, shows the reason line in the public card's exact words, keeps `maxLength={500}`, and guards inside `request()`. No server code, no public-card change. All 36 CI checks at the head are completed with no failure.

It is not merge-ready as it stands: the PR body is still the bot template (every label `TO FILL`), and the screenshots and 390x844 walk the build brief asked for are missing (finding 1). Four test gaps (findings 2-5) let mutants survive. None of them is a defect users would see today.

## Findings

1. **HIGH (process, blocks merge): PR body unfilled, no screenshots.** The PR #1527 body has all six labels as `TO FILL`. Reproduced: with that body, `scripts/check-pr-real-data-verified.mjs` exits 3 and `scripts/check-pr-phone-qa.mjs` exits 3. Note that the CI jobs `real-data-verified` and `phone-qa-section` show **success** anyway (they treat exit 3 as "not filled yet", not as a failure), so a green CI page does not mean the body is done. The builder's handover (`docs/briefs/welcome-w1b-join-note-handover.md`) has the content (prod count: 8 access requests, 6 with an empty note, 0 with 1-2 chars; RPC accepts an empty note, parked as W2) but it was never put in the body. Also missing: `npm run pre-ship`, the 390x844 walk with screenshots (empty / 2 / 3 chars / server error), and the per-job CI table. The builder lists all of these under Not verified.
2. **MEDIUM (test gap): the "501 characters (cut to 500 by the field)" case does not test what its name says.** `OrganiserSheet.note.test.tsx:34`. jsdom does not apply `maxLength` to `fireEvent.change`, so the case sends a **501**-char note. I confirmed this by logging `sent.length` (output: 3, 7, 500, 501). Mutant M7 (removing `maxLength={500}`) survives. Fix: assert `note.getAttribute('maxlength') === '500'` and rename the case, or drop it.
3. **MEDIUM (test gap): `trim` is not pinned.** No case has 3+ characters made only of whitespace, or 1-2 real characters padded to 3+. Mutant M2 (`note.length` instead of `note.trim().length`) survives. Fix: add the cases `'   '` (3 spaces) and `' a '`, both expected disabled.
4. **LOW (test gap): the in-`request` guard is never exercised.** The test's "Enter" step is `fireEvent.submit(note)`, but the textarea is in no `<form>` and has no key handler (`OrganiserSheet.tsx`, no `<form`, `onSubmit` or `onKeyDown`), so it is a no-op. The button is disabled, so the guard is unreachable from the UI under test. Mutant M3 (guard removed) survives. The guard itself is correct and cheap. Either test it directly (remove `disabled` in a test-only way, or check through a test of the button's `onClick`) or remove the "Enter must not send" comment, which claims something the test does not check.
5. **LOW (a11y): the reason line is described-by on the button, not on the field.** `aria-describedby` is set on `PrimaryButton` only (`OrganiserSheet.tsx` footer). The textarea has no `aria-describedby`, so a screen-reader user focused in the field (it is `data-sheet-autofocus`, so focus lands there first) does not hear the requirement until they reach the disabled button. The `Field` primitive already has a `help` slot. Fix: add `aria-describedby={noteTooShort ? \`${ids}-note-required\` : undefined}` to the textarea too. No test pins either attribute (mutant M9 survives).
6. **INFO: label differs from the public card.** The sheet now says "Who are you?" and the public card says "Who are you? (required)". The brief only asked to drop "(optional)", so this is within scope. The reason line already carries the rule, so this is not a defect. Noted for the J3.1 one-rule audit.
7. **INFO: layout.** By reading the code: the reason line is the last child of the content block and the send button is in the sheet footer, so the line disappearing at 3 characters shifts nothing below it in the content, and the footer does not move. Not checked in a browser (see Not verified).

## Requirement table

| Brief item | Status | Evidence |
|---|---|---|
| Label no longer says "(optional)" | OK | diff; M8 killed (7 tests) |
| `REQUEST_NOTE_MIN` imported, not copied | OK | `import { REQUEST_NOTE_MIN } from '../../shared/components/PublicClaimCard'`; test pins value 3 |
| Send disabled while trimmed note is short | OK (trim untested, F3) | M4 killed; M2 survives |
| Reason line in the public card's words | OK | byte-identical sentence to `PublicClaimCard.tsx:350`; M5 killed |
| 500-char limit kept | OK in code, untested (F2) | `maxLength={500}` still present; M7 survives |
| Guard inside `request` | OK in code, untested (F4) | `if (noteTooShort) return Promise.resolve();` M3 survives |
| Untouched sheet sends nothing | OK | `empty` case asserts 0 RPC calls |
| No public card / server change | OK | `git diff --stat`: 5 files, none in server or `PublicClaimCard.tsx` |
| Edited existing tests only changed for the old optional rule | OK | `dancerFirst.refusal.test.tsx` +3 lines (types a note when the field exists); `ClaimStates.test.tsx` 6c now asserts disabled first, then types `I run it` and expects it sent. Both previously sent `''`. Nothing else was weakened. |
| Disabled button says why without colour | OK | text reason line + `aria-describedby`; opacity is extra |
| Tap target >= 44px | OK | `PrimaryButton` default `size='md'` = `h-[52px]` (`src/modules/organiser/ui/Buttons.tsx`) |
| Screenshots on PR / 390x844 walk | MISSING | F1 |
| PR body filled, Verified / Not verified | MISSING | F1 |

## Mutant table

Run against `OrganiserSheet.note.test.tsx` + `ClaimStates.test.tsx` + `dancerFirst.refusal.test.tsx` (48 tests). Each mutant was applied to `OrganiserSheet.tsx` and then reverted.

| # | Mutant | Result |
|---|---|---|
| M1 | min 3 -> 4 | KILLED (2 fail) |
| M1b | min 3 -> 2 | KILLED (1 fail) |
| M2 | drop `.trim()` | **SURVIVED** (F3) |
| M3 | drop guard inside `request` | **SURVIVED** (F4) |
| M4 | drop `disabled={noteTooShort}` | KILLED (6 fail) |
| M5 | drop reason line | KILLED (3 fail) |
| M6 | `<` -> `<=` | KILLED (2 fail) |
| M7 | remove `maxLength={500}` | **SURVIVED** (F2) |
| M8 | restore "(optional)" | KILLED (7 fail) |
| M9 | drop `aria-describedby` on button | **SURVIVED** (F5) |
| M10 | drop guard AND disabled | KILLED (6 fail) |

Result: 7 killed, 4 survived out of 11.

## Tests run (on the PR head, own worktree, `npm ci --ignore-scripts`)

- The new test plus the two edited tests: exit 0, 48/48 passed.
- Red first: the new test run against main's `OrganiserSheet.tsx` gives 7 failed and 1 passed. This confirms the builder's claim (the 1 passing case is the constant check).
- `npm run test:unit`: exit 1, 15 failed / 29429 passed / 31 skipped (4 files failed of 909). The failing files are `tests/eventViewCompat.contract.test.ts`, `tests/occurrenceProgram.contract.test.ts`, `tests/publicEventPageLineup.contract.test.ts` (live-DB contract tests, no DB credentials in the sandbox) and `tests/integrityCouldNotRun.test.ts` (worktree fixture). With the PR's three source/test files reverted to main, the same 4 files fail with the same count (15), so these failures are environmental and not caused by the PR. CI `unit (Europe/London, full)` is green.
- `npx tsc --noEmit -p .` on 260c2df: 0 errors.

## CI table (head 260c2df33, read once after all were completed)

36 check runs, all `completed`, none pending: 25 success, 11 skipped, 0 failure.

| Job | Result |
|---|---|
| integrity | success |
| unit (Europe/London, full) | success |
| unit (Australia/Sydney, tz-sensitive) | success |
| unit (America/New_York, tz-sensitive) | success |
| e2e-smoke | success |
| build-smoke | success |
| phone-qa (1) / (2) / (3) | success |
| phone-qa-section | success (body still TO FILL, see F1) |
| real-data-verified | success (body still TO FILL, see F1) |
| contract-check, live-db-gate | success |
| bundle-budget | success |
| bom-check, bom-check-routed, route, decide | success |
| dancer-area-isolation, masking-check, notification-check, wallclock-brand | success |
| no-preview-reason (x4), open-pr | success |
| lighthouse, doc-weight, enable, og-check, og-preview, synthetic, synthetic-preview, seo-check, seo-preview | skipped |

## Verified
- The diff was checked line by line against brief `docs/briefs/welcome-w1b-join-note.md` (brief branch).
- Tests, red-first and the mutants above were run locally on the PR head.
- The CI state was read through GitHub, all completed.
- The PR body was run through both body checks (both exit 3).
- `PrimaryButton` was checked: it passes `disabled` and `aria-*` through, and its height is 52px.
- The reason sentence is byte-identical to the public card's.

## Not verified
- Browser walk at 390x844 and the visual layout. The sheet needs a signed-in session with a claimable organiser, and there is no preview credential in this run. F7 is from reading the code only.
- Prod data shapes: no new survey. I relied on the builder's handover count (8 requests, 6 with an empty note) and did not re-query it.
- `npm run pre-ship` was not run.
- Server behaviour: the builder says `request_organiser_access_v1` accepts an empty note (parked W2). Not re-checked.
