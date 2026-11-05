# Handover: fix-dj-ratchet-r1 (2026-11-03)

Branch `claude/fix-dj-ratchet-r1`. Ticket dt_03fa57d124e8. Hard tier (scripts/**): the owner's Approve is needed at head.

## Verdict: case (a), a genuine new DJ listed before their first booking. Not a regression.

Website `contract-check` on main (run 41666265616) failed at
`scripts/check-teacher-dj-assignment-integrity.mjs`: `33 teacher / 9 DJ unassigned (baseline: 33/8)`.
The step had been hidden behind the guest-entries red until admin #1191 cleared it.

### Evidence (prod `stsdtacfauprzrdebmzg`, read-only SELECT, ids and dates only)

- The live RPC body credits a DJ when there is any `event_series_program_people_p5` or
  `event_occurrence_added_session_people_p5` row with `profile_type='dj' OR role='djing'`.
  Today it reads **teachers 94 assigned / 33 unassigned, DJs 33 assigned / 9 unassigned**.
- The 9 unassigned active DJs, by `djing` role creation date:
  2026-04-20, 2026-05-08, 2026-08-14, 2026-08-17, 2026-09-14, 2026-09-14, 2026-09-16, 2026-10-30,
  and **2026-11-03 13:55 UTC (`bebc8933-156b-4b3d-9253-6eaf41168617`)**.
- `bebc8933` is an existing **teacher**: profile created 2026-09-26. Its only line-up credit is
  one series row, `profile_type=teacher, role=teaching`, from 2026-10-16. Its `djing` role was
  created 2026-11-03 13:55 UTC, under two hours before the red run (15:41 UTC), and it has never
  had a DJ credit. So it could not have lost one. This is the documented "listed before first
  booking" pattern (see the 2026-07-24, 2026-09-15 and 2026-10-24 notes in the script header).
- The other eight are the earlier unassigned set. Every role among them predates today. None
  has a dj/djing credit row.

### Why `sample_profiles` is `[]`

The RPC returns samples only when `public.is_admin()` is true (admin migration 20261122240000,
review R1 B1: no names to anon). CI calls it with the publishable (anon) key, so CI always gets
`[]`. Fixing this would need an admin-repo migration and would reverse a deliberate privacy
decision, so it is not trivial. **I left it alone.** A dated comment in the script now explains
the empty field.

## Change

One file: `scripts/check-teacher-dj-assignment-integrity.mjs`. `BASELINE_DJS_UNASSIGNED` goes
8 -> 9 with a dated comment that names the pattern, and the header's "currently 33/8" becomes
"currently 33/9". The teacher ceiling stays at 33.

## Verified

- Live prod run, using prod's publishable anon key from the Supabase connector (the local
  `.env` points at a non-prod project, which reads 4/4):
  - new ceiling 9 -> `WARN: 33 teacher / 9 DJ unassigned (baseline: 33/9)`, exit 0;
  - `origin/main` script (ceiling 8) -> `FAIL ... (baseline: 33/8)`, exit 1. This reproduces CI.
- Mutant at 10: a local stub PostgREST returning DJs=10 -> `FAIL: 33 teacher / 10 DJ unassigned (baseline: 33/9)`, exit 1.
  The same stub at DJs=9 -> exit 0.
- `node scripts/check-script-conventions.mjs` passes. `eslint` on the file is clean. `node --check` is OK.
- `npm run lint`: "lint PASSED -- 24 of 24 links green" (exit 0; whole-tree eslint informational as on main).

## Not verified

- There is no snapshot of the earlier set of 8, so I cannot prove from history that no other DJ
  gained one credit while another lost one. Today's 8 non-new rows all have no DJ credit at all,
  and the newest pre-existing role dates from 2026-10-30.
- The script has no self-test (there is no `--self-test` mode or unit test for it). The stub
  mutant run above stands in for one.
- CI per job: not observable from this worker (no gh/api). The owner should read the PR checks.
  The `contract-check` job should go green on this step.
- PR: opened via the GitHub connector (see below in the PR list), not merged, not approved.
