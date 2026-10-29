# Handover: ticket promo codes, Website half — BLOCKED (nothing built)

Ticket dt_89e16e1801fc. Brief: `brief/ticket-promo-codes-web:docs/briefs/ticket-promo-codes-web.md`.

## Why nothing was built
The brief says admin PR #1125 (DB + edge) is applied before this runs. On 2026-10-29 it was not.
Read-only check on prod `stsdtacfauprzrdebmzg`:

- `pg_proc` has no `ticket_promo_preview_v1`, `ticket_promo_create_v1`,
  `ticket_promo_update_v1` or `ticket_promo_list_v1` in any schema.
- `supabase_migrations.schema_migrations` has no ticket-promo migration. The only
  `promo` objects are the older event-listing promo codes (`promo_codes`,
  `get_public_promo_codes`, `admin_*_promo_code*`), which are a different feature.
- The admin handover (`bachata-admin-11april` branch `claude/ticket-promo-codes-db`)
  could not be read: this session has no access to the admin repo. That handover holds
  the buyer copy table and the exact RPC return shapes, and the brief needs both.

If I had built against guessed signatures and copy, it would break the real-data
definition of done (CLAUDE.md), and nothing could be checked against the live DB.

## Done
- Checked the precondition (counts and catalogue only, no writes).
- Left this handover. No source changes. Flags untouched.

## Left (all of the brief)
Organiser Promo codes section, the buyer promo field plus preview and checkout
`promo_code`, `?code=` pre-fill, the state table and tests, the design record, and the
390x844 and 320x568 walks.

## Next steps
1. Owner/orchestrator: apply admin #1125 migrations (`supabase db push` from admin) and
   redeploy `ticket-checkout`.
2. Re-dispatch with the admin handover text pasted into the brief (copy table + RPC
   return JSON shapes), or give the worker read access to the admin repo.
3. Re-check: `select proname from pg_proc where proname like 'ticket_promo%'` returns 4 rows.

## Verified
- The four RPCs are absent on prod (pg_proc query, 2026-10-29).

## Not verified
- Whether `ticket-checkout` on prod already accepts `promo_code` (not probed: nothing
  depends on it until the RPCs exist).
- Anything in the UI: nothing was built.
