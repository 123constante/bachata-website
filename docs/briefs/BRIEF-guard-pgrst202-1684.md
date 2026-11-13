# Brief: Website guards tell a stale schema cache from a missing function (admin issue #1684)

Repo: 123constante/bachata-website. Branch: claude/guard-pgrst202-1684. Lane: normal. Brief-version: 2

Problem: Website CI guards that call prod RPCs (the db-contract-check scripts under `scripts/check-*.mjs`) fail with PostgREST error PGRST202 ("could not find the function ... in the schema cache"). That error is the same whether the function really does not exist or PostgREST's schema cache is just stale after an admin migration apply. People then chase the wrong cause.

Do:
1. `grep -ln PGRST202 scripts/*.mjs scripts/lib/*.mjs` and find the shared place guards report RPC-not-found. Add ONE shared helper in `scripts/lib/` (reuse an existing lib if one already wraps the RPC call).
2. On PGRST202 the helper checks whether the function exists in pg_proc (read-only; use the same read-only method the guards already use for prod reads, e.g. a SELECT through an existing read RPC or the Supabase REST introspection those scripts use; if no read path exists, report that under Not verified and fall back to the message below without the pg_proc check).
   - Function IS in pg_proc: message "schema cache stale (function exists, PostgREST has not reloaded): retrying once", wait 5 s, retry the call once; if it still fails, red with "STALE SCHEMA CACHE: run NOTIFY pgrst, 'reload schema' (admin apply step)".
   - Function NOT in pg_proc: red with "FUNCTION MISSING in prod: the migration is not applied".
3. Table-driven test (vitest, `tests/`): rows = {PGRST202 + in pg_proc, PGRST202 + not in pg_proc, other error code, success}; assert message, retry count (at most 1) and exit status. Red first.
4. Wire the helper into the guards that today print a bare PGRST202. Add any new script to the check-script-conventions TARGETS list if the checker asks (read its six rules first).

Not in scope: admin repo changes (the NOTIFY reload step is admin #1683, already built), any migration (none allowed in this repo), UI.

Done: push ONCE, no run-ci, PR body with the Verified on real data and (no UI path, so delete the Phone QA section) sections.
