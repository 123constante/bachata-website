# Handover: organiser course schedule edit (brief/organiser-course-schedule-edit, ac9f468c)

Status: **STOPPED at brief step 1.** The server refuses the change for a non-admin, so no Website code was written. Per the brief, this slice now needs an admin migration (careful lane, permission aspect, owner approval is excluded from standing approval). Once that migration exists, the brief is replaced.

## Step 1: can an organiser (non-admin) dry-run series.set_recurrence on a course?

**No.** I read the prod function source read-only on 2026-11-10 (project stsdtacfauprzrdebmzg, latest applied migration 20270320210000).

`public.apply_aggregate_write_p5(p_envelope jsonb)`:

```sql
v_privileged := public.is_admin() OR COALESCE(auth.role() = 'service_role', false);
...
IF NOT v_privileged AND v_kind = 'series.set_recurrence' THEN
    IF v_series_format IS DISTINCT FROM 'recurring' THEN
        RAISE EXCEPTION 'permission_denied: series.set_recurrence needs a recurring series' USING ERRCODE = 'P0001';
    END IF;
    IF v_series_lifecycle = 'ended' THEN ... 'on an ended series is admin-only'
    ...
END IF;
```

This gate is keyed only on the command kind, so it also catches a `dry_run: true` payload. The dry-run handling sits further down, after the handler runs. An organiser sending set_recurrence on any `format = 'course'` series therefore gets `permission_denied: series.set_recurrence needs a recurring series`, whatever the rule looks like.

The brief's Fact ("20270306160000 lets a signed-in non-admin send series.set_recurrence on a course when the rule is not custom and ends after_count") describes only the **handler** `_cmd_series_set_recurrence_p5(uuid, jsonb, uuid)`. That handler does have the course arm: it raises `invalid_transition: course_needs_count` unless the rule ends after_count, and it writes `course_total_sessions = end.count`. But the dispatcher's pre-gate above stops a non-admin before the handler is reached.

I did not run a live dry run. The Supabase connector is SELECT-only for workers, and impersonating an organiser JWT is outside that. The refusal comes from reading the prod source, not from a call.

## What the admin migration needs (for the replacement brief)

- In `apply_aggregate_write_p5`'s non-privileged set_recurrence gate, also admit `v_series_format = 'course'` when the rule is not custom and `end.kind = 'after_count'` (the handler already enforces course_needs_count). Keep the ended-series refusal.
- Decide whether an owner may lower `end.count` below the classes already held. The client was going to refuse that itself; the server should refuse it too.
- Check `_owner_rule_problem_p5` against a course rule (weekly, 1 weekday, interval 1, after_count). I did not read its arms in full.
- A dry run on a prod-shaped live course with some classes held, as a test in the admin repo.

## Shape survey (prod, read-only, counts only, 2026-11-10)

`event_series_p5 where format = 'course'`: **18** series (the brief says 17; one more since). **10** have a rule and **8** do not.

| lifecycle | rule | end | classes held | n |
|---|---|---|---|---|
| live | weekly, 1 weekday, interval 1 | after_count | all | 5 |
| live | weekly, 1 weekday, interval 1 | after_count | some | 2 |
| live | weekly, 1 weekday, interval 1 | after_count | none | 1 |
| draft | weekly, 1 weekday, no interval key | **none** | some | 1 |
| archived | weekly, 1 weekday, interval 1 | after_count | all | 1 |
| ended | none | -- | all | 8 |

All 18 have `course_total_sessions` set. "Held" means non-cancelled dates before today.

Two shapes the replacement brief should cover:
- The draft course stores `end.kind = none`. That rule is invalid for a course under course_needs_count, so the editor must force after_count with a count prefilled from course_total_sessions.
- 5 live courses have every class already held. Their editor would only be able to add classes.

## Done / left

- Done: the step-1 check (static, from prod source), the shape survey, this handover, and the BLOCKED row in docs/arcs/organiser.md.
- Left (all waits on the admin migration): INVENTORY.md (brief step 0), `courseEditable` in repeat.ts, the RepeatSheet course editor (`p3-repeat-course-count`), the REPEAT_WHY.course wording, the End / Stop repeating table row, and the courseEdit matrix.
- Next step: the owner or lead opens a careful-lane admin brief for the gate change above. Then this Website brief is re-issued.

## Verified / Not verified

- Verified: the prod source of apply_aggregate_write_p5 refuses a non-admin set_recurrence on a non-recurring series, dry run included; the course shape counts above.
- Not verified: a live dry-run call as an organiser (SELECT-only connector); INVENTORY.md coverage (not built: 0 / not counted); tsc, unit tests, e2e, the 390x844 walk (no code changed; docs only); `_owner_rule_problem_p5` arms in full.
