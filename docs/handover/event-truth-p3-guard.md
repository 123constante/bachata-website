# Handover: event-truth P3 -- Website guard slice (CI #70 learns date-only sessions, drift gates at 0)

Branch `arc/event-truth-p1p3-guard-b` (from `main` at 5e0ec4c). Brief:
`arc/briefs-event-truth:briefs/event-truth-p3-guard.md`. No PR opened (the
orchestrator merges into `feat/event-truth-p1p3`). Class GUARD-CI. Written
2026-10-13 by the cloud worker; updated before every stop.

## Commits

1. `chore(event-truth): canonical eventCategory lib + test (from a8efae3c, guard slice)`
   -- ONLY `src/lib/eventCategory.ts` + `src/lib/__tests__/eventCategory.test.ts`
   from the published patch. LF sha256 of the lib starts `a8d972e7` (the
   byte pin); on disk it is CRLF like its siblings. The lib was never edited;
   the mutation round restored it and re-checked the pin.
2. `guard(event-truth): CI #70 learns date-only sessions; category_drift gates at 0 (P3)`
   -- everything below.

## What changed (owned files only)

- `scripts/check-event-truth-v1.mjs`
  - `deriveGenres(sectionKinds, itemTypes, addedSessions)`: date-only sessions
    `{kind, type}` go through the SAME `add` mapping, kind then type; null
    says nothing.
  - `assertTruthPayload`: `added_sessions` REQUIRED per series (array; each
    entry exactly the keys `kind` and `type`, each text or null, so a renamed
    column cannot read as "says nothing"); `added_session_count` REQUIRED and
    strict `===` the sum of array lengths. Missing / wrong shape = exit 2.
  - `runCheck`: a series is "no programme" only when BOTH grains are empty;
    the measurement floor is `section_count + added_session_count >= 1` so a
    future of organiser-created (date-only-only) series still measures.
  - `categoryAgrees(null, mappedSet)` is now FALSE (was true in P0). See the
    decision below.
  - Fixture projection `truthPayload(spec)` derives `added_sessions` from
    `spec.occurrences` + `spec.addedSessions` (sessions reach a series
    through its occurrence, as the RPC joins); `cleanSpec` unchanged.
  - Header docblock, check list and GENRE MAPPING updated for P3.
