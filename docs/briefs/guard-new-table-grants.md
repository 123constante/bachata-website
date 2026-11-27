# GUARD-CI: every migration that creates a public table must grant or revoke explicitly

Repo: 123constante/bachata-admin. Branch: claude/guard-table-grants. Lane: careful (scripts/** guard, hard tier: owner Approve at head). Model: Opus. Context cap 30%.

## Why (owner forwarded the Supabase email 2026-10-31)
Since 2026-10-30 Supabase no longer auto-grants Data API access on NEW tables in `public` (anon, authenticated, service_role). A table created without an explicit GRANT or REVOKE fails with "permission denied" only at runtime, including edge functions that use service_role (Stripe ticketing webhook, raffle tables). Existing tables are unaffected. Memory note: supabase_no_auto_grants_new_public_tables.

## Do
1. Write scripts/check-table-grants.mjs, run from the existing contract/guard workflow (read .github/workflows and `scripts/check-script-conventions.mjs` rules FIRST; follow all six; never pin a count in prose).
2. Rule: for every migration file NEWER than a cut-off (the first one dated after 2026-10-30; existing files are grandfathered by a committed allowlist, never by silent skip), each `CREATE TABLE [IF NOT EXISTS] public.<t>` must have, in the SAME file, an explicit `GRANT ... ON [TABLE] public.<t> ... TO <role>` or `REVOKE ... ON ... public.<t>` statement naming that table (a schema-wide GRANT ... ON ALL TABLES does not count). Also fail if the table is used by an edge function with service_role but has no service_role grant, only if you can detect that cheaply; otherwise list it as not covered.
3. Parse with a real statement splitter, not a line regex: quoted identifiers, `public."T"`, comments, DO blocks and `CREATE TABLE ... (LIKE ...)` must not fool it. Compare WHOLE table names after canonicalising both sides.
4. Canary + mutation: a self-test with fixtures (good, missing grant, grant for a different table, grant only in a comment, quoted name) and prove each bad one fails. Mutate your own rule away and show the check goes red.
5. Run it over all 873 existing migrations read-only: report how many create tables, how many are grandfathered, 0 false positives on the two known REVOKE-only archive migrations (20261109930000, 20261109940000).
6. One commit, push once, PR via bot. PR body bullets exactly: Verified on real data (Shapes surveyed / Checks run / NOT verified with text after the colon). Handover docs/handovers/guard-table-grants.md.

Stopping rule: one independent review, one fix round.
