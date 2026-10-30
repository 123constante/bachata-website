# p3-prefix-c-repeat-null: weekly events with no stored rule must not read "Doesn't repeat"

Lane: normal if Website-only (STOP and report if the right answer needs a database change). Model: Opus. One PR, branch claude/p3-prefix-c-repeat-null from main.

## Owner words
"All four must be fixed before the organiser rebuild goes on." Audit gap 3 and 5 (docs/review/p3-real-data-shapes.md, branch claude/review-p3-real-data-shapes): 9 live weekly series have a NULL recurrence rule (about 20% of live recurring series; the same copy appears on 21 ended series). The event page Repeats row, the Repeat sheet ("doesn't repeat yet") and Skip ("Only a weekly pattern...") all treat NULL as "does not repeat" (src/modules/organiser/p3/model/repeat.ts:288,362, screens/RepeatSheet.tsx:220, model/dates.ts:114). Also `removed_dates` (breaks) are hidden on non-weekly or NULL-rule series (p3/data/dates.ts:62-63), so "Put this week back" cannot be reached.

## Do
1. Prove the data source first (read-only prod, counts only): for the live series with a NULL rule, what do their dates actually look like (weekly spacing? count?) and which table writes the rule. State it.
2. Where the stored dates show a clear weekly pattern, say so honestly in the P3 screens (derive the label from the dates, read-only; do NOT write a rule). Where nothing can be said, use copy that does not claim "doesn't repeat" and says what the person CAN do. Keep Skip working for those series if the dates allow it, otherwise a disabled control with the reason.
3. Show breaks (removed_dates) and "Put this week back" on any series that has them, whatever its rule.
4. One shared mapping for rule -> label used by the event page, the sheet and Skip. Table-driven test: rule shape (weekly, monthly/custom, NULL with weekly dates, NULL one-off, ended) x screen. Red first on main.

## Standing rules
Zero bytes to /app first load (bundle checks on main and branch; never edit perf-budgets.json or vite.config.ts). Compact copy, explicit px tap targets, no copy pointing at a missing control. Admin repo is NOT touched. One independent review, one fix round, then the orchestrator walk. Never merge or approve.
Finish under 35% context, early checkpoint push, PR body with Verified on real data and Phone QA sections. Marker [worker-done p3-prefix-c].
