# Brief: An organiser can change a course's weekly night and number of classes
Brief-version: 2
Branch: claude/organiser-course-schedule-edit
Lane: normal, Opus. bachata-website, must not touch supabase/**, the calendar density-exclusion files or the legacy events/ schedule screens
Serves: an organiser who runs a course (about 17 of 763 series, 9 with a repeat rule) and today must ask the team to move its night or add a class (goal: organisers update their own events)

## What main lacks
- extends: repeatAccess returns mode 'disabled' for every course, so the Repeat sheet is greyed and says the pattern cannot change -- src/modules/organiser/p3/model/repeat.ts
- extends: the Repeat sheet shows the course editor greyed; it must let a weekly after_count course change its weekday, interval and class count -- src/modules/organiser/p3/screens/RepeatSheet.tsx
- a helper that says when a course rule is owner-editable (weekly, ends after a count) -- grep: courseEditable
- a testid for the class-count field of a course -- grep: p3-repeat-course-count

## Files
docs/arcs/organiser.md
src/modules/organiser/p3/model/repeat.ts
src/modules/organiser/p3/screens/RepeatSheet.tsx
src/modules/organiser/p3/model/__tests__/repeat.matrix.test.ts
src/modules/organiser/p3/screens/__tests__/repeat.send.test.tsx
src/modules/organiser/p3/model/__tests__/courseEdit.matrix.test.ts (new)

Update the row in docs/arcs/organiser.md for this slice (Status, Blocked by, PR link) in the same PR (owner decision 2026-11-06); add it if absent.


## Facts
Checked on the main branch 2026-11-10 (no migration expected): admin migration 20270306160000_p3_a2_r1_owner_repeat_rules_v1.sql lets a signed-in non-admin send series.set_recurrence on a course when the rule is not 'custom' and ends after_count (else error course_needs_count), and writes course_total_sessions. "Stop" today = the End row in eventActions (running series), which stays; stop_repeating on a live course stays refused by the server (COURSE_STOP_REASON), so "stop early" for a course = lower the class count or End it. STEP 1 before any code: confirm on a prod-shaped course that an organiser (non-admin) set_recurrence dry_run succeeds. If the server refuses, STOP and write the refusal in the handover: the slice then needs an admin migration (careful lane, owner permission aspect) and this brief is replaced.

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end. Scope: course create, course schedule display (schedule.ts, RepeatSheet), End row (eventSteps.ts), admin course_total_sessions edit.
1. In repeat.ts add `courseEditable(format, rule)`: true for a live, paused or draft course whose rule is weekly with end.kind after_count; repeatAccess returns mode 'edit' for it. A course with a custom rule or no count stays 'disabled'/'readonly' with the existing REPEAT_WHY.course or REPEAT_WHY.custom words.
2. RepeatSheet: for an editable course the editor forces end = after_count (no "never ends", no until date), labels the count "Number of classes" (testid `p3-repeat-course-count`), keeps the dry-run preview, and the saved copy says how many classes remain. Lowering the count below classes already held is refused with a plain line, never sent.
3. Wording: REPEAT_WHY.course no longer says the pattern cannot change for an editable course; a non-editable course says exactly why and what to do (full weekday names, British English, no control named that is not on screen).
4. Stopping: the End row stays as is for courses; add a table row proving a live course shows End enabled and Stop repeating disabled with COURSE_STOP_REASON.

## Tests
Table-driven, red first (run against unfixed code): format (course, recurring, one_off, festival) x lifecycle (draft, live, paused, ended, archived) x rule (weekly after_count, weekly never, weekly until_date, custom, null) x classes held (0, some, all) -> access mode, field set, copy, payload sent (none when untouched). Prod shapes from the survey: 17 courses, 9 with a rule, 8 without; include "course without a rule" (no editor, says what the person can do).

## Done when
- Shape survey repeated read-only on prod (counts only), consistency matrix green, all CI job steps run, PR checks green, walked at 390x844 on a course with a rule and one without.
- INVENTORY.md coverage count reported.
- Hand-off carries a Verified / Not verified block (including the dry_run check from step 1).
- Money: none. Permissions: client-only change; no GRANT, RLS or ACL change. If step 1 fails, escalate to a careful-lane admin migration (permission aspect, owner approval stays excluded from standing approval).
