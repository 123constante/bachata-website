---
applyTo: "supabase/migrations/**"
description: "SQL migration constraints for UUID-safe, minimal, non-destructive schema and RLS changes."
---

# SQL Migration Rules

- Never cast `auth.uid()` to `text`; keep UUID semantics throughout policies and queries.
- Treat `organiser_ids`, `teacher_ids`, and `dj_ids` as `uuid[]`.
- Keep RLS policies aligned with UUID column types.
- Do not introduce text-based foreign keys for UUID columns.
- Keep migrations incremental and minimal; avoid unrelated refactors.
- Avoid destructive schema changes unless explicitly requested.
