# Handover: P3 W3c-1 Repeat screen (flag organiserP3 stays OFF)

Branch `claude/w3c-1-repeat`. Brief: `brief/w3c-1-repeat:docs/briefs/w3c-1-repeat.md`. Design record: `docs/design/w3c-1-repeat.md`.

## Done
- `src/modules/organiser/p3/model/repeat.ts`: ONE access mapping (`repeatAccess`: edit / disabled (course) / readonly (custom, admin-only monthly, ended, archived, in review) / none (one-off, festival)), the draft <-> stored rule, the owner-rule payload (`rulePayload`), client problems, the plan (untouched sends nothing), the dry-run parser and lines, the five failure sentences (`REPEAT_FAIL`, `repeatFailure`), course "Class n of N" + last class from workspace meta.
- `src/modules/organiser/p3/screens/RepeatSheet.tsx`: the sheet, portalled to document.body inside its own `p3-theme p3-portal`; one dry run per settled draft (350 ms), stale answers never shown; Save sends the same payload without dry_run once.
- `src/modules/organiser/p3/data/repeat.ts`: `previewRepeat` (series_command_p5 with dry_run).
- `EventPage.tsx`: a "Repeats" row under the status row (C3 Repeats row) opens the sheet. Stop repeating untouched in the Status sheet.
- `events/eventModel.ts`: `parseEventWorkspace` reads `meta.class_count` / `meta.last_class_date` (additive; no non-P3 behaviour change).
- Tests: `model/__tests__/repeat.matrix.test.ts` (RED FIRST commit a999db94: 51 red on a stub), `screens/__tests__/repeat.send.test.tsx` (real send path), `tests/e2e/walk-w3c-1-repeat.spec.ts` (Part 1 in the e2e gate; Part 2 needs the P3 flag).

## Fix round 1 (brief `brief/w3c-1-repeat-fix1`, review `claude/review-w3c-1-repeat:docs/review/w3c-1-repeat.md`)
- F2 BLOCK: Save stays disabled after a FAILED dry run (refused, or thrown offline fetch); the why reads "The dates could not be checked yet. Tap Check again, then save." RED commit `7d05934` (2 probe cases in `repeat.send.test.tsx`, both red on the unfixed sheet), fix in `767ade5`.
- F3: `REPEAT_FAIL.until_before_start` / `start_too_old`, matched in `repeatFailure` before the shared copy (messages verbatim from prod `apply_aggregate_write_p5`, read-only `pg_get_functiondef` 2026-10-29). `repeatProblem`/`repeatPlan` take the series anchor (`repeatStart`: COALESCE(default_start_date, created_at), as `isRuleDate`) and pre-check a last date before it. `selfServeErrors.ts:254` untouched. Matrix rows for both + 5 anchor rows.
- F4: `previewFailure`: an offline dry run says `REPEAT_COPY.previewOffline` ("...so the dates could not be checked. Check your connection, then tap Check again."), never `OFFLINE_SAVE_MESSAGE`.
- F5: the 26 dancer-rebuild screenshots restored to main (`d57c04f`); e2e screenshot dirs checked out before every commit.
- F6: the save goes through `sendOnce` (EventPage `useSendOnce`) under a key held per `draftSig`; retry after a dropped save reuses it, a changed draft gets a new one (send test; mutation "always new key" turns it red).
- F7: on a course the greyed editor's button reads "Can't change here". F9: `invalid_transition: course_needs_count` anchored (test: a bare mention falls to the shared copy).
- F8, F10: no change (per brief). PR body not edited (orchestrator does it).

## Left / next steps
- One independent (Fable) review, one fix round, then orchestrator walk (brief stopping rule).
- Not built (out of W3c-1 scope or brief): "First date" in More options (needs series.upsert default_start_date), a leave guard on closing with unsaved changes (Close discards; nothing is sent), Undo after save, Make a copy.
- The shared P3 Toast is not portalled (unchanged shared component); it is position: fixed and the walk asserts its box is inside 390x844.
- Entry is the event-page Repeats row, not a Status-sheet row (C3 places Repeat on its own row; adding a StatusMove would change the shared status mapping).

## Checks (sandbox, fix round 1, head after this commit)
| Job / step | Result |
|---|---|
| unit, Europe/London full (`vitest run`) | 18568 passed, 15 failed in 4 files, all pre-existing sandbox-only (eventViewCompat / occurrenceProgram / publicEventPageLineup live-DB contracts, integrityCouldNotRun) |
| unit, P3 under Australia/Sydney and America/New_York | 2157/2157 each |
| repeat matrix + send tests | green (send 15/15) |
| integrity: check-integrity.sh, legacy-tables, legacy-program-rpcs, lint:architecture, check:images AUDIT_STRICT=1, mojibake self-test, plan-hygiene self-test | all exit 0 |
| `npm run lint` chain | 21/22 green; `check:integrity` exit 126 = bin/*.sh not executable in this checkout (CI chmods; the script itself passes via bash) |
| eslint on changed files | clean |
| build-smoke (`npm run build`) | ok |
| bundle-budget | all budgets respected; dancer-app /app 373.6 KB first-load, unchanged; P3 strings absent from the build (flag off), 0 bytes to /app |
| e2e (`npm run test:e2e`) | 177 passed, 9 skipped, 5 failed: account-settings x2, dancer-home, organiser-onboarding (pre-existing sandbox dev-server timing, listed below), dancer-app/home-nights (toBeVisible; dancer app, not touched by this diff). walk-w3c-1-repeat passed. Screenshot and snapshot churn from the runs checked out, not committed |
| contract-check / live-db / real-data-verified / phone-qa | CI only (secrets / PR body); real-data-verified needs the PR-body label fix (review F1, orchestrator) |

## Verified / Not verified (fix round 1)
- Verified: the two end.date refusal strings read from prod (SELECT only); F2/F4/F6/F7/F9 through the real EventPage send path with only supabase.rpc stood in; F6 by mutation.
- Not verified: no dry run or save sent to prod; no real phone; walk Part 2 (flag on) not run; CI results on this head not yet in at writing.

## Checks (sandbox)
See the PR body table. Pre-existing on main in this sandbox: 4 unit test files (live-DB contract suites + integrityCouldNotRun, no credentials / worktree), 5 e2e specs (account-settings, dancer-home, organiser-home, organiser-onboarding: dev-server timing).
