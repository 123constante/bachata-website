# Fix brief F-PAR-final -- ONE small finishing pass on PR #809 from REVIEW-PAR-C

Repo `123constante/bachata-website`. Work on `claude/org-r1-integrate` ITSELF (head 6c33ffa; you are the only worker on it). Opus. ONE push at the end (plus PARTIAL if cut short; write `docs/organiser-rebuild/handovers/FIX-PAR-FINAL.md` with done / left / next steps before any stop). Read first: `git fetch origin claude/org-r1-review-PARC arc/briefs-organiser-r1`, then `git show origin/claude/org-r1-review-PARC:docs/organiser-rebuild/reviews/REVIEW-PAR-C.md` and `handovers/FIX-PAR.md` on the integrate branch. Plain git only, never `gh api`; shell commands without variables, loops or `$(...)`; check a PRODUCTION build (`npm run build`). Context: at 25% start nothing new, by 30% push PARTIAL. Last commit subject ends `[worker-done <ticket>]` (do NOT add [skip preview]). CI rule: GitHub Actions may be refused for billing; run every CI job step you can in your sandbox in the FOREGROUND and put a per-job table (command, exit code) in the handover. No migration, no prod write; do not touch the density-exempt calendar files or `ui/dialog.tsx`.

## Method (binding)
Test FIRST, run against the UNFIXED code and paste the red, then fix and paste the green. Table-driven where it is a cross-screen fact. HTML entities / `\u` escapes, never raw Unicode punctuation.

## Work list (owner chose exactly these three; nothing else)
- **S1.** `flows/change/Pick.tsx:166-174`: when `shiftRefusal(recurrence_rule)` is set (weekly or monthly series, server refuses every bulk_shift), show the refusal reason ("Dates of a repeating event can't be moved together. Change the repeat instead.") in place of the Earlier/Later chips, the days box and Move, or render all three disabled WITH that reason. Table-driven test over: weekly, monthly, no rule, one-off. Cancel-picked-dates must still work on a weekly series.
- **N2.** Change time on a festival (`s.format === 'festival' || s.festival_id`; 6 coming dates on prod): refuse BEFORE the form with a plain reason ("Festival times are set for the whole festival, not one date." or similar) and a way forward (Sessions link if one exists, else say who to ask). One shared refusal mapping so Which date / Change what / Time say the same thing. Test every shape: festival, multi-day, normal.
- **N4.** Pick several with 0 coming dates renders ONLY NO_COMING plus the Add a date link; render the action block only when `dates.length > 0`.

Queue in the handover (do NOT fix): N1 (start delta ignores midnight on the server; extend the admin defect `_cmd_occurrence_set_time_p5` to min(eff_start); 0 prod reach), N3, N5, N6 (the guard also shows an "Open Sessions" link beside a "Change one session's time" row that goes to the same place; harmless).

## Done =
FIX-PAR-FINAL.md: red-first table, Queued, per-job CI table, Verified / Not verified. Then walk 390x844 on the production build: Pick several on a weekly series and on a one-off, Change time on a festival, Pick on 0 coming dates; screenshots in `docs/organiser-rebuild/walk-FINAL/`.
