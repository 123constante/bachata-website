# Handover: event-truth P1+P3 -- FIX-2 slice (reviews A and B)

Branch `arc/event-truth-p1p3-fix2`, created FROM `origin/arc/event-truth-p1p3-fix` (572612e1). Brief:
`arc/briefs-event-truth:briefs/event-truth-p1p3-fix2.md` (sha 73e8194b). No PR opened (the orchestrator merges this
branch into `feat/event-truth-p1p3-b` and opens the ONE Website PR). Written 2026-10-13 by the cloud worker (Node
22.22.0, npm 10.9.4). Head SHA and the honest Verified / Not verified are at the bottom.

Rules held: `src/lib/eventCategory.ts` untouched (LF sha256 `a8d972e7602ba026...`, now pinned in Website CI, fix 6);
nothing under `src/components/calendar/**`, `EventCalendar.tsx` or `useCalendarEvents.tsx` touched; no budget, pin
or `vendor-ui*` list changed; HTML entities only in JSX; every fix's test was run RED on 572612e1 first (section 2),
and the new rules have mutants (section 3). `docs/event-truth-table.md` prose follows fixes 4, 5 and 6.

## 1. The nine fixes, file by file

| # | fix | where | what changed |
|---|---|---|---|
| 1 | Type row on dates that cannot take a session | `EventEditorPage.tsx` | `hasUpcoming: next !== null` (`next` = the first upcoming date that is NOT cancelled, already computed for the schedule card) instead of `upcoming.length > 0`. `TypeRowState.hasUpcoming` is documented as "an upcoming date that is not cancelled". Prod today (read-only SELECT, counts): 64 live series, **1** with every upcoming date cancelled, 14 with no upcoming date, 0 with a NULL category. |
| 2 | Copy the rule can keep (B F3, d22) | `eventType.ts` | the editable sublabel with a listable date is exactly `Set by its sessions across all its dates.`; locked / no listable date stays `Set by its sessions.`; the two NULL-category sentences are unchanged. The e2e spec `organiser-events.spec.ts` asserted the OLD substring (`'Set by its sessions.'`, which the new sentence does not contain) and was updated to the new exact sentence. |
| 3 | Create retry must not unlock the chips (A) | `NewEventPage.tsx` | new `typeLocked` state, set the moment the create succeeds (every later step runs against an event that exists) and never reset; `chipsLocked = typeLocked || busy` disables the chips and shows `CHIPS_LOCKED_HINT` as the reason, so a failed create REPLAY on a retry leaves them locked and the next Create replays the ORIGINAL type under the same keys. Because that hint says "open the event", the Open button now renders whenever the hint shows (`scheduleFailed || chipsLocked`), disabled while a create is in flight (the event may not exist yet). `scheduleFailed` keeps its error / Open-button role. |
| 4 | Guard floor (A) | `scripts/check-event-truth-v1.mjs` ~line 430 | `assertMeasured(payload.section_count, 1, ...)` on its own; the relaxed `section_count + added_session_count` floor is gone. Prod: 64 of 64 live series carry a series programme (SELECT above), so date-only rows never stand in for it; a broken day -> section join is exit 2 again. The old canary "only date-only rows still measures -> ok" is now the opposite case (exit 2). Self-test count: **152** (was 150: one case flipped, two added). |
| 5 | `kind_vs_type` reads date-only sessions (A, B F6) | same script, report section | `kindTypeMismatches(series.flatMap((s) => [...s.items, ...s.added_sessions]))`; the report line says "programme item(s) or date-only session(s)". Reported only, no gate (canary proves it still never gates). |
| 6 | Website-side byte pin (A, B F1) | `src/lib/__tests__/eventCategory.test.ts` | a new test hashes the LF-normalised lib with `node:crypto` and asserts the full sha256 `a8d972e7602ba026e4dd65fa587942c21c3c1188e5978d4b4ed3a0ac9400471f`. The local admin-twin test stays (skips without `../bachata-admin-11april`); its comment and `docs/event-truth-table.md` now say plainly that the twin is NOT CI-enforced and that no admin ref held these bytes at review time (B F1). The lib's own header ("byte-identical twin") cannot change: it is inside the pinned bytes. |
| 7 | One helper for the first listed date (A) | `newEvent.ts` | `firstListedDate` = `upcomingDates(dates, today).find((d) => !isCancelledDate(d)) ?? null`. Behaviour identical; the test spies the shared helper so a second sort cannot come back. |
| 8 | The e2e fake derives like the server (A) | `tests/e2e/helpers/organiserFake.ts` | `FakeSeries.series_items` (the series programme, fixed at `addSeries` from the fixture's category: party -> one party item, class -> class + party, null -> none) replaces the per-date seeding that read the DERIVED category (circular). New `deriveCategory(s)`: the UNION of `series_items` and every materialised date's date-only rows (`added_session_id`, `removed !== true`) through the lib's `deriveCategories` + `storedCategory` (keep-if-agrees); `saveProgramme` calls it. `workspace()` drops the new field from the payload. New vitest `tests/organiserFake.derive.test.ts` (outside Playwright's `testDir`), 4 cases, 3 red on 572612e1. |
| 9 | Leftovers (A, B F5) | `eventType.ts`, `EventEditorPage.tsx`, 2 tests | `categoryLabel` alias removed; the editor, `eventTruth.matrix` and `fixesBatch.matrix` call `categoryLabelFor` directly. `void chip;` gone (`_chip`). The self-referential `categoryAgrees` assertion is an explicit 14-row table (token x {party} / {class} / {class, masterclass} / all three / empty). |

