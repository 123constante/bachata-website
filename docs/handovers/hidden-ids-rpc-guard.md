# Handover: organiser_directory_hidden_ids_v1 contract guard (Website)

Brief: `brief/hidden-ids-rpc-guard:docs/briefs/hidden-ids-rpc-guard.md`.
Branch `claude/hidden-ids-rpc-guard`, PR #1069. Class: GUARD-CI (one review round).

## Done

- `scripts/check-organiser-hidden-ids-contract.mjs` -- calls
  `organiser_directory_hidden_ids_v1()` as ANON and gates (exit 1) on: the RPC
  missing (PGRST202 / a 42883 naming it), anon EXECUTE revoked (42501), a NULL
  payload, a non-array payload, any non-uuid element, any duplicate (case-folded).
  Empty array is GREEN and says it compared nothing. 57014 / network blips retry
  once and are exit 2 if they persist. Prints counts only, never ids.
- Pure `check(payload)` core; `main(argv, deps)` owns the exit code (R5) and is
  driven by the canary through every branch; `isEntryPoint` (R6), listed in
  `scripts/prove-entry-point-dispatch.mjs` TARGETS. 42 canary cases.
- `npm run check:organiser-hidden-ids` / `check:organiser-hidden-ids:self-test`.
- `docs/ci-guard-notes.md` entry (#71, marked NOT YET A WORKFLOW STEP).
- `check-script-conventions.mjs`: green with no allowlist entry (nothing owed).

## Left -- the ONE workflow edit (orchestrator applies; agents cannot edit `.github/workflows`)

File `.github/workflows/db-contract-check.yml`. Insert AFTER the existing step
`- name: Run going RPC contract check (Going P2)` (its last line is
`          node scripts/check-going-rpcs.mjs`) and BEFORE the
`# ── Failure notification ──` comment block, separated by one blank line:

```yaml
      # 71. ORGANISER DIRECTORY HIDDEN IDS (2026-10-27). organiser_directory_hidden_ids_v1()
      #     (admin migration 20270304210000; anon EXECUTE; uuid[], never NULL)
      #     is the one source of directory rule D3. /organisers, the sitemap and
      #     the homepage head count call it through
      #     src/lib/organiserDirectoryHiddenIds.ts and THROW on an RPC error, so
      #     a rename or a revoked grant errors /organisers and 500s the sitemap.
      #     Gates on: RPC missing, anon EXECUTE revoked, NULL or non-array
      #     payload, a non-uuid element, a duplicate. Empty is green (0 hidden
      #     is the normal state). Counts only, never ids. Canary first.
      - name: Run organiser hidden-ids contract check
        if: always()
        timeout-minutes: 2
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
        run: |
          node scripts/check-organiser-hidden-ids-contract.mjs --self-test
          node scripts/check-organiser-hidden-ids-contract.mjs
```

After it lands, remove "NOT YET A WORKFLOW STEP" from the `docs/ci-guard-notes.md`
entry. Count steps with
`grep -c '^      - name: Run ' .github/workflows/db-contract-check.yml` (never pin it).

## Verification evidence

- Prod (stsdtacfauprzrdebmzg) as anon, 2026-10-27:
  `organiser hidden-ids contract: ok (0 hidden id(s), all uuid strings, 0 duplicates).` exit 0.
  Read-only SQL cross-check: returns `uuid[]`, anon may execute, 0 elements, not NULL.
- The cloud session's default `VITE_SUPABASE_URL` points at a DIFFERENT project
  (`srrpvux...`) where the RPC does not exist; the check correctly exit 1 there
  (PGRST202). If CI's secret points at that project too, the new step goes red
  -- confirm the secret is prod before applying.
- Mutation run: 14 mutants (broken always-green core, each assertion reverted,
  the uuid regex loosened, case-folding dropped, empty made red, missing/revoke
  arms dropped, retry dropped, missing creds made green, verdict ignored, ids
  leaked into output) -- all killed, each with >= 1 FAIL line. One mutant
  (non-array arm reverted) first survived with ZERO fail lines (the canary
  crashed on the throw); fixed by recording a throw in the exit-code drive as a
  failure.

## Review (one round, CI-guard rule; reviewer: a different model)

No material defect. Applied: (1) our own 20s abort (`AbortError`) is now
transient and retried once; (2) a 42501 raised INSIDE the body is no longer
reported as a revoked grant (still exit 1). Not applied: `.env` single quotes
(same as every sibling, local-only). The two fixes are UNREVIEWED code; the
mutation run was re-run after them (all killed) and the canary grew to 42 cases.

## Next steps

1. Orchestrator: apply the YAML above; run the workflow once (manual dispatch).
2. D3 slice: its new callers are covered by this same check (same RPC).
