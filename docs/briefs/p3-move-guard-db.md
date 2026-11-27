# Brief: p3-move-guard-db (ADMIN repo bachata-admin, CAREFUL lane, Opus). Branch claude/p3-move-guard-db. Migration PR.

Read first: the admin repo CLAUDE.md (migration rules: placeholder version far ahead, e.g. 99990101000020; never apply anything; replay proof comes from CI). Website context: FIXLIST rows F-29 and F-30 in docs/design/p3-acceptance/FIXLIST.md on bachata-website main, and WALKLIST W-22.
Decision D12 (owner autopilot, logged): moving a date that has people on it is ALLOWED only after a warning the organiser confirms; the organiser is warned, and telling the people is out of scope for now (note it in the PR as a follow-up, do not build notifications).

## Do
1. SURVEY (read-only SQL on prod project stsdtacfauprzrdebmzg, counts only): read `_cmd_occurrence_move_date_p5` live (pg_proc) and the guards of skip / remove / stop-repeating, which already check people. Table: command x (guest-list entries, going people, sold tickets) it checks today. Counts: future dates with active guest-list entries (the audit saw 3), going people, tickets.
2. FIX F-29: `_cmd_occurrence_move_date_p5` must refuse a move when the date has any active guest-list entry, going person or sold ticket, UNLESS the payload carries `acknowledge_people: true`. The refusal is a typed error `date_has_people` whose detail returns the three counts, so the screen can show "N people are going; move anyway?". With the acknowledgement it behaves exactly as today. A date with no people moves exactly as today (prove with a test). Reuse the helper the skip guard uses; do not copy its SQL.
3. F-30: prove or disprove with a test whether a MOVED date counts as hand-edited (`_occurrence_is_curated_v1`) so a later repeat-rule change does not drop or re-make it. If a moved date is not curated and a rule change would drop it, fix it in the smallest way and say so; if it is already safe, add the regression test only.
4. Migration (placeholder version) + DB contract tests, table-driven over: date with no people; with guest-list entries only; with going only; with tickets only; with all three; acknowledged; cancelled date; past date; moved-then-rule-changed. Red first. Explicit GRANT/REVOKE if any new function.
5. Write `docs/design/move-guard-api.md` in the admin repo: error code, detail shape, payload flag. The Website worker builds the DateSheet warning from it.
6. PR body: Verified / Not verified, per-job table, the survey table. Hard limits: Supabase read-only, no apply, no merge.

Stopping rule: one build round; push once at the end. Commit subject ends [worker-done <ticket>].
