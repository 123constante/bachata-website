# Handover: P3 W2b "Dates" (PR #1062), 2026-10-27

Branch `claude/p3-w2b-dates`, PR #1062. Briefs: `brief/p3-w2b-dates` `docs/briefs/p3-w2b-dates.md` and
`docs/briefs/p3-w2b-continuation.md`. First worker's handover:
`docs/session-handover-2026-10-27-p3-w2b-dates.md`. Design record: `docs/design/1062.md`.

## This folder
- `walk.phone.spec.ts.txt`: the throwaway 390x844 walk (W2a style). To re-run: copy it to
  `tests/e2e-phone/zz-w2b-walk.phone.spec.ts`, then
  `VITE_ENABLE_ORGANISER_P3=true SHAPES_JSON=$PWD/docs/handover/p3-w2b-dates/shapes.json SHOTS=<dir> npx playwright test --config playwright.phone.config.ts zz-w2b-walk --project phone-390x844`.
- `shapes.json`: the workspace payloads it serves (`wsFixtures.ts` SHAPES plus `dates`, `over30`,
  `noDates`, `few`; stand-in names only).
- 60 PNGs and `metrics.jsonl` (60 rows): 0 sideways scroll, min tap 44px, 0 clipped text, 0 axe
  colour-contrast violations on every row.

## Done in this session (continuation, ticket dt_dd1e5298dfe6)
1. Walk at 390x844, light + dark, every state of the brief's matrix (see the design record). One red found
   by eye: the date sheet said "Friday 30 October, 20:00" under a head saying "9pm". Fixed: title and the
   "Now ..." line use the shared `timeWord`; pinned by `dates.send.test.tsx` (red on the unfixed code first).
2. Contrast rows: `--danger` on `--sheet` / `--card` (`.p3-danger-t`) and the `.p3-in` edge
   (`--line-strong` on `--sheet`, 3:1).
3. `docs/design/1062.md` (stages 2 and 4).
4. Prod read-only: `apply_aggregate_write_p5` bumps `event_occurrence_p5.version` for an `occurrence.*` kind
   and returns it as `new_version` (so the composite's second call is right). Cover upload: same pipeline as
   the existing flows (`uploadFlyer`, bucket `organiser-flyers`: public, 2 MB, jpeg/png/webp, policy
   `organiser_flyers_insert_own_series`, 15 objects); `cover_image_url` is an owner override key.
5. Owner call recorded: Remove stays always greyed (`DATE_WHY.noDelete`); `series.remove_date` not built.

## Review round 1 fixes (ticket dt_6ea1cc7eac91, brief `docs/briefs/p3-w2b-fixes.md`)
Review: `claude/review-1062-r1` `docs/reviews/1062-r1.md`. Each code fix had its test row written and seen
RED on the unfixed code first (model matrix: 8 rows red; data tests: 5 red; the sheet test red against the
old `DateSheet.tsx`), except finding 5's data row, written after the model fix had landed (its model row
was red first).
1. **Fixed (BLOCKER):** b37f588 had rewritten 351 PNGs from other arcs (346 modified, 5 added). Restored
   to `main`'s blobs / removed; `git diff --stat origin/main...HEAD` now lists only W2b files.
2. **Fixed:** "Put this week back" greyed at the date cap (`DATE_WHY.cap`); unskip delegates to add_date.
3. **Fixed:** no series-wide grey on "Change the time" (`hasSessions` and `DATE_WHY.noSessions` removed);
   the server's `no_sessions_for_time_override` copy stays.
4. **Fixed:** "Cancel this date" enabled on a festival date (same sheet, `occurrence.cancel`).
5. **Fixed:** `ruleDate` is null when the series has no weekly rule: no "Not the usual day", skip says
   `DATE_WHY.noPattern`.
6. **Fixed:** All dates empty states (`emptyDatesCopy`): Coming names why Add is off; Breaks gives the
   kind's reason.
7. **Fixed:** `KeyRing` keyed on `occurrenceId` + commands (no version), so a retry after a committed but
   lost response replays; the date sheet keeps the date it opened on, so the error and its retry stay.
8. **Fixed:** `COMMAND_COPY` row for `date_time_session_has_people`; a refused second call of the
   composite says "The details went back to usual, but the time did not." (`PlanStepError`).
9. **Fixed (nit):** `has_bookings` on a skip says "cannot be skipped" (delete keeps "removed").
10. **Not fixed (nit, by design):** breaks on a non-weekly series are not listed; written into
    `docs/design/1062.md` "Known limits" and the PR body's Not verified.

Walk re-run (390x844, 15 tests, 60 rows in `metrics.jsonl`, all 0 sideways / min tap 44 / 0 clipped /
0 contrast). Replaced only the touched shots: `08-festival-date-dark.png` (Cancel enabled) and
`07-ended-all-dates-dark.png` (Coming empty state names why Add is off).

**Trap (the cause of finding 1):** `npm run test:e2e` re-writes the screenshots under
`docs/handover/dancer-rebuild-*` (`tests/e2e/dancer-app/*.spec.ts` save there). After running the e2e gate,
`git checkout -- docs/handover/dancer-rebuild-*` and never `git add -A docs`. This round's first final commit
(ec27e97) picked up 26 of them again; the next commit restores them to `main`.

## Not verified
- No real upload or command against prod (read-only rule); cover upload never exercised end to end.
- Venue picker only against a stand-in list in the walk.
- The native date / time pickers render in the browser locale (en-US in the walk); on a UK phone they
  show dd/mm/yyyy and 24h or 12h per the phone.
- `/code-review` rounds: not run by this worker (CLAUDE.md: the owner types it).
- Phone test by the owner: at the arc's end (flag goes ON after W3).

## CI job steps run locally (sandbox, head before the final commit)
| Job | Steps | Result |
|---|---|---|
| architecture-guard | integrity (via `bash`), legacy-tables, legacy-program-rpcs, lint:architecture, check:images `AUDIT_STRICT=1`, image-widths (+self-test), plan-hygiene self-test, artifact-policy (+self-test), mojibake (+self-test, git grep) | all pass |
| typecheck | check:rpc-typing, check:wallclock-brand | pass (full `tsc`: 95 errors, all outside `p3/`, below the pre-ship baseline of 106) |
| workflow-lint | docs-only self-test, masking, notification (+self-test), no-preview-prefixes (+self-test) | pass |
| unit-tests | dancer-area-isolation (+self-test); `test:unit:offline --maxWorkers=3`; `test:unit:timing` | 607/608 files, 15296 passed; 5 fail in `tests/integrityCouldNotRun.test.ts` (sandbox: typescript resolves from /tmp, so the precondition breaks; this PR touches no tests/scripts/bin); timing pass |
| perf-budget | self-tests, build, bundle-budget, first-load-requests, chunk-cycles | pass; doc-weight / lighthouse need the Vercel preview (CI only) |
| e2e-smoke | `npm run test:e2e` | pass |
| phone-qa | full phone suite (406 passed, 128 skipped), build suite | pass |
| lint chain | `npm run lint` | 21/22 links pass; check:integrity exit 126 = lost exec bit in the sandbox (CI does `chmod +x`; passes via `bash`) |
| pre-ship | `npm run pre-ship` | red only on check:integrity (exec bit) and test:unit (live-DB contract tests without keys + the sandbox test above); build, budgets, ratchets, typecheck ratchet pass |
