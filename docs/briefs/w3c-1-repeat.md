# Brief: P3 W3c-1 Repeat screen (flag organiserP3 stays OFF)
Branch: claude/w3c-1-repeat (from main). Lane: careful (save path). Builder: Opus. One PR. Stopping rule: one independent (Fable) review, one fix round, then orchestrator walk. Context cap 30%; push an early checkpoint (subject ends [skip preview]); handover docs/handovers/w3c-1-repeat.md.

## Sources (read first)
- ~/.claude is NOT available to you: everything you need is here or in the repo. Design record + stage 1 brief + prod shape survey: docs/design/w3c-1-repeat.md (this brief's branch brief/w3c-1-repeat; read it with git show origin/brief/w3c-1-repeat:docs/design/w3c-1-repeat.md; do not merge that branch, copy it into your branch as docs/design/w3c-1-repeat.md).
- Mockups = Design Gate stage 2 (C3 Repeat sheets): branch origin/brief/er-p3-mock-c3 and docs/handover/going-p3/*. Contract: origin/brief/p3-a0-contract (A2 R1). Tokens: src/modules/organiser/p3/theme/p3.css. Existing P3 patterns: src/modules/organiser/p3/screens/{StatusSheet,Sheet,DateSheet,EditTray,Toast,savedToast}.tsx, model/saveModel.ts, data/*.
- Today there is NO P3 Repeat screen; weekly-only logic lives in organiser/events/eventModel.ts (series.set_recurrence builders) and schedule.ts. Reuse the command builders; change eventModel.ts callers only if payloads change. Do NOT touch organiser/events/* behaviour for the non-P3 UI.

## Scope (W3c-1 only; no Make a copy, no Undo, no bulk cancel)
A Repeat sheet on the P3 event page that sets how a series repeats, using admin #1098 (live on prod, migration 20270306160000):
- series.set_recurrence payload with dry_run:true returns {recurrence_rule, materialise:null, dry_run, date_cap:{cap:30,upcoming,held_back}|null, dates_considered, will_add, will_remove, will_cancel_booked, keeps_own_changes, next_8}. Show a live preview from it: next 8 dates, "N dates added", red "This removes N dates", "N dates keep their own changes", cancelled-with-bookings count, date-cap note. Real save = same payload without dry_run. Untouched save sends nothing.
- Owner rule: weekly 1..7 weekdays, interval 1..4; monthly day_of_month | nth_weekday | multi_nth_weekday; end none | after_count 1..500 | until_date <= 24 months from today. custom and weekday_except_last are admin-only: show the current rule read-only with the reason, no edit.
- Workspace meta.class_count and meta.last_class_date: courses show "Class n of N" and last class date.
- COURSE decision (program lead, binding): owners cannot set a rule on a course (server: format must be recurring). Show the rule editor DISABLED with a reason saying what the person CAN do instead (change the dates directly). One-off / festival: not a repeating event, offer the existing make-it-repeat path only if it exists today, else say why not. Ended/archived: read-only with the reason.
- Failure codes each map to one sentence saying what to do: count_over_cap, interval_out_of_range, until_too_far, mode_not_allowed, course_needs_count (also version conflict / not permitted per existing handling).
- Entry point: wherever the P3 event page / StatusSheet currently offers repeat actions (look at StatusSheet "Stop repeating"); keep Stop repeating as is.

## Standing header lines
- Prove the data source first: read the live RPC bodies (_cmd_series_set_recurrence_p5, _owner_weekly_rule_problem_p5 / the validator, the workspace reader) read-only on prod (Supabase MCP, project stsdtacfauprzrdebmzg); state which table/column each field depends on and who writes it. Do not write to prod.
- Zero bytes to the /app first load: npm run check:bundle-budget main vs branch; never edit perf-budgets.json or vite.config.ts. Flag organiserP3 OFF means the sheet must be lazy / in the P3 chunk.
- Overlay geometry: sheet and toast portalled to document.body; opening must not scroll the page (focus({ preventScroll: true })); e2e at 390x844 with a flowing clock asserts sheet, confirm button and toast boxes inside the viewport.
- Hard limits: Supabase read-only, never merge/approve/--no-verify, bot-authored PR, plain git (no gh api), no shell variables or loops, push + handover before stopping.

## Definition of done (literal lines in the PR body)
- "- Shapes surveyed:" prod counts from docs/design/w3c-1-repeat.md (re-run read-only to confirm), "- Checks run:" with a per-CI-job table (run every step of every workflow job in your sandbox), "- NOT verified:", "## Phone QA" (3-6 steps).
- Table-driven vitest: every shape (no rule, weekly none/until/after_count, monthly none/after_count, custom, course live/draft/ended, one_off, festival, ended, archived, paused, draft) x {untouched, one field, several, invalid, over cap}. One shared mapping for what is editable and why not; no text pointing at a missing control; disabled controls say why; empty states say what the person can do. RED FIRST commits for: untouched save sends nothing; course disabled; each failure code sentence.
- Walk spec tests/e2e/walk-w3c-1-repeat.spec.ts at 390x844 on prod-shaped fixtures, listed by name in the e2e gate; design checks: contrast >= 4.5, taps >= 44px (explicit px, html is ~13.5px on phones), no clipping, no sideways scroll.
- docs/design/w3c-1-repeat.md linked in the PR body (add chosen mockup reference + self-check numbers).