Not built, by the brief: seeding every weekly date, the 5 serial round trips on Create, the `-1` synthetic row in the
organiser date read, the hand-paired `lib-event-rules` chunk (kept; measured again below, unchanged).

## 2. Red first (every new test on 572612e1, before any source edit)

Run on the unfixed tree with only the test files changed: **20 failed | 256 passed** across the four suites, then the
fake's suite **3 failed | 1 passed**. By fix:

| fix | test | red on 572612e1 |
|---|---|---|
| 1 | `eventTruth.matrix.test.tsx` "live, every upcoming date cancelled, stored %s" (x5: party, class, workshop, masterclass, NULL), on the `live-norule-cancelled-only` shape | 5 (the row said "Change the sessions on a date") |
| 1 | `editorOrder.matrix.test.tsx` snapshot for `live-norule-cancelled-only` | mismatched (`TypeSet by its sessions.Night` now; 16 other rows carry the fix-2 sentence; 17 lines changed, nothing else in the snapshot) |
| 2 | the sublabel table (12 editable rows) and the three rendered-row groups | 12 |
| 3 | `pages.test.tsx` "a failed create replay keeps the chips locked and retries the ORIGINAL type"; "the chips are disabled while a create is in flight" | 2 (the existing "refused first session -> chips locked" case still holds) |
| 4, 5 | the two guard canaries (section 3, mutants M4 / M5 are the unfixed code) | 1 + 1 |
| 6 | the pin itself is the test; its red is mutant M6 | -- |
| 7 | `newEvent.seed.test.ts` "reads the dates through the shared upcomingDates" (spy) | 1 |
| 8 | `tests/organiserFake.derive.test.ts`: class on date 1 then party on date 2 keeps "class"; a removed date-only row leaves the union; a fresh series has no series programme | 3 (the 4th, the series programme on every date, held on both) |
| 9 | explicit `categoryAgrees` table | green on both by design (it replaces a tautology; the lib did not change) |

## 3. Mutation table (file restored byte-identical after each; `cmp` checked)

| mutant | what | result |
|---|---|---|
| M1 (fix 1) | `hasUpcoming: upcoming.length > 0` again | `eventTruth.matrix` + `editorOrder.matrix`: **6 failed** (the 5 cancelled-only rows + the cancelled-only snapshot) |
| M2 (fix 3) | `setTypeLocked(true)` removed | `pages.test`: **2 failed** (create-replay case, refused-first-session case) |
| M3 (fix 3) | `chipsLocked = typeLocked` (not while busy) | `pages.test`: **1 failed** (in-flight case) |
| M4 (fix 4) | floor back to `section_count + added_session_count` | `--self-test` **151/152**: "section_count 0 with date-only sessions only is exit 2" |
| M5 (fix 5) | `kind_vs_type` over `s.items` only | `--self-test` **151/152**: "a date-only session whose type contradicts its section_kind is in the report" |
| M6 (fix 6) | the lib loses `case 'social':` | `eventCategory.test`: **2 failed** (the pin, and the social derive row); lib restored from git, sha `a8d972e7` confirmed |

