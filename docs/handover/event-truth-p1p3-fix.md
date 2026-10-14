# Handover: event-truth P1+P3 -- FIX slice (bundle ratchets, e2e, merged-tree checks)

Branch `arc/event-truth-p1p3-fix`, created FROM `origin/arc/event-truth-p1p3-ui-b` (03fff9c), first commit the
merge of `origin/arc/event-truth-p1p3-guard-b` (d956c90). Brief: `arc/briefs-event-truth:briefs/event-truth-p1p3-fix.md`.
No PR opened (the orchestrator merges this branch and opens the ONE Website PR). Written 2026-10-13 by the cloud
worker (Node 22.22.0, npm 10.9.4); updated before every stop. Head SHA and the honest Verified / Not verified are at
the bottom.

## 0. The merge (one conflict, not "disjoint")

The brief expected no conflict. Both branches ADDED `src/lib/__tests__/eventCategory.test.ts` (the guard slice
applied it from the a8efae3c patch; the UI slice applied the patch and then edited it). Resolved by taking the UI
branch's version: it is the superset (it replaces the guard copy's dead `void TOKENS; void categoryAgrees;` TODO
with the real `categoryAgrees` table) and the parity the TODO asked for is exactly what the guard branch adds in
`src/lib/__tests__/eventCategory.parity.test.ts`. Both branches carried byte-identical `src/lib/eventCategory.ts`
(same blob 2355455); it was not touched. Nothing else overlapped.

## 1. Bundle ratchets (fix 1)

### What was actually red, measured from clean checkouts in this container

| tree | `check:bundle-budget` | `check:first-load-requests` |
|---|---|---|
| `origin/main` 5e0ec4c (clean worktree) | exit 0; event (/event/:id) 379.1 KB / 47 chunks | exit 0 (32 / 32 / 32 / 51 / 32 / 51) |
| `origin/arc/event-truth-p1p3-ui-b` 03fff9c (clean worktree) | **exit 1**: `[OVER] chunk ratchet: event -- 48 first-load chunk(s), allowance 47`; 379.3 KB, under the 380 KB byte budget | exit 0, every pin matched |
| merged tree before the fix (aba25a4) | identical to the UI tip: exit 1 on the chunk ratchet only, 379.3 KB / 48 | exit 0 |
| merged tree with the fix (7a75cb0) | exit 0; event 379.3 KB / 47 | exit 0, every pin matched |

So the UI handover's two reds -- "380.7 KB vs 380 KB" and "+2 requests on /parties, /classes, /faq and the three
landing pages, two new chunks `accountRouting` and `authRouting`, a SECOND root chunk" -- do **not** reproduce
from the committed tree. A clean build of the UI tip has exactly one regression against main: the byte-pinned lib
`src/lib/eventCategory.ts` became a chunk of its own (`assets/eventCategory-*.js`, 0.26 KB gz), which is one more
first-load chunk on /event (and on /festival, which is not budgeted), and the chunk ratchet in `perf-budgets.json`
reds by exactly one. The manifest diff main -> UI tip (chunk names with the hash stripped, import edges per node)
shows ONE new chunk and no other edge change.

About the "second root chunk": every build of this app has two `root-*.js` files -- the real `root-*.js` (12 KB gz,
`app/root.tsx` + the shell) and an 850-byte `app/root.tsx?__react-router-build-client-route` facade React Router
emits for the route module. main at 5e0ec4c has both (`root-CGvHEmd6.js` 850 B next to `root-DqGeJYV1.js`). It is
not this branch's and it is not a defect. The accountRouting / authRouting chunks in that handover's /faq preload
list cannot be reproduced from any committed tree here; the likeliest cause is a build run on a working tree with
uncommitted files (`react-router build` does not clear `build/`, and a stale index.html is read by the request
guard), which cannot be verified after the fact. The one reproducible red is the one fixed below.

### Cause, in Rollup's terms

The lib is a leaf (imports nothing) and is read from two sides of the app that share no other module of their own:

- `src/modules/event-page/bento/utils/endedRun.ts` -> lives in the `buildEventJsonLd-*.js` chunk, colour
  {event route, festival route, FestivalDetail};
- `src/modules/organiser/events/eventType.ts` -> its own chunk, colour {EventEditorPage, NewEventPage}.

