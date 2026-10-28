# Brief: independent review of PR #1122 (P3 W3c-1 Repeat screen), read-only
Reviewer: Fable. Builder was Opus on claude/w3c-1-repeat (head 9396d66b3). Your branch: claude/review-w3c-1-repeat. You change NO product code. Write one file only: docs/review/w3c-1-repeat.md, push it, report. Stopping rule: one review pass; context cap 30%.

## What to review against
The builder brief: `git fetch origin brief/w3c-1-repeat` then `git show FETCH_HEAD:docs/briefs/w3c-1-repeat.md`. Fetch the build: `git fetch origin claude/w3c-1-repeat` and read the diff against main. Handover: docs/handovers/w3c-1-repeat.md on that branch.

## Hunt for (ranked: BLOCK / SHOULD-FIX / NIT, each with file:line and a concrete failure input)
1. Save path correctness (the reason this is Opus + Fable): payload shape for series.set_recurrence vs the live RPC and validator (read the live bodies read-only on prod via the Supabase connector, project stsdtacfauprzrdebmzg: _cmd_series_set_recurrence_p5, _validate_recurrence_payload_v1, _owner_rule_problem_p5). Weekly weekdays 1..7 / interval 1..4; monthly day_of_month | nth_weekday | multi_nth_weekday; end none | after_count 1..500 | until_date <= 24 months. Weekday numbering and date maths (timezone, month ends, 31st, 5th weekday, DST). Untouched save sends nothing. Dry-run races: stale answer shown, Save enabled while a dry run is pending or failed, double Save.
2. Every shape x screen: no rule, weekly none/until/after_count, monthly, custom (read-only), course (DISABLED with a reason that says what the person can do), ended/archived/paused/draft, one_off, festival. Text never points at a missing control; disabled controls say why; empty states say what the person CAN do. Compare repeatAccess against the server rules (course needs format recurring; custom and weekday_except_last are admin-only).
3. Failure codes count_over_cap, interval_out_of_range, until_too_far, mode_not_allowed, course_needs_count plus version conflict: each maps to a sentence saying what to do.
4. Zero bytes to /app first load (check the lazy chunk boundary: is RepeatSheet reachable from a dancer-app first-load import?), eventModel.ts change is additive only, no non-P3 behaviour change, organiserP3 flag OFF means no visible change.
5. Overlay geometry (portalled sheet, preventScroll, toast inside 390x844), taps >= 44 explicit px, contrast >= 4.5, tests that assert nothing (tautologies), red-first claim real.
6. PR #1122 body vs the checks: CI jobs real-data-verified and phone-qa-section are RED on the PR. Read .github/workflows for those two jobs and say exactly which literal lines the PR body must contain.

## Output
docs/review/w3c-1-repeat.md: verdict (APPROVE / FIX FIRST), numbered findings ranked, a "Verified / Not verified" block, and the exact PR-body lines needed. Last commit subject ends "[worker-done <ticket>]". Hard limits as in every worker prompt.
