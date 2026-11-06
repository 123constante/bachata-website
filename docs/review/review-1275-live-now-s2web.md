# Review: Website PR #1275 (live-now slice 2: snapshot `version` + contract check)

Reviewed head: `claude/live-now-s2web` @ `e7f4fb921979972f139a1e5f1fb309fbdd6b44cc`, diffed against
`origin/main` @ `5c34c21`. Brief: `brief/review-1275-live-now-s2web` (sha be74d164). This was a read-only review.
No code was changed and prod was read only through STABLE functions via SELECT.

## Verdict: SAFE TO MERGE

0 high, 0 medium, 2 low (1 PROVEN, 1 SUSPECTED), 2 info.

## Findings, ranked

### L1 (low, PROVEN): the canary does not pin the `snapshot_compat` shape argument
- `scripts/check-event-snapshot-version.mjs:122`: `main()` probes with `p_viewer: { role: 'anon', shape: 'snapshot_compat' }`.
  But the self-test fake (`:158-163`) ignores `args.p_viewer`.
- Mutant M3 changes the shape to `'native'`, and M3b drops the `shape` key. Both pass the self-test with 23/23 (run below).
- Why it stays low: on prod, the native shape RAISES `P0001 not_found: series ...` for a series that the compat shape
  returns (probed with SELECT, as `0000e780-...` compat `version` is `number`). So the live run with M3 would exit 2,
  "CANNOT RUN (rpc)". That is red, not silently green. The weakness is limited to the canary.
- Minimum fix: in `fake()`, have the `event_view_p5` branch return
  `{ data: null, error: { code: 'X', message: 'wrong shape' } }` unless `args?.p_viewer?.shape === 'snapshot_compat'`.
  Or add one case asserting that the shape is passed.

### L2 (low, SUSPECTED): which project the CI secret points at decides green vs red
- The step (`.github/workflows/db-contract-check.yml`, the new step 74) uses `secrets.VITE_SUPABASE_URL` and
  `secrets.VITE_SUPABASE_PUBLISHABLE_KEY`. These are existing secrets that the same file already uses in 54 places.
- In this sandbox, `VITE_SUPABASE_URL` is the E2E fixtures project `srrpvuxldthwumzrngla` (not prod; see
  `docs/handover/w1-finish.md:805`). Against it the check returns
  `{"events_in_window":20,"sampled":12,"payloads_probed":24,"violations":24}` and exits **1**, with no top-level
  `version` key on any payload. That project lacks admin #1280.
- Against prod `stsdtacfauprzrdebmzg` (the same sample, done as a SELECT): landing 12/12 and pinned 12/12 are non-null,
  12/12 have the key, and 12/12 are a JSON `number`. The range is 1788522059596757..1793850300314059, all below 2^53.
  The check would be green on prod.
- I cannot see the CI secret values. If CI points at prod, as the sibling live checks imply, the step is green. If it
  ever points at the E2E project, the step goes red with exit 1 ("contract violated"), not exit 2.
- Minimum fix: none needed if the PR's own `db-contract-check` run is green. Confirm that run before merging. Optional:
  print the project ref (host only, not the key) in the summary JSON, so a red run says which DB it measured.

### I1 (info, PROVEN): mutant M1 is caught by message text, not by exit code
Dropping the `typeof v !== 'number'` guard (`:44`) still makes null and string fail. They reach the
`Number.isSafeInteger` branch (`:45`) and exit 1. The self-test catches the mutant only because cases 3 and 4 pin the
message. Exit-code behaviour is equivalent, so there is no gap.

### I2 (info): the version is not rendered anywhere yet
`grep` finds no consumer of `snapshot.version` in `src/modules/event-page` outside the parser (`useEventPageQuery.ts:159`).
Slice 3 is the reader. So for now the change is data-only on the page.

## Answers to the brief's questions

**1. Workflow safety: PASS.**
- The diff touches only one new step (+17 lines). There is no change to `on:`, `permissions:` or `runs-on`. I grepped
  the diff for those keys and found 0 hits.
