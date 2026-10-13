# Brief: event-truth P3 -- Website guard slice (CI #70 learns date-only sessions, drift gates at 0)

Repo 123constante/bachata-website (PUBLIC repo: never put a secret in a commit or a doc). Zero-context
cloud worker. Never merge, never approve, never --no-verify. Class: GUARD-CI.
BRANCH: `arc/event-truth-p1p3-guard`, created FROM `wip/event-truth-p1p3` (head a8efae3c), never from
main. Push only this branch. Do NOT open a PR (the orchestrator merges into `feat/event-truth-p1p3`
and opens ONE PR). A parallel UI worker is on `arc/event-truth-p1p3-ui` and owns `src/**` (except the
two files below); you never touch its files and it never touches yours.

## Read first
CLAUDE.md, docs/ci-guard-notes.md (the six rules of check-script-conventions.mjs), docs/testing-doctrine.md,
`scripts/check-event-truth-v1.mjs` (the P0 guard, CI #70, merged #736), `event-truth-baseline.json`,
`docs/event-truth-table.md`, `src/lib/eventCategory.ts` (the canonical rule; BYTE-PINNED, never edit it:
the admin repo holds the same bytes and CI checks parity).

## Files you OWN (nothing else)
- `scripts/check-event-truth-v1.mjs`, `event-truth-baseline.json`, `docs/event-truth-table.md`
- `.github/workflows/db-contract-check.yml`: ONLY the comment lines of step #70, if they need updating
- NEW `scripts/fixtures/event-truth-parity.json` (shape below)
- NEW `src/lib/__tests__/eventCategory.parity.test.ts`
- `docs/handover/event-truth-p3-guard.md`: YOUR handover (create; update before every stop)

## Why (owner decision 2026-10-13)
Organisers edit the programme PER DATE: `organiser_set_occurrence_programme_v1` writes new sessions to
`event_occurrence_added_session_p5` (section_kind, type), never to the series programme. The Website's
new organiser create (first session seeded from the Class/Party chip, commit a8efae3c) makes a series
with ONLY date-only sessions. So the genre set = series section kinds + series item types + date-only
section_kind AND type (same genresOf mapping; unknown values ignored). Admin #780 re-creates
`check_event_truth_v1` with that data and repairs the stored mirror, after which drift must be 0.

## PINNED INTERFACE (what admin #780 ships; code against it now)
`check_event_truth_v1` per series gains `added_sessions`: array of `{kind: text|null, type: text|null}`
(kind = section_kind), `[]` when none; top-level `added_session_count`: integer, the count of those
rows over LIVE series from its own base-table join. Every existing key unchanged.

## Tasks
1. Guard: union `added_sessions` into the genre set (kind, then type, the same mapping as sections and
   items; null maps to nothing). `assertTruthPayload`: `added_sessions` REQUIRED per series (array of
   objects with exactly those two keys, each text or null); `added_session_count` REQUIRED, strict ===
   the sum of array lengths. A missing key is exit 2 (fail closed), as every other key.
2. Drift gates at 0: empty `category_drift` in `event-truth-baseline.json` (keep `course_without_length`
   as is -- #780 does not repair it), so the ratchet fails on ANY drifting live series; keep "departed"
   reporting. Update `recorded_on` + the comment; header + doc say drift gates at 0 since #780.
3. Canary (`--self-test`) cases, run against the UNFIXED code first (a case that cannot fail proves
   nothing): a live series with no series programme and one date-only `class` session reads as class,
   stored `party` -> drift (fail), stored `class` -> no drift; date-only `performance`/`showcase` maps to
   nothing; `added_session_count` off by one -> exit 2; `added_sessions` missing -> exit 2; a payload
   with the old shape (no key) -> exit 2. Then mutants of each change (at least 5), all killed; record them.
4. Parity fixture `scripts/fixtures/event-truth-parity.json`: `{ "_comment", "cases": [ { "name",
   "format", "sectionKinds": [], "itemTypes": [], "addedSessions": [{"kind","type"}], "stored",
   "expect": { "set": [], "agrees": bool } } ] }` (>= 15 cases: every mapped value, synonyms, unknowns,
   nulls, date-only-only, keep-if-agrees pairs). The guard's `--self-test` runs every case through ITS
   deriveGenres/categoryAgrees; `src/lib/__tests__/eventCategory.parity.test.ts` runs the SAME file
   through `deriveCategories(format, [...sectionKinds, ...addedSessions.map(a => a.kind)],
   [...itemTypes, ...addedSessions.map(a => a.type)])` and `categoryAgrees`. Mutate ONE side (the guard's
   mapping) -> the guard self-test reds while the vitest stays green, and vice versa; record it.
   (vitest cannot import the guard .mjs: CRLF shebang -- hence the shared JSON, not an import.)
5. Run: `node scripts/check-event-truth-v1.mjs --self-test`, `node scripts/check-script-conventions.mjs`,
   `node scripts/prove-entry-point-dispatch.mjs` (the guard is in TARGETS), `npm run test:unit -- eventCategory`,
   `npm run lint`, and every step of the `integrity` job in .github/workflows (read it). The LIVE run
   (`node scripts/check-event-truth-v1.mjs` with the anon key) is EXPECTED exit 2 until admin #780 is
   applied (payload lacks the new keys): say so in Not verified; the orchestrator runs it against a
   Supabase branch that has the migration.

## Done means
Commit, push, update the handover (what changed, canary count before/after, mutants + outcome, parity
proof, checks, Verified / Not verified). Report: head SHA, checks, Not verified.
