---
applyTo: "src/integrations/**,src/**/*supabase*.ts,src/**/*supabase*.tsx"
description: "Supabase and data-access rules for integrations and Supabase client usage."
---

# Data Access Scope Rules

- Never cast `auth.uid()` to `text` in SQL/RPC-related changes; keep UUID semantics end-to-end.
- Treat `organiser_ids`, `teacher_ids`, and `dj_ids` as `uuid[]` (not text arrays) in queries, filters, and payloads.
- Prefer typed helpers/hooks for data access (existing wrappers in `src/integrations/*`, query hooks in `src/hooks/*`) over ad-hoc inline calls.
- Keep Supabase query/mutation changes narrow and type-safe; avoid mixing unrelated data-shape refactors into the same edit.