- `event-truth-baseline.json`: `category_drift` is `{}`; `course_without_length`
  unchanged (2 ids, #780 does not repair it); `recorded_on` 2026-10-13;
  comment says drift gates at 0 and why an id must never be added.
- `scripts/fixtures/event-truth-parity.json` (NEW): 27 cases, shape per the
  brief; `expect.set` in the lib's stable order party, class, masterclass.
- `src/lib/__tests__/eventCategory.parity.test.ts` (NEW): runs every case
  through `deriveCategories(format, [...sectionKinds, ...added kinds],
  [...itemTypes, ...added types])` + `categoryAgrees`; also asserts >= 15
  well-formed cases.
- `docs/event-truth-table.md`: header, genre row (three sources, one mapping,
  parity pin, gated at 0), ratchet section (+ "gates at 0 since #780", + the
  payload since #780).
- `.github/workflows/db-contract-check.yml`: step #70 comment lines only.

## Decision taken that the brief did not spell out (owner may revert in one line)

**A NULL stored category under mapped sessions is now drift.** P0 read NULL as
"declares nothing, cannot disagree". Since P1/P3 the mirror is DERIVED and
#780 repairs it, so a NULL under sessions is a mirror that was not written;
the canonical `src/lib/eventCategory.ts` `categoryAgrees(null, set)` is false,
and the parity corpus could not hold a stored-null case otherwise. Prod today
(read-only, counts only): 0 live series with a NULL category, so nothing reds
on this today. To revert: re-add
`if (category === null || category === undefined) return true;` at the top of
`categoryAgrees`, flip the canary case "a NULL mirror under mapped sessions
agrees with NOTHING", drop the "a NULL mirror under a date-only class session
is NEW drift" case, and remove the two stored-null parity cases whose
`agrees` is false with a non-empty set (mutant M8 below shows exactly which
cases fire).

## Canary count: before / after

- Before (main, P0): 96/96.
- Infra + new cases added FIRST, rules still unfixed: **119/150 -- 31 FAIL**
  (every new behavioural case failed: date-only derive x4, null agrees,
  date-only drift / not-set / not-"no programme" x4, measured floor, payload
  keys x11, parity x10). The cases that could not fail on the unfixed code
  are the agreeing directions ("stored class is no drift", "date-only party
  by type stored party is no drift"), each paired with a failing direction.
- After the rule hunks: **150/150**.
- vitest: `eventCategory.test.ts` 49 passed / 1 skipped (the admin-twin case
  skips without the sibling checkout); `eventCategory.parity.test.ts` 28
  passed.

## Mutants (all killed; each applied to a copy, run, restored byte-identical)

| # | mutant (guard side) | canary FAILs | vitest parity |
|---|---|---|---|
| M1 | ignore date-only `kind` | 5 | 28 green |
| M2 | ignore date-only `type` | 5 | 28 green |
| M3 | tolerate a missing `added_sessions` (`?? []`) | 2 | 28 green |
| M4 | drop the `added_session_count` comparison | 3 | 28 green |
| M5 | loose `!=` on the count | 1 (string count) | 28 green |
| M6 | "no programme" ignores date-only (P0 condition) | 4 | 28 green |
| M7 | `social` no longer a party (guard mapping only) | 4 incl. 2 parity | 28 green |
| M8 | NULL mirror agrees again (P0 semantics) | 5 incl. 2 parity | 28 green |
| M9 | measurement floor ignores date-only | 1 | 28 green |
| M10 | extra keys tolerated on an added session | 1 | 28 green |
| L1 | **lib side**: delete `case 'social':` in `src/lib/eventCategory.ts` | guard 150/150 green | **2 failed** / 26 |

M7 vs L1 is the brief's asymmetry proof: one side's mapping edited reds that
side alone. After L1 the lib was restored from a pristine copy, `cmp` clean,
LF sha256 again `a8d972e7`.

## Checks run (all local)

| check | result |
|---|---|
| `node scripts/check-event-truth-v1.mjs --self-test` | 150/150, exit 0 |
| `node scripts/check-script-conventions.mjs` | pass (86 allowlisted, unchanged) |
| `node scripts/prove-entry-point-dispatch.mjs --self-test` / sweep | 54/54; 41 entry points proven |
| `npx vitest run src/lib/__tests__/eventCategory` | 2 files, 77 passed, 1 skipped |
| `npm run lint` (16-link chain) | 15 pass; `check:integrity` exit 126 = `bin/check-integrity.sh` lacks the exec bit in this checkout (git mode 100644; CI runs `chmod +x bin/*.sh` first). Run as CI does, `bash bin/check-integrity.sh`: **ok, 1433 files, 0 issues**. eslint link was skipped by the chain for that reason; `npx eslint` on the two touched code files: clean |
| integrity job steps (architecture-guard.yml) | integrity guard ok; legacy-tables, legacy-program-rpcs, lint:architecture, `AUDIT_STRICT=1 check:images` (0 missing), image-widths canary+guard, plan-hygiene canary, workflow-artifact-policy canary+guard, mojibake canary+guard, prove:entry-point canary+sweep: all pass |
| `npm run typecheck` (full `tsc -p tsconfig.app.json`) | exit 2 with 91 TS errors, NONE in a file this branch touches; the IDENTICAL 91 reproduce on a worktree of `origin/main` (same error set, diffed). Pre-existing and not a CI gate: `typecheck.yml` runs only `check:rpc-typing` + `check:wallclock-brand` (both pass here) and main is green on it |
| `npm run test:unit` (full suite) | not run (brief lists `test:unit -- eventCategory`; the two known-flaky specs are outside this slice) |

## Live run (Not verified, as the brief predicts)

- `node scripts/check-event-truth-v1.mjs` against PROD (`stsdtacfauprzrdebmzg`,
  anon key): **exit 2** -- `series entry ... is missing id, section_kinds,
  items or added_sessions (added_sessions is REQUIRED since P3 / admin #780 ...)`.
  That is the designed fail-closed on the P0 RPC; read-only SELECT confirms
  prod's `check_event_truth_v1()` top keys are still
  `check, computed_at, item_count, measured_as, section_count, series,
  series_count` and a series entry has no `added_sessions`.
- The session's own `VITE_SUPABASE_URL` points at project
  `srrpvuxldthwumzrngla` (not prod), where the RPC does not exist at all
  (PGRST202, exit 2). Irrelevant to CI, noted so nobody chases it.
- Shape survey on prod (read-only, counts only): 64 live series; 25 date-only
  sessions on 11 of them; 0 live series that are date-only ONLY (the
  organiser create has not been used on prod yet); 0 live series with a NULL
  category; date-only kinds seen `classes, party, showcase, <null>`, types
  `class, masterclass, party, performance` -- every one is in the parity
  corpus. Re-deriving with the union rule in SQL: 7 of 64 drift today, the
  same 7 the P0 baseline listed, so after #780's repair the expected live
  result is 0 drift and exit 0.

## Not verified

- The live run with the #780 payload (a Supabase branch carrying the
  migration): the orchestrator's step. Expect exit 0 with 0 drift and the
  2 known `course_without_length` ids; if #780 leaves any live series with a
  NULL category under mapped sessions it will red as NEW drift (by the
  decision above) -- repair the mirror, do not add an id.
- `kind_vs_type` still reports over series items only; date-only sessions are
  not included in that report (not in the brief; cheap follow-up if wanted).
- Full `npm run test:unit`; the e2e gate; a browser walk (no UI in this slice).
