# Design record: W3c-1 Repeat screen (P3, flag organiserP3 OFF)

## Stage 1 brief
1. Who/what: an owner changes how an event repeats (weekdays, interval, monthly pattern, how it ends) on the P3 event page.
2. Stage 2 reference: mockup C3 Repeat sheets (origin/brief/er-p3-mock-c3, docs/handover/going-p3/*); no new options needed.
3. Reads: series.set_recurrence dry_run -> will_add, will_remove, will_cancel_booked, keeps_own_changes, date_cap, next_8; workspace meta.class_count / last_class_date.
4. Owner rule: weekly 1..7 weekdays interval 1..4; monthly day_of_month|nth_weekday|multi_nth_weekday; end none | after_count 1..500 | until_date <= 24 months. custom / weekday_except_last are admin-only (shown read-only).
5. Course decision (program lead, 2026-10-28): rule editor shown DISABLED with a reason that says what the person can do instead (change the dates directly).

## Real-data survey (prod, counts only, 2026-10-28, event_series_p5)
recurring/live: weekly-none 25, weekly-until 3, monthly-none 5, monthly-after_count 1, custom 1, no rule 9. recurring/draft: weekly 7, no rule 1. recurring/paused weekly 1. recurring/ended no rule 13. recurring/archived: weekly 7, monthly 2, no rule 3. course/live weekly after_count 6; course draft 1; ended 8 no rule. one_off 651 (635 archived). festival 13.
Shapes the screen must cover: no rule, weekly none/until/after_count, monthly none/after_count, custom (read-only), course (disabled), ended/archived (no edit), one_off (not a repeating event).

## Stage 4 checks (self-running)
contrast >= 4.5, taps >= 44px, no clipping at 390x844, no sideways scroll, every empty/loading/error state actionable, untouched save sends nothing, failure codes (count_over_cap, interval_out_of_range, until_too_far, mode_not_allowed, course_needs_count) each map to a sentence saying what to do.

## Chosen mockup and build notes (W3c-1 build, 2026-10-28)
- Mockup: C3 Repeat screen (origin/claude/er-p3-mock-c3, docs/organiser-rebuild/p3/mockups/C3.md rows 23-28, 33, 52 and 29-30): Every week / Every month; multi-day buttons; first/second/third/fourth/last chips (several at once); Keeps going / Stops after N times / Stops on a date; Every N in More options; one-sentence summary + next 8 dates; red "This removes N dates already on the calendar"; "N dates keep their own changes". Not built here: "First date" in More options (needs series.upsert default_start_date; out of W3c-1 scope).
- Entry: a "Repeats" row on the P3 event page under the status row (C3's Repeats row), showing the stored pattern in words. Stop repeating stays in the Status sheet unchanged.
- Data proven on prod (read-only, 2026-10-28): `_cmd_series_set_recurrence_p5` (dry run rolls back inside the handler; returns recurrence_rule, materialise null, dry_run, date_cap, dates_considered, will_add, will_remove, will_cancel_booked, keeps_own_changes, next_8), `apply_aggregate_write_p5` (dry run returns before version bump and audit), `_owner_rule_problem_p5` (owner rule), `_command_failure_code_p5` (the five codes), `admin_event_workspace_p5` meta.class_count / last_class_date (event_occurrence_p5 not cancelled and not in event_series_p5.removed_dates). Writer of recurrence_rule: series.set_recurrence only (event_series_p5.recurrence_rule).
- Stored rule key shapes on prod: weekly {end, interval, mode, weekdays} 42, weekly without interval 9, monthly nth_weekday 6, monthly day_of_month 1, monthly weekday_except_last 1, custom {dates, mode} 1.

## Self-check numbers (walk-w3c-1-repeat.spec.ts, 390x844, html 13.5px, light and dark)
- Sheet, Save button and toast boxes inside the viewport: yes (both themes); page scrollY 0 after open.
- Taps: every control >= 44px (day chips, segments, inputs, select, More options, Save, Undo, Close).
- Contrast: every text node in the sheet >= 4.5:1 (both themes; danger lines on --cancel-bg included).
- No clipping, no sideways scroll (document and sheet).
