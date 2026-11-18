# Review: Website PR 1770 (generated Supabase types, read-only review)
Review branch claude/onb-c-types (PR 1770) against origin/main. Do NOT change code. Write your verdict to `docs/review/pr-1770-onb-c-types.md` with headings `## Verdict:` (PASS / PASS WITH NITS / FAIL) and `## Hard-tier:` (PASS or n/a).
Scope: one generated file, src/integrations/supabase/types.ts, regenerated after admin migration 20261118003850 (table buyer_onboarding_reminders and its two functions).
Check:
1. The diff is additive: only the new table and the two new functions; no existing type changed or removed.
2. Nothing in the diff exposes a column or function that should not be in the public types, and no secret or personal data appears.
3. Shapes match the admin migration (git show origin/main of bachata-admin supabase/migrations/20261118003850_buyer_onboarding_reminder_v1.sql): column names, nullability, function args and returns.
4. CI `types-drift` passed at the PR head.
ONE round. Report findings with file:line.
