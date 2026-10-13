# Handover: event-truth P3 &mdash; Website guard slice (CI #70 learns date-only sessions, drift gates at 0)

Branch `arc/event-truth-p1p3-guard` (the dispatch ticket pinned this name; the brief file
names `arc/event-truth-p1p3-guard-b` &mdash; the ticket's "push ONLY this branch" won; neither existed
on the remote when this worker started). Brief: `briefs/event-truth-p3-guard.md` on
`arc/briefs-event-truth`. Class: GUARD-CI. No PR opened (the orchestrator merges into
`feat/event-truth-p1p3`). Zero-context cloud worker; never merged, never approved, never
`--no-verify`.

## Commits

1. `chore(event-truth): canonical eventCategory lib + test (from a8efae3c, guard slice)` &mdash;
   ONLY `src/lib/eventCategory.ts` + `src/lib/__tests__/eventCategory.test.ts` from the published
   patch. `sha256sum` of the LF bytes starts `a8d972e7` (the file is CRLF in the working tree per
   `.gitattributes`). The rest of the patch (organiser screens) was never applied. NOTE: in this container
   `.githooks/*` are not executable (git prints "hook was ignored"), so `pre-commit`
   (`check-source-integrity.cjs --staged`) ran by hand instead: whole tree `1434 files scanned,
   0 corrupted`, staged `7 files scanned, 0 corrupted`. The hooks were made executable (local
   mode only, not committed) before the push so `pre-push` (the `test:unit:offline` gate) ran
   for real.
2. `guard(event-truth): CI #70 reads date-only sessions; category_drift gates at 0 (admin #780)` &mdash;
   everything below.

## What changed (files owned by this slice only)

