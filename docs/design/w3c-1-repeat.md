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