(`seriesCommands.ts` only mentions the lib in a comment; the grep in the brief was a false positive.) Rollup files
a module by the SET of entry points that statically reach it. The union of those two sets -- 5 entries -- is a set
no other module in the build has (checked over every manifest node: zero chunks with the identical colour), so the
lib cannot share a chunk and gets its own. Rollup's small-chunk merge (`experimentalMinChunkSize`, default 1) will
not fold it into a neighbour because every candidate is loaded by entries that do not need it, so the merge is
never "free". This is the request-count class the chunk ratchet exists to catch and the KB budget cannot see.

### Fix: the ONE first-party manual chunk, `lib-event-rules`

The brief's first acceptable shape, "a manual chunk for the lib", does not fix the count on its own: a chunk holding
the lib ALONE is still one chunk /event did not load before (48). The lib has to ride inside a chunk /event already
loads. Among the first-party single-module chunks whose colour is a superset of the lib's, `src/lib/londonDate.ts`
is the right partner: a pure leaf rule module like the lib (no React, no imports), the site's calendar-time
authority, already in the first load of every entry that reaches eventCategory, and the smallest superset among
`src/lib` modules (+26 entries that pay the lib's 0.26 KB gz for nothing -- the accepted cost; `use-toast` is +22
but is a UI hook, not a rule). `vite.chunks.ts` gains `LIB_EVENT_RULES_MODULES` and a branch ahead of the
node_modules gate, bounded on the END of the id (`endsWith('/src/lib/londonDate.ts')`, and never under
node_modules) so a nested copy inside a package stays with its package. No `vendor-ui*` list was touched; no budget
or pin was raised. `tests/chunkClassifier.test.ts` holds the shape (36 cases, 8 new: both members route to the
group, siblings in src/lib do not, nested node_modules copies do not, the two paths exist on disk). CLAUDE.md's
chunk list names the group.

### Numbers, all eight budgeted routes (gz KB / first-load chunks), same container, same toolchain

| route | main 5e0ec4c | merged, before fix | merged, after fix | pin |
|---|---|---|---|---|
| home (/city/:slug) | 203.8 / 43 | 203.8 / 43 | 204.1 / 43 | 215 KB / 43 |
| event (/event/:id) | 379.1 / 47 | 379.3 / **48** | 379.3 / 47 | 380 KB / 47 |
| auth (/auth/callback) | 288.7 / 33 | 288.7 / 33 | 288.9 / 33 | 310 KB / 33 |
| parties (/parties) | 320.0 / 49 | 320.0 / 49 | 320.2 / 49 | 325 KB / 49 |
| classes (/classes) | 320.1 / 49 | 320.1 / 49 | 320.3 / 49 | 325 KB / 49 |
| faq (/faq) | 229.9 / 30 | 229.9 / 30 | 230.1 / 30 | 245 KB / 30 |
| landing prose | 230.1 / 30 | 230.1 / 30 | 230.3 / 30 | 245 KB / 30 |
| landing style | 229.1 / 30 | 229.1 / 30 | 229.3 / 30 | 245 KB / 30 |

Puller ratchet (vendor-supabase): unchanged on every route (0 / 2 / 3 / 3 / 3 / 0 / 0 / 0). First-load request
pins (six prerendered routes): 32 / 32 / 32 / 51 / 32 / 51 on all three trees. The merged chunk
`lib-event-rules-*.js` holds exactly `src/lib/londonDate.ts` + `src/lib/eventCategory.ts` (1.5 KB gz, 43 importers);
total client chunks 215 vs 216 before the fix. The vendor-supabase chunk is +14.3 KB over its baseline on main and
on this branch alike (pre-existing drift, reported, not gated).

## 2. e2e (fix 2)

Workflow env from `e2e-smoke.yml` (placeholder key, `VITE_ENABLE_ORGANISER_SELF_SERVE=true`), chromium 1.63.0,
`/opt/pw-browsers`.

| run | result |
|---|---|
| `tests/e2e/dancer-home.spec.ts` alone, first run (COLD dev server: first Playwright run in this container) | **1 failed**, 13 passed (1.1 m): `flows @390 > "I organise events" opens the unchanged onboarding` -- `onboarding-result` count 0 after 15 s (the lazy OnboardingView chunk + its search on a cold Vite server). NOT one of the two the UI handover named. |
| the same spec alone, second run (warm) | **14 passed** (35.7 s), exit 0 |
| full `npm run test:e2e` list (15 specs), after that | **90 passed, 1 skipped, 0 failed** (3.2 m), exit 0 |

