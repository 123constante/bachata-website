# Review brief R-S3 -- independent review of slice S3 (Add a date, Cancel a date, no dates left)

Repo `123constante/bachata-website`. You are the REVIEWER, not the author. Work on branch `claude/org-r1-review-S3` (create it from `claude/org-r1-addcancel`, PR #801, head 39f7db2); you commit ONLY `docs/organiser-rebuild/reviews/REVIEW-S3.md` there and change no source file. Read `briefs/00-COMMON.md`, `briefs/S3-addcancel.md`, `handovers/S3.md` on the slice branch, and `reviews/REVIEW-S2.md` (same author pattern: check the same classes of defect, e.g. an untouched-Save test that cannot fail, idempotency reuse untested).

## Effort and stopping rule
Opus, xhigh, correctness first. ONE pass. Findings go back to the SAME slice in one fix pass; you do not fix. Severity: BLOCKING / SHOULD / NOTE. Read and push with PLAIN git, never `gh api`. Shell commands without variables, loops or `$(...)`. Stay under 30% context; at 25% start nothing new; final commit subject ends `[worker-done dt_<your ticket>]` (PARTIAL if cut short). ONE push.

## Rule on these author deviations (handover "Deviations")
1. `flows/fix/NoDates*.tsx` NOT created: C15 reuses C8 with the event pre-chosen. Acceptable against 4.3 and the brief's Owns row? Is the Home `no_dates_left` row -> C8 -> Done -> row gone proof real (all-cancelled fixture, R3-3)?
2. Cancel reason is optional in the UI but the server needs a `cancellation_reasons` label; no pick sends `Other`. Verify against live prod `apply_aggregate_write_p5` / the labels table (read-only SELECT on `stsdtacfauprzrdebmzg`). Is "Other" not offered as a chip right?
3. A changed time on Add costs TWO writes (`series.add_date` then `occurrence.set_time`). If the second fails Done says the usual time. Acceptable? An untouched time must be exactly ONE command.
4. Add uses `useOwnerCommand` (not `useRunCommands`); `series.*` -> `series_command_p5`, occurrence kinds -> `occurrence_command_p5` with the date's own version. Verify from live `pg_proc`.

## What to verify (command + output for each)
1. Files touched vs the S3 Owns row; protected files untouched (`git diff --name-only`); judge `OrganiserRoutes.tsx` and `routes.test.tsx` edits and their merge with S2's identical Done wiring (do a trial `git merge` of S2 `claude/org-r1-change` into a scratch branch, report conflicts).
2. Boards C7-C9, C11-C13, Done: one-event skip; C8 = 30 days minus every held day (scheduled OR cancelled), past/held/capped day by URL refused; at the 30 cap every day aria-disabled with CAP_NOTE; C12 lists coming SCHEDULED dates only, none -> "No dates to cancel" + ONE action; C13 is the only `WARN_DATE` importer; "Put it back" sends ONE `occurrence.cancel {cancelled:false}` once (no double-send on re-render or back button); already-cancelled date opened directly; version_conflict -> R3-7; no Undo.
3. Exactly the right command count per path; wall-clock dates (R3-18), never UTC-shifted; London DST edge days (25-26 October 2026, 28 March) in the 30-day window.
4. Tests that can fail: run `npx vitest run src/modules/organiser/flows/add src/modules/organiser/flows/cancel src/modules/organiser/shell`, then MUTATE and paste each red, reverting after each: (a) two commands on the untouched-time path; (b) idempotency key regenerated on retry; (c) put-it-back sends twice; (d) cancelled held day not excluded from C8; (e) C12 includes cancelled dates.
5. Real data (prod, SELECT only, counts only): re-run ONE aggregate: live series by scheduled-coming-date buckets (27 of 67 at >= 30 per the author), series with only cancelled coming dates, held days in a 30-day window. Open call, recommend only: at-cap series (27 live) cannot add; is the message enough or should C7 hide/disable the row?
6. CI steps from `.github/workflows` in the sandbox: typecheck error count vs base, `test:unit`, lint, `build`, `check:mojibake`, `lint:architecture`; list what could not run.

## Output
`docs/organiser-rebuild/reviews/REVIEW-S3.md`: verdict (CLEAN / n BLOCKING / n SHOULD / n NOTE), the four rulings first, findings with file:line, why and the one-sentence fix, mutation evidence, CI table, Verified / Not verified.
