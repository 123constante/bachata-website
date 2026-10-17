# Brief F-S3 -- ONE fix pass for slice S3 (Add / Cancel a date), from REVIEW-S3

Repo `123constante/bachata-website`. Work and push ONLY on `claude/org-r1-addcancel` (PR #801, head 39f7db2; you continue the S3 author's branch, base `feat/organiser-r1`). Read FIRST with plain git: `git fetch origin claude/org-r1-review-S3 arc/briefs-organiser-r1`, then `git show origin/claude/org-r1-review-S3:docs/organiser-rebuild/reviews/REVIEW-S3.md` (verdict 2 BLOCKING / 3 SHOULD / 6 NOTE) and `briefs/00-COMMON.md`, `briefs/S3-addcancel.md`, `handovers/S3.md` (on the slice branch).

## Failures in the owner's words (why this matters)
The owner's rule: "a control that cannot work is disabled WITH a reason" and "no text points at a control that is not on screen". Reviewer proved on prod (SELECT, counts): 27 of 67 live series sit at 30+ coming dates, the smallest at 47, so "Put it back" (D61) is refused by the server (`date_cap`) on every one of them; 7 live festivals hold one date and `series.add_date` is always refused (`festival_extra_date`) while C7 lists them and C8 offers 30 days.

## Do (all findings, one pass, ONE push)
1. B1: before offering Put it back (Done `next` after a cancel, and C13 for an already-cancelled date) compute coming SCHEDULED count; when `>= MAX_UPCOMING` pass no `next` and make C13's Put it back `aria-disabled` with `CAP_NOTE`-style reason (own wording for a restore, not the add-date copy). Add a table row with a 47-coming fixture and a `date_cap` refusal test for both cancel writes.
2. B2: festival that already holds a date: every day in C8 `aria-disabled` with reason "A festival has one date"; show it on the C7 row. Add a festival fixture row to the matrix. Record in the handover that Home's `no_dates_left` for a festival is S1/homeJobs territory (do not edit S1 files).
3. S1: when the second write (`occurrence.set_time`) fails, Done must say the typed time was NOT saved and where to change it. S2: add the missing idempotency-key-reuse test for a cancel and a put-back retry. N1: keep the cancelled date `ox` in the after-state of the no-dates test. Take the other NOTEs only if one line each.
4. Open call S3 (at-cap series cannot add): owner default = C7 row stays tappable only if it can work; at-cap rows are shown disabled with the CAP_NOTE reason. Log this decision in the handover.
5. RED FIRST: write each new test, run it against the unfixed code, paste the failing output in the handover, then fix. Mutate each fix once (revert the guard, see red).
6. Run every CI step you can in your sandbox (typecheck vs baseline error count, `test:unit`, lint, `build`, `check:mojibake`, `lint:architecture`; read `.github/workflows`). Table in the handover with command and exit code. GitHub Actions on billed runners may be refused by billing: that is not a code failure.

## Rules
Plain git only, never `gh api`. Shell commands without variables or `$(...)`. No Vercel login. Opus. Context cap 30% (25% start nothing new; push `PARTIAL [worker-done <ticket>]` with a handover). ONE push; last commit subject ends `[worker-done <ticket>]`. Update `handovers/S3.md` with a "Fix pass" section and a Verified / Not verified block.