- The step is `if: always()`, `timeout-minutes: 3`, runs the canary first, and has no `continue-on-error`.
- It uses only the existing publishable/anon secrets and no service-role key.
- Prod access is read-only: both RPCs are `provolatile = 's'` (STABLE) with `anon=X` (checked via `pg_proc`), and the
  script calls only `calendar_events_dto` and `event_view_p5`.
- Conventions:
  - R1: the floor `MIN_PROBED=3` exits 2 (`:139-141`).
  - R2: there is no empty catch. The catch at `:97` converts to a NETWORK error, which exits 2.
  - R3: the exit codes are 0/1/2, and missing creds exit 2 (`:81-83`).
  - R4/R5: `--self-test` drives `main()`.
  - R6: it uses `isEntryPoint` (`:221`).
  - `node scripts/check-script-conventions.mjs` passed ("84 known violation(s) still owed", the same allowlist).

**2. The check: PASS (with L1).**
- `versionProblem` (`:40-47`) fails on: a missing key, null, a string, an object, a fraction, a negative number,
  anything past 2^53, and a payload that is an array or not an object. A number passes, including 0.
- It is fail-closed:
  - a calendar or view RPC error exits 2 (`:107-110`, `:123-126`);
  - a thrown error exits 2;
  - an all-null sample is below the floor, so it exits 2;
  - a non-object payload exits 1.
- A null payload is skipped as "not public" (`:127`). That cannot hide a regression, because of the floor plus the
  24/24 non-null on prod.
- It needs no hard-coded live series id: it samples `calendar_events_dto` over -1/+60 days. Prod currently has 264 rows
  in that window.
- `--self-test` gives "PASS self-test -- 23 cases".

Mutants run against the self-test:

| Mutant | Self-test result |
|---|---|
| M1 drop type check | **caught** (cases 3, 4, by message; see I1) |
| M2 accept null | **caught** (case 3: got 0) |
| M3 skip compat shape (`'native'`, or `shape` dropped) | **SURVIVES** (L1; live it exits 2 on prod) |
| M4 drop the pinned probe | caught (cases 1, 1b, 9, 10b) |
| M5 treat a bad version as non-public | caught (cases 2-5: got 2) |

**3. Parser: PASS.**
- `parseSnapshotVersion` (`useEventPageQuery.ts:46-47`) is a pure ternary and cannot throw. Any malformed value becomes
  `null`.
- `types.ts` adds `version: number | null`. The only constructors are the parser and two test fixtures, which now set
  `version: null`.
- `tests/eventSnapshotVersion.test.ts` covers 12 shapes. It also proves the rest of the snapshot is identical with and
  without `version`, and that the loader's dehydrated `.data` carries the field (or an explicit null).
- Run: `vitest run tests/eventSnapshotVersion.test.ts src/modules/event-page` gave 36 files and 322 tests passed.
- `tsc --noEmit -p tsconfig.app.json` reports 138 errors on the PR head and 138 on main. None are new, and none mention
  `version`.
- Nothing renders the field (I2), so a visitor sees no change.

**4. `prove-entry-point-dispatch.mjs`: PASS, not weakened.**
- The only change is one line, adding `scripts/check-event-snapshot-version.mjs` to `TARGETS` (`:183`). That widens
  the sweep to cover the new entry point, as R6 requires for new scripts.
- `node scripts/prove-entry-point-dispatch.mjs` gave "PASSED -- all 79 entry point(s) proven".

**5. Performance: no impact.**
- There is no new request: `version` is read off the payload `event_view_p5` already returns.
- The dehydrated cache gains one integer per event.
- No new imports in the page path, and no chunk changes (`vite.config.ts` is untouched).

## Verified / Not verified
- **Verified:** I read the diff. I ran the self-test, the script-conventions guard, the entry-point proof, the 5
  mutants, the vitest suite and a tsc comparison with main. I ran the live check against the E2E project (red, as
  expected, since #1280 is not there). On prod I ran a read-only SELECT of the exact sample: 24/24 valid. I also
  checked the volatility and grants of both RPCs.
- **Not verified:** the PR's CI run itself (`gh api` is disallowed, and the CI secret values are not visible to me; see
  L2). I did not run the script itself against prod with the publishable key, because there is no prod anon key in
  this sandbox; the SQL replicates its calls instead. No browser walk was done, because there is no visible UI change.