## 4. Checks (every no-secret step of every `pull_request` workflow), Node 22.22.0

Unit legs under the offline stub (`https://ci-offline-no-db.invalid`, placeholder key, `LIVE_DB=false`).

| workflow / job | step | exit | note |
|---|---|---|---|
| unit-tests.yml `unit` (Europe/London, full) | `npm run test:unit:offline` (what the gate's offline leg and the pre-push hook run) | **1** | 6039 passed, 25 skipped, 1 todo; **6 red = the environment-only set the FIX handover names**: `integrityCouldNotRun.test.ts` x5 (typescript resolves from a parent dir here) + `festivalClientState.test.tsx` x1 (load-flaky; **8/8 green run alone** right after). 0 snapshot reds. |
| | `npm run test:unit` (full, with the 12 live-DB `*.contract.test.ts`) | -- | see pre-ship below (it runs it) |
| | `npm run test:unit:timing` | 0 | 65 passed |
| unit-tests.yml (America/New_York, 9-file tz list) | `npx vitest run --no-file-parallelism <list>` | 0 | 213 passed |
| unit-tests.yml (Australia/Sydney, same list) | same | 0 | 213 passed |
| typecheck.yml | `check:rpc-typing` / `check:wallclock-brand` | 0 / 0 | |
| e2e-smoke.yml (workflow env: placeholder key, `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, chromium) | `organiser-events.spec.ts` + `organiser-loop.spec.ts` | 0 | 10 passed (35.5 s). The FIRST run (cold server) had 2 reds: the fix-2 string in `organiser-events.spec.ts:57` (real; fixed, section 1) and the party spec (cold-start class: 5.3 s green warm, green in the full list). |
| | full `npm run test:e2e` (15 specs) | 0 | **90 passed, 1 skipped, 0 failed** (3.5 m) after the spec fix. The first full run, before it: 89 passed, 1 skipped, 1 failed = the old sublabel substring in `organiser-events.spec.ts` only. |
| architecture-guard.yml `integrity` | `chmod +x bin/*.sh`, `bin/check-integrity.sh` (mode bits put back after; git clean) | 0 | 1441 files, 0 issues |
| | `check:legacy-tables` / `check:legacy-program-rpcs` / `lint:architecture` | 0 / 0 / 0 | |
| | `AUDIT_STRICT=1 npm run check:images` | 0 | |
| | `check:image-widths:self-test` / `check:image-widths` | 0 / 0 | 49/49; 53 calls across 892 files |
| | `check:plan-hygiene:self-test` | 0 | |
| | `check:workflow-artifact-policy:self-test` / `check:workflow-artifact-policy` | 0 / 0 | 393 cases |
| | `check:mojibake:self-test` / the mojibake `git grep` | 0 / 0 | grep clean |
| | `prove:entry-point:self-test` / `prove:entry-point` | 0 / 0 | 54/54; 41 entry points |
| perf-budget.yml `bundle-budget` | `check:bundle-budget:self-test` / `check:first-load-requests:self-test` | 0 / 0 | 135 / 63 cases |
| | `npm run build`, `check:bundle-budget`, `check:first-load-requests` | 0 / 0 / 0 | event 379.3 KB / 47 chunks (pin 380 KB / 47); all 6 prerendered routes match (32 / 32 / 32 / 51 / 32 / 51). Lighthouse / doc-weight need a Vercel deploy: not run. |
| `npm run lint` (chain, 16 links) | | 0 | 16 of 16 green (one earlier run showed `check:integrity` exit 126 only because the bin scripts had no execute bit at that moment -- the same 100644 mode CI fixes with `chmod +x`; re-run with the bit set: green). |
| db-contract-check.yml (no-secret steps) | `ci-live-db-gate.mjs --self-test` | 0 | |
| | `check-migration-stamps.mjs` | 0 | `supabase/migrations/` absent |
| | `check-script-conventions.mjs --self-test` / guard | 0 / 0 | 86 cases / 86 allowlisted, unchanged |
| | `check-guest-list-contract.mjs --self-test` | 0 | 28 cases |
| | `check-event-truth-v1.mjs --self-test` (#70 canary) | 0 | **152/152** |
| | `check-event-truth-v1.mjs` LIVE | **2** | designed fail-closed: against this container's `VITE_SUPABASE_URL` the RPC does not exist (PGRST202); on PROD a read-only SELECT shows only the P0 `check_event_truth_v1` (no `_series_programme_genres_v1` / `_derive_series_category_v1`), so admin #780 is still unapplied and the guard exits 2 until it lands (B F2 holds). Not weakened. |
| `npm run pre-ship` | all | **1** | every repo check PASS (integrity, mojibake x2, legacy x2, no-social-word, architecture, route-boundaries, image-widths x2, rpc-typing, script-conventions x2, wallclock, artifact-policy x2), `test:unit:timing` PASS, `build:ship` PASS, `check:bundle-budget` PASS (every puller and chunk ratchet `[ok]`, event 47 / 47), `check:first-load-requests` PASS, typecheck ratchet PASS (91 errors, baseline 106: the identical 91 as the FIX handover on main); **the ONE FAIL is `test:unit`: 17 red = exactly the environment-only set the FIX handover names** (`integrityCouldNotRun.test.ts` x5 + 12 live-DB `*.contract.test.ts` cases: `eventViewCompat` 5, `publicEventPageLineup` 3, `occurrenceProgram` 2, `latestEvents` 2, all against the offline stub; 6062 passed). pre-ship SKIPPED its own eslint and `test:e2e` legs because its ship diff is taken against `origin/arc/event-truth-p1p3-fix2`, which already carried this commit; both were run by hand (eslint exit 0 on every changed file; e2e rows above). `check:plan-hygiene` SKIPPED (no plans dir on this machine). |

Hooks: `.githooks/pre-commit` / `pre-push` are mode 100644 in git, so git ignores them in this checkout (`core.hooksPath`
is `.githooks`; "hook was ignored because it's not set as executable", as the FIX handover records). The first commit here
(14ff798) was made with `-c core.hooksPath=/dev/null`, which changed nothing (the hooks could not run anyway) but reads
like a bypass, so it is said here; the second commit uses no override. Nothing was bypassed by `--no-verify`. What
pre-commit runs (`check-source-integrity.cjs`, via `bin/check-integrity.sh`: 1441 files, 0 issues, run by hand before
each commit) and what pre-push runs (`test:unit:offline`) are the rows above.

## 5. Verified / Not verified

**Verified (here):** every fix in section 1 against its red-first test (section 2) and its mutant (section 3); the
prod shapes fix 1 and fix 4 rest on (64 live, 1 cancelled-only, 64/64 with a series programme, 25 date-only
sessions, 0 NULL categories; read-only, counts only); the lib byte pin (`a8d972e7`, full hash in the test); the two
organiser e2e specs and the full list; every no-secret step of every PR workflow (section 4); both bundle ratchets
unchanged with no budget, pin or `vendor-ui*` change; eslint clean on every changed file.

**Not verified:** the live #70 guard and the live contract suites against a DB carrying admin #780 (prod does not yet;
the orchestrator's window, B F2); `integrityCouldNotRun.test.ts` (its precondition does not hold in this container);
Lighthouse / document-weight (need a Vercel preview); the 390x844 walk on prod-shaped data (no organiser login here,
and self-serve is OFF in prod, B F7); the admin twin's bytes (no admin checkout here: the local twin test skipped, as
it does in CI; the Website pin is what CI now holds); the calendar masterclass / social parity (`it.todo`,
ask-Ricky file).

**Head SHA:** see `git log -1 arc/event-truth-p1p3-fix2`. PR: none (by brief).
