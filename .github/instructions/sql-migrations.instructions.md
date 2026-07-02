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
- Time-pairing contract (admin CLAUDE.md, mandatory): `calendar_occurrences.instance_start/_end`
  are LONDON wall-clock stored as-if-UTC — compare via `x AT TIME ZONE 'UTC' >=
  (now() AT TIME ZONE 'Europe/London')`, never bare `CURRENT_DATE`/`now()`.
  True-UTC columns (`materialised_*_utc`) compared to calendar dates must project into the
  series timezone first: `(x AT TIME ZONE COALESCE(es.timezone, 'UTC'))::date`.
  Guards: admin `check:rpc-tz-pairing` scan + `check_public_time_pairing_contract_v1()` in
  db-contract-check.yml.