- `scripts/check-event-truth-v1.mjs`
  - `deriveGenres(sectionKinds, itemTypes, addedSessions)`: date-only sessions' `kind`
    (= `section_kind`) then `type` go through the SAME mapping; null maps to nothing.
  - `runCheck`: a series "has no programme" only when it has no sections AND no date-only
    sessions; the genre set unions `added_sessions`; `kind_vs_type` (reported only) now also
    reads the date-only `{kind, type}` pairs; the measured floor is
    `section_count + added_session_count >= 1` (an organiser-made series carries only date-only
    sessions, so a floor on sections alone would exit 2 on a fully measured prod one day).
  - `assertTruthPayload`: `added_sessions` REQUIRED per series (array; each element an object with
    exactly the keys `kind`,`type`, each text or null); `added_session_count` REQUIRED, strict
    `===` the sum of array lengths. A missing key, the pre-#780 shape, an extra key, a non-text
    kind, a string total: all exit 2.
  - `truthPayload` fixture projection: `spec.occurrences` + `spec.added` rows
    (`event_occurrence_added_session_p5.occurrence_id -> event_occurrence_p5.series_id`), so a
    fixture is still written as the tables look and the payload derived.
  - Header: GENRE MAPPING + "DRIFT GATES AT 0" + MERGE PRECONDITION (admin #780 first).
- `event-truth-baseline.json`: `category_drift` is `{}`; `course_without_length` unchanged (two
  ids); `recorded_on` 2026-10-13; comment rewritten (gates at 0, #780 repairs the mirror, merge
  precondition).
- `.github/workflows/db-contract-check.yml`: ONLY the comment lines of step #70.
- `docs/event-truth-table.md`: genre row (date-only sessions, gated at 0), ratchet section, a
  "payload shape is pinned (admin #780)" soft spot.
- NEW `scripts/fixtures/event-truth-parity.json`: 26 cases, the brief's exact shape
  (`name, format, sectionKinds, itemTypes, addedSessions[{kind,type}], stored, expect{set, agrees}`).
  `stored` is never null (see "Not resolved" below).
- NEW `src/lib/__tests__/eventCategory.parity.test.ts`: the same file through
  `deriveCategories(format, [...sectionKinds, ...added.kind], [...itemTypes, ...added.type])` +
  `categoryAgrees` from the byte-pinned lib; plus a key-shape check on the fixture.

## Canary: before / after

- Before (main, P0): `96/96`.
- New cases written FIRST and run against the UNFIXED rules: `120/145`, 25 FAIL, every one of
  them a case the fix exists for (date-only derive x6, date-only check x5, payload shape x7, the
  shipped baseline being empty, parity x7). Recorded in the session log; the failing names are the
  ones below.
- After the fix: `146/146`; after the review-round fixes (floor, kind_vs_type, two more cases):
  `148/148`.
- The brief's list, all present: no series programme + one date-only `class` stored `party` ->
  `violated:category_drift`; stored `class` -> `ok` and NOT printed as "no programme at all";
  date-only `showcase`/`performance` -> "map to no genre", not drift; `added_session_count` off by
  one -> exit 2 (`bad-payload`); a series with no `added_sessions` -> exit 2; the pre-#780 shape
  (no key anywhere) -> exit 2; plus: third key, non-text kind, non-object element, string total,
  a null `section_kind` with a `class` type still reads class, a paused series' date-only session
  is outside the payload, the SHIPPED `category_drift` is empty.

## Mutants (17, all killed; each run with the real self-test + vitest, file restored byte-exact after each)

| # | mutant | guard `--self-test` | vitest `eventCategory*` |
|---|---|---|---|
| M1 | date-only `kind` ignored | 143/146 red | &mdash; |
| M2 | date-only `type` ignored | 143/146 red | &mdash; |
| M3 | "no programme" ignores date-only sessions | 142/146 red | &mdash; |
| M4 | `runCheck` does not pass `added_sessions` | 143/146 red | &mdash; |
| M5 | `added_sessions` key not required | 144/146 red | &mdash; |
| M6 | `added_session_count` not compared | 144/146 red | &mdash; |
| M7 | loose `!=` on `added_session_count` | 145/146 red | &mdash; |
| M8 | a third key on an added session tolerated | 145/146 red | &mdash; |
| M9 | non-text kind tolerated | 145/146 red | &mdash; |
| M10 | a drift id re-added to the baseline | 145/146 red | &mdash; |
| M11 | PARITY guard mapping: `social` not a party | 140/146 red | **green** (76 pass) |
| M12 | PARITY guard mapping: `masterclass` not a class | 138/146 red | **green** |
| M13 | PARITY lib mapping: `social` not a party (lib restored, sha a8d972e7) | **green** 146/146 | 4 failed |
| M14 | PARITY lib mapping: `workshop` not a class | **green** | 2 failed |
| M15 | PARITY lib `categoryAgrees`: `workshop` not a class | **green** | 4 failed |
| M16 | measured floor counts series sections only | 147/148 red | &mdash; |
| M17 | `kind_vs_type` skips date-only sessions | 147/148 red | &mdash; |

M11&ndash;M15 are the parity proof the brief asked for: mutate ONE side and only that side reds.
(The table shows the first sweep; the final full sweep on the 148-case canary killed every row again:
M1/M2/M4 145/148, M3 144/148, M5/M6 146/148, M7&ndash;M10 and M16/M17 147/148, M11 142/148, M12 140/148,
M13&ndash;M15 guard green 148/148 with vitest 4/2/4 failed.)

## Checks run locally (every step of the `integrity` job in `architecture-guard.yml`, read from the yml)

| check | result |
|---|---|
| `node scripts/check-event-truth-v1.mjs --self-test` | 148/148 |
| `node scripts/check-script-conventions.mjs` | passed (86 known violations still owed, unchanged) |
| `node scripts/prove-entry-point-dispatch.mjs` | 41/41 entry points proven (guard in TARGETS) |
| `npm run test:unit -- eventCategory` | 2 files, 76 passed, 1 skipped (the pre-existing admin-twin skip) |
| `npm run test:unit` (full) | exit 0 |
| `npm run lint` | 16 of 16 links green (first run showed `check:integrity` exit 126: `bin/*.sh` lacked the exec bit; CI's `chmod +x bin/*.sh` step does that, applied locally, mode changes reverted before commit) |
| `bin/check-integrity.sh` | ok (1433 files, 0 issues) |
| `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | passed |
| `AUDIT_STRICT=1 npm run check:images` | exit 0 |
| `check:image-widths:self-test` + `check:image-widths` | 49/49, ok |
| `check:plan-hygiene:self-test` | passed |
| `check:workflow-artifact-policy:self-test` + guard | 393 cases, ok |
| `check:mojibake:self-test` + the `git grep` guard | clean |
| `npx eslint` on the touched `.mjs`/`.ts` files | 0 problems |
| `check-source-integrity.cjs` (tree + `--staged`) | 0 corrupted |

## Review round (ONE, GUARD-CI stopping rule; /code-review xhigh, 12 findings)

Edits made: measured floor (sections + date-only), `kind_vs_type` over date-only pairs, `truthWith`
hoisted next to the other helpers (was used before its `const`), parity expected-value computed
inside the case body (a malformed fixture now fails by name instead of throwing out of
`selfTest()`), "mirror was repaired" reworded everywhere to "#780 repairs ... merge precondition".
Fixes to findings are unreviewed code (one round).

Findings NOT acted on (owner decisions the brief pins, or files this slice does not own):

- "Prod's RPC has no `added_sessions` yet, so the step is exit 2 the moment this lands": true and
  by design &mdash; the brief says so; it is now written as a MERGE PRECONDITION in the yml comment,
  the header, the baseline and the doc. Sequencing (admin `db push` #780 first) is the
  orchestrator's.
- "Prod still has 7 drifting series, an empty baseline fails on first run": the brief's owner
  decision ("after which drift must be 0"); #780 repairs the mirror. If #780 lands WITHOUT the
  repair, the first run is exit 1 with 7 NEW offenders &mdash; that is the gate working.
- `recorded_on` bumped although the two course ids date from 2026-10-12: the brief asked for the
  bump.
- "The guard's `categoryAgrees(null)` is true, the lib's is false": a real divergence, deliberate
  on both sides today (the guard: NULL declares nothing; the lib: NULL agrees with nothing, so
  `storedCategory` writes a value). Post-#780 a NULL mirror over a mapped set is a derivation that
  failed to write, and the guard would wave it through. 0 such series on prod today (SELECT,
  counts only). Queued as an owner question; the parity fixture keeps `stored` non-null so it does
  not paper over it.
- "vitest CAN import `scripts/*.mjs` (other tests do), so the JSON is not forced": true
  (`.gitattributes` pins `scripts/**/*.mjs` to LF). A generated cross-product (guard x lib over
  16 tokens x 5 positions x 5 stored values, 7708 vitest cases, importing the guard) was built and
  PASSED here, then dropped: with the guard imported, a guard-mapping mutant reds the vitest too,
  which breaks the brief's required proof ("mutate the guard's mapping -> the guard self-test reds
  while the vitest stays green"). Cheap follow-up if the owner wants both: keep the JSON proof
  and add the product as a separate spec.
- `format` in the fixture is read only by the lib side and `word` is not parity-checked: the
  brief's fixture shape; a follow-up could add `expect.word`.
- Stale `TODO(next session): parity ...` block in `src/lib/__tests__/eventCategory.test.ts` and
  the "LF" wording in the byte-pinned `src/lib/eventCategory.ts` header: not this slice's files
  (the lib is never edited here; the test came with the patch).

## Verified on real data

- Prod `stsdtacfauprzrdebmzg` (read-only SELECT via the Supabase connector, counts only):
  `check_event_truth_v1` exists, SECURITY DEFINER, returns `jsonb` with the P0 keys
  (`check, computed_at, item_count, measured_as, section_count, series, series_count`) and
  series keys (`category, course_total_sessions, format, id, items, lifecycle_status, name,
  section_kinds`): NO `added_sessions`, NO `added_session_count`; 64 live series. So the
  pre-#780 shape is exactly what the new assertion refuses.
- LIVE run against prod with the project's public anon key:
  `node scripts/check-event-truth-v1.mjs` -> exit 2,
  `check_event_truth_v1 series entry "..." is missing id, section_kinds, items or added_sessions
  (the pre-#780 shape ...)`. Fail-closed on the real payload, as the brief expects.
  (The container's own `VITE_SUPABASE_*` env points at a different project, `srrpvuxldthwumzrngla`,
  where the RPC does not exist at all &mdash; also exit 2.)

## Not verified

- The live run against a database that HAS admin #780 (exit 0 with 0 drift, or exit 1 naming the
  unrepaired series): no such branch was reachable from here. The orchestrator runs it against a
  Supabase branch with the migration.
- That #780's `added_session_count` is computed from the base-table join independently of the
  array (the guard assumes it; the fixture projection mimics it).
- The full `test:unit` run rewrote
  `src/modules/organiser/events/__tests__/__snapshots__/editorOrder.matrix.test.tsx.snap` (a
  snapshot written, not a failure; the UI slice's file, reverted with `git checkout`, not
  committed).
- The known-flaky full-suite cases (DancerFirstGate "returnTo round-trips", organiser shell
  "/account/o renders") passed in the one full `test:unit` run here; nothing to retry.
