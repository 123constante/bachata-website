# Handover: teacher-dj-ceiling-warn-1

Branch `claude/teacher-dj-ceiling-warn-1`, ticket dt_6c18a737c6d1, brief
`docs/briefs/teacher-dj-ceiling-warn-1.md` (branch `brief/teacher-dj-ceiling-warn-1`).

## Done
- `scripts/check-teacher-dj-assignment-integrity.mjs` no longer gates on the
  unassigned TOTAL (34/10 ceiling). It gates on the **assignment deficit**:
  `active roles created on/before 2026-07-24 (cutoff 2026-07-25T00:00Z) - assigned`,
  per teacher / DJ. Baselines 10 / -4 (measured live). Growth from people created
  after the cutoff prints the payload + a `WARN:` line and exits 0; a lost line-up
  credit raises the deficit and exits 1. Exit 2 for every could-not-check path.
- Why not the literal "pre-baseline unassigned" count: CI is anon. Anon can read
  `person_roles` (incl. `created_at`, policy `person_roles_public_select`) but not the
  P5 credit tables (`is_admin()` only), and the RPC returns no per-person data to anon.
  The deficit equals `pre-baseline unassigned - post-baseline assigned` and moves 1:1
  with the former. No migration needed (this repo owns none).
- `main(argv, deps)` seam + `--self-test` (14 cases incl. the two brief mutants).
  R4 allowlist entry removed (`check-script-conventions --write`); file added to
  `prove-entry-point-dispatch.mjs` TARGETS (it now uses `isEntryPoint`).
- `scripts/__tests__/check-teacher-dj-assignment-integrity.test.mjs` (node:test, 9 tests).
- `docs/ci-guard-notes.md` #17 rewritten; `db-contract-check.yml` step comment updated and
  the step now runs `--self-test` before the live check (node:test files in
  `scripts/__tests__/` are not run by any workflow, so the self-test is the CI canary).

## Verified
- Live prod read, read-only (Supabase MCP SELECT + the script itself with the anon
  key): teachers 128 active roles = 104 pre-cutoff (76 assigned + 28 unassigned) + 24
  post (18 + 6); DJs 43 = 29 pre (27 + 2) + 14 post (6 + 8). RPC: 94/34 teachers,
  33/10 DJs. Script on prod: exit 0, WARN, deficits 10/-4 at baseline.
- Anon count via PostgREST `head:true, count:'exact'` works on prod (no 100-row cap).
- `--self-test` green; node:test 9/9; `check-script-conventions` green; `prove:entry-point` green.

## Not verified
- The session's own `VITE_SUPABASE_URL` points at a non-prod project with tiny data;
  there the script exits 1 (baselines are prod-specific, same as the old ceiling). CI
  secrets point at prod (prior runs read 34/10), so CI should be green -- confirm on
  the PR's db-contract-check run.
- Masking gap: a lost assignment and a first booking in the same window cancel out.
  Deactivating an ASSIGNED post-cutoff role reds (false positive; re-baseline with a note).

## Next steps
- Owner Approve at the head (hard-tier `scripts/` path).
- An exact pre-baseline split would need an admin-repo RPC change (return per-cutoff
  counts); not done -- this repo owns no migrations.