Reading: the two dancer-home reds in the UI handover (full-list run, ~20 s each) and the one here (cold run) are the
load / cold-chunk flake class the briefs name (dancer-first gate round-trips), not a defect in the branch: the same
spec is green alone on a warm server and green inside the full list. No bisect was warranted (the brief's bisect
condition is "red alone"; it was red once cold and green alone after). Nothing in the spec or the fake was changed.

## 3. Merged-tree checks (fix 3)

Every step of every `pull_request` workflow in `.github/workflows` that runs without a secret, on the merged tree at
7a75cb0 (fix in place), Node 22.22.0, `TZ=Europe/London` unless stated, DB env = the unit-tests.yml offline stub
(`https://ci-offline-no-db.invalid`, placeholder key, `LIVE_DB=false`). Exit codes are the step's own.

| workflow / job | step | exit | note |
|---|---|---|---|
| unit-tests.yml `unit` (Europe/London, full) | `npm run test:unit` | **1** | 6049 passed, 16 skipped, 1 todo, 0 snapshot reds; **17 red = the environment-only set**: `integrityCouldNotRun.test.ts` x5 ("typescript resolved in the temp repo -- precondition gone": typescript resolves from a parent dir in this container) + 12 `*.contract.test.ts` cases (`eventViewCompat` 5, `publicEventPageLineup` 3, `occurrenceProgram` 2, `latestEvents` 2) that need the live DB ("Invalid API key" / "fetch failed" against the offline stub). The same 15 + 2 the P1 UI handover recorded on main and on its branch. CI runs this leg with real secrets (the live-DB gate dry run says live=true for this diff: `scripts/**`, the workflow file, the lib and its parity test). |
| | `npm run test:unit:offline` (what the pre-push hook and the gate's offline leg run) | **1** | 6035 passed; 6 red = `integrityCouldNotRun` x5 (same cause) + `tests/client/festivalClientState.test.tsx` "shows no frame carrying the previous festival day" x1, the load-flaky case the P1 handover already named: **8/8 green run alone** right after. |
| | `npm run test:unit:timing` | 0 | 65 passed |
| unit-tests.yml `unit` (America/New_York, tz-sensitive list) | `npx vitest run --no-file-parallelism <9 files>` | 0 | 213 passed |
| unit-tests.yml `unit` (Australia/Sydney, tz-sensitive list) | same list | 0 | 213 passed |
| typecheck.yml | `npm run check:rpc-typing` | 0 | |
| | `npm run check:wallclock-brand` | 0 | |
| e2e-smoke.yml | `npm run test:e2e` (full 15-spec list, workflow env) | 0 | 90 passed, 1 skipped (section 2) |
| architecture-guard.yml `integrity` | `chmod +x bin/*.sh` then `bin/check-integrity.sh` | 0 | mode bits put back after (`chmod -x`), git shows no change |
| | `check:legacy-tables` / `check:legacy-program-rpcs` | 0 / 0 | |
| | `lint:architecture` | 0 | |
| | `AUDIT_STRICT=1 npm run check:images` | 0 | |
| | `check:image-widths:self-test` / `check:image-widths` | 0 / 0 | |
| | `check:plan-hygiene:self-test` | 0 | |
| | `check:workflow-artifact-policy:self-test` / `check:workflow-artifact-policy` | 0 / 0 | |
| | `check:mojibake:self-test` / the mojibake `git grep` | 0 / 0 | grep clean |
| | `prove:entry-point:self-test` / `prove:entry-point` | 0 / 0 | 54/54; 41 entry points proven |
| perf-budget.yml `bundle-budget` | `check:bundle-budget:self-test` / `check:first-load-requests:self-test` | 0 / 0 | |
| | `npm run build` then `check:bundle-budget` / `check:first-load-requests` | 0 / 0 | section 1; lighthouse / doc-weight jobs need a Vercel deploy: not run |
| `npm run lint` (chain) | 16 links | 0 | 16 of 16 green; the trailing whole-tree eslint is informational (red backlog as on main) |
| db-contract-check.yml (no-secret steps) | `ci-live-db-gate.mjs --self-test` | 0 | all cases passed |
| | `check-migration-stamps.mjs` | 0 | `supabase/migrations/` absent |
| | `check-script-conventions.mjs` | 0 | 86 allowlisted, unchanged |
| | `check-guest-list-contract.mjs --self-test` | 0 | 28 cases |
| | `check-event-truth-v1.mjs --self-test` (#70 canary) | 0 | 150/150 |
| | `check-event-truth-v1.mjs` LIVE | **2** | designed fail-closed, as the brief predicts: against this container's own `VITE_SUPABASE_URL` project the RPC does not exist (PGRST202); against PROD a read-only `SELECT` through the Supabase connector shows `check_event_truth_v1()` still returns the P0 keys only (`check, computed_at, item_count, measured_as, section_count, series, series_count`, no `added_session_count`), so the guard's `assertTruthPayload` exits 2 until admin #780 applies. Not weakened. |
| `npm run pre-ship` | all | **1** | every repo check PASS (integrity, mojibake, legacy x2, no-social-word, architecture, route-boundaries, image-widths x2, rpc-typing, script-conventions x2, wallclock, artifact-policy x2), `test:unit:timing` PASS, `build:ship` PASS, `check:bundle-budget` PASS, `check:first-load-requests` PASS, typecheck ratchet PASS (91 errors, baseline 106; the identical 91 on main per both earlier handovers), scoped eslint PASS (4 files, 0 errors); **the ONE FAIL is `test:unit`, the 17 environment-only reds above**, and `test:e2e` is SKIPPED by pre-ship as a consequence (run separately: green, section 2). The UI handover's reds (3) and (4), the two bundle ratchets, are gone. |

Hooks: `.githooks/pre-commit` and `.githooks/pre-push` are mode 100644 in git (Windows-native repo), so git ignored
them in this checkout ("hook was ignored because it's not set as executable"). Nothing was bypassed by flag; what the
pre-commit hook runs (`check-source-integrity.cjs`) was run by hand before each commit (1441 files, 0 corrupted) and
what the pre-push hook runs (`test:unit:offline`) is the row above.

## 4. Not changed, by rule

- `src/components/calendar/**`, `src/components/EventCalendar.tsx`: untouched (ask-first list). The calendar
  masterclass / social `it.todo` in `eventTruth.matrix.test.tsx` stays as is.
- `src/lib/eventCategory.ts`: untouched (byte pin; LF sha256 still starts `a8d972e7`).
- No budget, pin or allowance in `perf-budgets.json` was raised; no `vendor-ui*` list was edited.
- The guard's live run is still exit 2 against prod by design (section 3); nothing in it was weakened.

## 5. Verified / Not verified

**Verified (here, on the merged tree):** the single real cause of the UI handover's bundle red (one new chunk for
the lib) and its fix, measured on all eight budgeted routes and six prerendered routes against a clean build of
`origin/main` and of the UI tip; both ratchets green with no budget, pin or `vendor-ui*` list change; the
classifier test (36 cases incl. the bounds of the new group); the full e2e list green; every no-secret step of
every PR workflow (table above), the three unit legs, the lint chain, pre-ship down to its one environment-only
FAIL; the byte pin of the lib (`a8d972e7`); the merge conflict resolution.

**Not verified:** the live contract suites and the live #70 guard run against a DB that carries admin #780 (the
orchestrator's step; expect exit 0, 0 drift, 2 `course_without_length` ids); `integrityCouldNotRun.test.ts` (its
precondition does not hold in this container); the Lighthouse / document-weight jobs (need a Vercel preview); the
390x844 walk on prod-shaped data (no login here; the script is in the P1 handover, section 6); the UI handover's
"+2 requests / accountRouting / authRouting" symptom, which could not be reproduced from any committed tree and is
therefore unexplained beyond "not in the committed code" (if it reappears on the PR's own Vercel/CI build, diff that
build's `/faq/index.html` modulepreload list against a local one first); the calendar masterclass / social parity
(`it.todo`, ask-Ricky file).

**Head SHA:** see `git log -1` on `arc/event-truth-p1p3-fix` (recorded in the hand-off message). PR: none (by brief).
