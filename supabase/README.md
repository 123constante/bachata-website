# Supabase — Website repo

This repo does NOT own database migrations.

**Migration authority lives in the admin repo:**
`bachata-admin-11april/supabase/migrations/`

To add a migration:
1. Write SQL in the admin repo.
2. Run `supabase db push` from there (CLI-only, per admin's CLAUDE.md mandate).
3. If the change affects a contract this site relies on, add a check script
   to `scripts/check-*.mjs` and reference it in
   `.github/workflows/db-contract-check.yml`.

This repo validates the live database via 19 contract-check scripts run by
the `DB Contract Check` workflow on every push, PR, and daily at 06:00 UTC.
That workflow is the canary; if the admin repo's schema drifts away from
what this site expects, this workflow fails.

See also: `CLAUDE.md` § "Migration authority (mandatory)".
