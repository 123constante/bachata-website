# Handover: P3 W3c-1 Repeat screen (flag organiserP3 stays OFF)

Branch `claude/w3c-1-repeat`. Brief: `brief/w3c-1-repeat:docs/briefs/w3c-1-repeat.md`. Design record: `docs/design/w3c-1-repeat.md`.

## Done
- `src/modules/organiser/p3/model/repeat.ts`: ONE access mapping (`repeatAccess`: edit / disabled (course) / readonly (custom, admin-only monthly, ended, archived, in review) / none (one-off, festival)), the draft <-> stored rule, the owner-rule payload (`rulePayload`), client problems, the plan (untouched sends nothing), the dry-run parser and lines, the five failure sentences (`REPEAT_FAIL`, `repeatFailure`), course "Class n of N" + last class from workspace meta.
- `src/modules/organiser/p3/screens/RepeatSheet.tsx`: the sheet, portalled to document.body inside its own `p3-theme p3-portal`; one dry run per settled draft (350 ms), stale answers never shown; Save sends the same payload without dry_run once.
- `src/modules/organiser/p3/data/repeat.ts`: `previewRepeat` (series_command_p5 with dry_run).
- `EventPage.tsx`: a "Repeats" row under the status row (C3 Repeats row) opens the sheet. Stop repeating untouched in the Status sheet.
- `events/eventModel.ts`: `parseEventWorkspace` reads `meta.class_count` / `meta.last_class_date` (additive; no non-P3 behaviour change).
- Tests: `model/__tests__/repeat.matrix.test.ts` (RED FIRST commit a999db94: 51 red on a stub), `screens/__tests__/repeat.send.test.tsx` (real send path), `tests/e2e/walk-w3c-1-repeat.spec.ts` (Part 1 in the e2e gate; Part 2 needs the P3 flag).

## Left / next steps
- One independent (Fable) review, one fix round, then orchestrator walk (brief stopping rule).
- Not built (out of W3c-1 scope or brief): "First date" in More options (needs series.upsert default_start_date), a leave guard on closing with unsaved changes (Close discards; nothing is sent), Undo after save, Make a copy.
- The shared P3 Toast is not portalled (unchanged shared component); it is position: fixed and the walk asserts its box is inside 390x844.
- Entry is the event-page Repeats row, not a Status-sheet row (C3 places Repeat on its own row; adding a StatusMove would change the shared status mapping).

## Checks (sandbox)
See the PR body table. Pre-existing on main in this sandbox: 4 unit test files (live-DB contract suites + integrityCouldNotRun, no credentials / worktree), 5 e2e specs (account-settings, dancer-home, organiser-home, organiser-onboarding: dev-server timing).
