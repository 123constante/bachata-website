# INTEGRATE -- R1 slices S1+S2+S3(fixed)+S4 merged and CI-verified

Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/INT-verify.md` (sha 52a3cd44). Ticket dt_5ec2c696f44b. Date 2026-10-17.
Branch `claude/org-r1-integrate`, cut from `origin/feat/organiser-r1` (9807a497).

**Verdict: NOT ready.** The merge is clean. S4 brings three red gates: `lint:architecture`, `check:images` and 7 e2e specs. On top of that, the festival open item is CONFIRMED on prod data. All four defects are in S4 or S1 code, so per the brief they are listed below and not fixed here.

## 1. Merge result

Plain `git merge`, in order. Each merge conflicted ONLY in `shell/OrganiserRoutes.tsx` and `shell/__tests__/routes.test.tsx`, as the brief expected. Nothing else was edited.

| Merge | Head | Commit |
|---|---|---|
| S1 `claude/org-r1-home` | eb0f25d2 | fast-forward |
| S2 `claude/org-r1-change` | 08525886 | b09a83fb |
| S3 `claude/org-r1-addcancel` | 07d73caa | 03ed315b |
| S4 `claude/org-r1-new` | 62745427 | d925c256 |

How the conflicts were resolved:
- In `OrganiserRoutes.tsx`, each lazy import takes its own slice's real target: `../switch`, `../flows/change`, `../flows/add`, `../flows/cancel`, `../flows/new`. The route table keeps every real route from every slice. That is 25 R1 paths plus 3 legacy redirects plus `*`. There are no duplicate paths. `NewEventPage` is gone.
- In `routes.test.tsx`, the S2 describe and the S3 describe are both kept. The rows each slice moved out of "placeholder" are dropped. The `/done` assertion was duplicated across the slices; it is kept once in the S2 describe, plus S1's row in the main-screens table.
- `git grep` finds no conflict markers.

## 2. CI table (local, this sandbox, HEAD d925c256 before the doc commit)

These are all the steps of `typecheck`, `architecture-guard`, `unit-tests`, `perf-budget`, `workflow-lint`, `db-contract-check` (the offline step) and `e2e-smoke`. Columns: command, exit code, time.

| Command | Exit | Time |
|---|---|---|
| `typecheck` | 2 | 55s |
| `check:rpc-typing` | 0 | 1s |
| `check:wallclock-brand` | 0 | 36s |
| `check-integrity` | 0 | 11s |
| `check:legacy-tables` | 0 | 0s |
| `check:legacy-program-rpcs` | 0 | 1s |
| `lint:architecture` | **1** | 0s |
| `check:images` (AUDIT_STRICT=1) | **1** | 1s |
| `check:image-widths:self-test` | 0 | 0s |
| `check:image-widths` | 0 | 0s |
| `check:plan-hygiene:self-test` | 0 | 1s |
| `check:workflow-artifact-policy:self-test` | 0 | 0s |
| `check:workflow-artifact-policy` | 0 | 1s |
| `check:mojibake:self-test` | 0 | 0s |
| `check:mojibake` | 0 | 0s |
| mojibake `git grep` (architecture-guard step) | 0 | 0s |
| `prove:entry-point:self-test` | 0 | 0s |
| `prove:entry-point` | 0 | 9s |
| `lint-workflow-masking` | 0 | 0s |
| `lint-workflow-notification --self-test` | 0 | 1s |
| `lint-workflow-notification` | 0 | 0s |
| `check-dancer-area-isolation --self-test` | 0 | 1s |
| `check:dancer-area-isolation` | 0 | 1s |
| `check-migration-stamps` | 0 | 0s |
| `npm run lint` | **1** | 53s |
| `test:unit:offline` | 1 | 214s |
| `test:unit` (full) | 1 | 203s |
| `test:unit:timing` | 0 | 6s |
| `check:bundle-budget:self-test` | 0 | 0s |
| `check:first-load-requests:self-test` | 0 | 0s |
| `check:chunk-cycles:self-test` | 0 | 0s |
| `npm run build` (production) | 0 | 31s |
| `check:bundle-budget` | 0 | 1s |
| `check:first-load-requests` | 0 | 0s |
| `check:chunk-cycles` | 0 | 0s |
| `check:doc-weight` | 2* | 0s |
| `test:e2e` | **1** | 7.4m |

What each non-green row means:
- **typecheck:** 96 errors on base `feat/organiser-r1` and 96 on integrate, with an identical per-file distribution. **No new errors.** The message-scoped gate in CI is `check:wallclock-brand`, which is green.
- **lint:architecture:** 4 violations, all from S4 (finding F1).
- **check:images:** 1 violation, from S4 (finding F2).
- **lint:** 1 of 18 links is red, and that link is `lint:architecture`. Eslint is skipped behind it, as the chain designs.
- **test:unit:offline:** 8541 passed, 5 failed. All 5 are in `tests/integrityCouldNotRun.test.ts`. They fail identically on base in this sandbox (5 failed / 62 passed on base), so they are an environment issue, not R1.
- **test:unit (full):** 8571 passed, 15 failed. These are the same 5, plus 10 `*.contract.test.ts` that need live-DB secrets. Those secrets are absent here.
- **check:doc-weight:** needs `GITHUB_REPOSITORY` and a preview deploy, so it cannot run in this sandbox.
- **test:e2e:** 137 passed, 10 failed, 1 skipped. Base fails 3 of these 10 too (`organiser-loop`, `organiser-events:257` schedule card, `dancer-app/home-nights`), so those are pre-existing. The **7 new failures are all S4** (finding F3).

## 3. Cross-slice findings

**F1 -- S4 trips `no-legacy-organiser-fields`.** The rule bans the literal `organiser_ids`. It appears at:
- `src/modules/organiser/flows/new/model.ts:26` (a comment)
- `src/modules/organiser/flows/new/__tests__/NewFlow.test.tsx:90`, `:92` and `:151` (assertions)

Fix: reword the comment, and have the tests assert the payload key through the same constant or builder that `createSeriesCommand` uses, rather than spelling the banned literal. Adding the files to `allowFiles` is a guard change and needs the owner's approval.

**F2 -- S4 image has no `loading`.** At `src/modules/organiser/flows/new/NewFlow.tsx:279`, the cover preview `<img>` has no `loading` attribute. Fix: add `loading="lazy"` (or `"eager"`, since it is above the fold on C24).

**F3 -- S4 retired `NewEventPage` but left its e2e specs.** These specs still open `/account/o/events/new` and drive the old testids (`org-page-new-event`, `org-new-event-name`, `org-new-event-create`):
- `tests/e2e/organiser-events.spec.ts`: lines 15 and 64, the 390 and 360 runs of line 96, and line 267
- `tests/e2e/organiser-layout.spec.ts`: lines 79-80 and 174

Fix: rewrite them against the S4 one-question flow (`/account/o/new/what`, `org-new-*` testids), or retire them in favour of S4's own specs. Either way, update the `test:e2e` list by name.

**F4 -- CONFIRMED: a festival's `no_dates_left` Home row opens a C8 with every day disabled.**
- `src/modules/organiser/jobs/homeJobs.ts:39` pushes `no_dates_left` for any live series where `upcoming_count <= 0`, festivals included.
- That row links to `ORG_PATHS.addEvent(id)` (`homeJobs.ts:72`).
- There, `festivalHeld` (`flows/add/addModel.ts:84-87`) returns true as soon as the festival holds any date, past included. So `addDays` gives every day the reason "A festival has one date".

Prod read-only count, 2026-10-17: 7 live festivals; 1 has no coming date and does have a (past) date. That one shows this dead end today.

Fix (one sentence): in `seriesProblems` (`homeJobs.ts:39`), skip `no_dates_left` for `format === 'festival'` (or route it to the event editor instead). This needs an owner decision on what a finished festival's Home row should say.

The other cross-slice checks pass:
- **Home links resolve.** Every Home link target is a real route after the merge: the homeJobs rows `change`, `add`, `cancel`, `addEvent`, `event`, `cover`, `newWhat`, `page`, `team` and `teamAdd`, the small buttons `team`, `page`, `events` and `more`, and the switch link (C35). `cover/:seriesId`, `team/add` and `more` still render S6/S7 placeholders, by design until those slices land.
- **Done wiring is single, not duplicated.** S2 (`flows/change/useChange.ts:78`), S3 (`flows/add/Time.tsx:77`, `flows/cancel/Confirm.tsx:102` and `:156`) and S4 (`flows/new/NewFlow.tsx:274`, `useNewSend.ts:48`) all call the one `goDone` in `flows/doneState.ts`. There is one `done` route and one `DonePage`.
- **Nothing imports the deleted `NewEventPage`/`newEvent`.** What is left:
  - `ORG_PATHS.newEvent` is kept as `@deprecated`. It is the legacy `/account/o/events/new` path, which redirects to `new/what`.
  - Two live callers still use it: `events/EventList.tsx:54` and `edit-in-place/parts.tsx:223`. Both work through the redirect.
  - The comment at `edit-in-place/parts.tsx:219-221` still names `NewEventPage`. It is stale wording only.

## 4. Verified / Not verified

**Verified (in this sandbox):**
- The merge; the route table; no conflict markers.
- Every CI step above, with the exit codes shown.
- Typecheck parity with base.
- Production build plus the bundle, request and chunk budgets.
- Offline unit tests: only the base-identical environment failures remain.
- e2e attribution, by running the failing specs on base.
- The festival dead end, in code and on the prod count (read-only).

**Not verified:**
- The live-DB `*.contract.test.ts` (no secrets here).
- `check:doc-weight`, `check:lighthouse` and `check:og` (they need a preview deploy).
- No PR was opened (the brief does not ask for one), so no GitHub check run results.
- No real-phone or real-account browser walk, no e2e against prod credentials, no live cover upload to storage.
- The 3 e2e failures that are red on base too were not root-caused. They are pre-existing and outside R1's scope.

## Next steps

1. Send S4 a fix pass for F1 to F3.
2. Get the owner's decision on F4, then a one-line S1 change.
3. Re-run this integration after both.
