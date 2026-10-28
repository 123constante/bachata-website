# Handover: ambassador A1 follow-up (F1-F6 of review r3 on #1086)

Branch `claude/ambassador-a1-followup` from `main` at `bdcc9bf`. Website only. No DB change, no admin-repo change, `perf-budgets.json` and `vite.config.ts` untouched. Design record: `docs/design/ambassador-a1-followup.md`.

## Data source, proved first (read-only, prod `stsdtacfauprzrdebmzg`, 2026-10-28)

- `admin_list_pending_review_v1(p_target_type text DEFAULT NULL, p_city_id uuid DEFAULT NULL, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)`: non-admins need an `entity_members` city-ambassador row (else `admin_only`); rows filtered per row by `_is_city_ambassador(q.city_id, v_actor)`; ends `ORDER BY q.submitted_at DESC NULLS LAST LIMIT GREATEST(COALESCE(p_limit, 100), 1) OFFSET GREATEST(COALESCE(p_offset, 0), 0)`. NEWEST first, confirmed. `submitter_email` is NULL for a non-admin.
- `_moderate_entity` check order: `authentication_required` (no uid) -> `unsupported_target_type` -> **`not_authorised`** (non-admin AND (target missing OR not ambassador of its city)) -> **`target_not_found`** (only reachable by an admin) -> **`self_approval_not_allowed`** (non-admin party) -> **`not_pending_review`**. So for an ambassador a gone or moved item is `not_authorised` (F2), and a party item decided by someone else is `self_approval_not_allowed` (F3).
- Counts today: 0 city ambassadors, 0 pending organisers, 0 pending series. The route is dormant; every shape below is a stub.

## F1 choice: (a), load every page before rendering, cap 1000 rows per city

Why (a) over (b): (b) would make every claim true but keep the design's promise broken (an ambassador still could not see the oldest item without paging, and the bar would say "Oldest loaded"). (a) keeps the page's one job, oldest on top, true for every realistic queue. First paint cost: requests per city are sequential, one per 100 rows, cities in parallel. 0-99 rows: 1 request (unchanged from before). 100-199: 2. Measured with the 101-row stub in the matrix test: skeleton stays up while page 2 is held, list appears with 101 rows the moment it resolves; nothing paints a partial list. The cap (10 pages, 1000 rows per city) exists so a runaway queue cannot loop forever; when hit, the bar says "Oldest loaded" and a note says honestly that older ones are not shown. "At least 1000": a city with exactly 1000 is not probed again and reads the same.

`useInfiniteQuery` is still not used; the manual paging, `fetchNextPage`, `moreText`, "Show more" and the `InfiniteData` cache shape are gone. Cache shape is now `{ items, cappedCityIds }`.

## F2-F6

- F2: page-level, in `decide.onError`: an `access` error on an item that is in the served list -> take off, toast `CHANGED_MESSAGE`, invalidate the queue. `decisionError` itself is unchanged (still `access`), so the mapping stays one place and the list-level `loadErrorKind` is untouched.
- F3: party refusal also invalidates the queue.
- F4: neutral review-gone copy.
- F5: `now` ticks every 60 s; `queue-stale` line + Try again when `queue.isError` with rows on screen.
- F6: test file ASCII (backslash-u escapes for the middle dot and the warning sign).

## Red first

- Matrix: 12 new or changed cases run against the unfixed page: 12 failed (F1 101-row: one list call, 100 rows; F2: decision-error stayed; F3, F4, F5 as expected). After the fix: 62 of 62.
- E2E F2 case against the unfixed page: failed (toast never showed the changed copy). After: passes.
- Mutation: minute tick made a no-op -> the tick test goes red.

## Checks run (local)

| Job / step | Result |
|---|---|
| unit, London full (`test:unit:offline`) | 17611 passed, 5 failed: all in `tests/integrityCouldNotRun.test.ts`, which fails identically (5) on a clean `main` worktree here; sandbox-specific, not this diff |
| unit, London `test:unit:timing` | 65 passed |
| unit, New York / Sydney tz lists + `src/modules/ambassador` | 280 / 280 passed each |
| e2e-smoke (`npm run test:e2e`, warmed Vite) | 161 passed, 8 skipped, 1 failed: `dancer-home.spec.ts:169` "Execution context was destroyed" (navigation race, untouched spec); rerun 3 of 3 pass |
| ambassador e2e `--repeat-each=3` (390x844, includes overlay-geometry test) | 15 passed |
| integrity (check-integrity, legacy-tables, legacy-program-rpcs, lint:architecture, `AUDIT_STRICT=1 check:images`, plan-hygiene self-test, mojibake self-test + guard, prove:entry-point + self-test, going-legacy-rpcs + self-test) | all exit 0 |
| typecheck job (`check:rpc-typing`, `check:wallclock-brand`) | exit 0 |
| workflow-lint (masking, notification, no-preview-prefixes); bom-check (no workflow touched) | exit 0 |
| dancer-area-isolation | exit 0 |
| perf-budget: build, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` on main and branch | all ok; dancer-app first load 373.6 KB / 49 files on both; `root` and `AnimatedRoutes` raw bytes identical (only content-hash names differ); `AmbassadorQueuePage` chunk 8301 -> 8148 B gz. 0 bytes added. |
| eslint on changed files | same messages as `main` (the pre-existing harness `static-components` error, refresh warnings) |
| `tsc -p tsconfig.app.json` | no error in the ambassador module (the repo's pre-existing errors elsewhere unchanged) |

`contract-check` is red on `main` (live OG health check): not this PR's.

## Not verified

- No live ambassador session (0 on prod); all shapes are stubs.
- F1 in a real browser at 101+ rows (matrix test only; e2e stubs 12 rows). First paint on a slow phone network with 2+ sequential requests not measured.
- F5 tick and stale line in a browser (unit only).
- Real iOS Safari / Android; keyboard over the Reject sheet; screen readers.
- `/code-review` not run by the worker; the independent review is the next step per the stopping rule (one review, one fix round, then the orchestrator walk).

## Next steps

1. Independent review of this PR.
2. One fix round.
3. Orchestrator walk at 390x844 (F1 with a 101-row stub, F2 toast, F4 deep link).
