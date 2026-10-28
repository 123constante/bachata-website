# Review: Website PR #1099 (ambassador A1 follow-up, F1-F6 of review r3 on #1086) at head `be77e3f`

Reviewer: independent model (Fable), zero prior context, read-only on source. Diff reviewed: `git diff origin/main...origin/claude/ambassador-a1-followup` (8 files, +353/-113; base `bdcc9bf`). Read in full at the PR head: `AmbassadorQueuePage.tsx`, `ambassadorApi.ts`, `ambassadorModel.ts`, `QueueViews.tsx`, `DecisionSheets.tsx` (untouched by the diff, read for the tick and focus questions), the matrix test diff, the e2e spec diff, the handover, the design record, the r3 review and the PR body. Live (read-only, prod `stsdtacfauprzrdebmzg`, 2026-10-28): the bodies of `admin_list_pending_review_v1`, `_moderate_entity`, `_is_city_ambassador`; counts only. Local, on a worktree at `be77e3f`: the ambassador matrix (62 of 62) and two ad-hoc probes written for this review (not committed, described under F1). Browser not run here (CI `e2e-smoke` is green at this head; the handover reports the ambassador spec 15 of 15 at 390x844).

Source of truth, proved first:

- `admin_list_pending_review_v1(p_target_type, p_city_id, p_limit DEFAULT 100, p_offset DEFAULT 0)`: a non-admin with no `entity_members` row (`member_role = 'ambassador'`, `entity_type = 'city'`) gets `admin_only`; rows are filtered per row by `_is_city_ambassador(q.city_id, v_actor)`; the query ends `ORDER BY q.submitted_at DESC NULLS LAST LIMIT GREATEST(COALESCE(p_limit, 100), 1) OFFSET GREATEST(COALESCE(p_offset, 0), 0)`. Newest first, no tie-break column. `submitter_email` is `NULL` for a non-admin.
- `_moderate_entity` check order: `authentication_required` (no uid) -> `unsupported_target_type` -> `not_authorised` (non-admin AND (target row missing OR not `_is_city_ambassador(v_city, v_actor)`)) -> `target_not_found` (admin only, in practice) -> `self_approval_not_allowed` (non-admin party) -> `not_pending_review` -> update + audit. Matches the handover word for word.
- Counts: 0 city ambassadors, 0 pending organisers, 0 pending series, 0 pending rows with a null `updated_at`. The route is dormant.

This is the one independent review of this round (stopping rule from the brief). No source edits, no DB writes.

## Verdict: PASS with should-fix

Nothing blocks merge. F1-F6 of r3 are closed as described, the new matrix cases assert behaviour the unfixed page cannot produce, the e2e F2 case is real, the overlay geometry and the submitter-email guard are untouched, and the module is still reached only through the lazy route, so the `/app` first load cannot have moved. One should-fix (F1 below) is the F2 fix doing the wrong thing in the one case the brief asked about: an ambassador removed from the city entirely. The rest are nits.

## Findings, most severe first

### F1. An ambassador removed from every city after the list loaded sees "This one has changed" and then "Could not refresh" forever, never the no-access page

- Where: `src/modules/ambassador/AmbassadorQueuePage.tsx:145-151` (the F2 branch) and `:172` (`queue.isError && items.length === 0`).
- What is wrong: the decision RPC cannot tell "this item moved" from "you are no longer an ambassador" (both are `not_authorised`), so the page guesses "changed" and refetches. The refetch CAN tell: the list RPC raises `admin_only` for a person with no ambassador row. The page ignores that answer whenever rows are still on screen: `useQuery` keeps the last data on error, so `items.length` is not 0, the body stays on the list, and `QueueList` shows "Could not refresh. Showing the last list." with a Try again that can never succeed. Every further Approve or Reject repeats the "changed, taken off your list" toast and drops one more row. The person learns they were removed only when the list happens to empty, or on a reload.
- Concrete failing input (probed here in jsdom with the matrix harness, not committed): two rows loaded; an admin deletes the person's `entity_members` row; Approve, Yes on row 1. Toast "This one has changed and is no longer yours to decide. It has been taken off your list."; list of 1 with "Could not refresh. Showing the last list." + Try again; `queue-no-access` absent. With ONE row loaded the same probe reaches "No access to this queue", by the accident of `items.length === 0`, and shows it under the "changed" toast for 3.5 s (contradictory copy, minor).
- Same gate, second shape: a session that expires while rows are on screen (`loadErrorKind` = `auth`) shows "Could not refresh" instead of the signed-out state with its Sign in link; the decision sheet does say "Sign in", so this one is a copy mismatch, not a dead end.
- Severity: fix before arc end. Not blocking: 0 ambassadors today, removal is an admin action, and a reload shows the right page. CONFIRMED by the probe.
- Fix (one line plus a matrix case): show the full-page state for an access or auth refetch error even with rows on screen, e.g. `else if (queue.isError && (items.length === 0 || loadErrorKind(queue.error) !== 'other'))`; keep the stale line for `other` only. Suppressing the "changed" toast when the refetch then says no access is optional polish.

### F2. Pages are concatenated without dedupe, over OFFSET paging with no tie-break, so a queue that moves between two page requests shows a row twice (or drops one)

- Where: `src/modules/ambassador/ambassadorApi.ts:37-53` (`fetchCityQueue` / `fetchQueue`); the RPC orders by `submitted_at DESC NULLS LAST` only.
- What is wrong: for a city over 100 rows the page now ALWAYS issues 2+ sequential requests at `p_offset` 0, 100, ... If a submission lands (or a decision, or an edit that bumps `updated_at`) between request 1 and request 2, every row shifts by one: the last row of page 1 is also the first row of page 2 (same `key`, two `<li>`s, React duplicate-key warning, count off by one) or one row is skipped until the next refetch. Equal `submitted_at` values with no secondary order can produce the same across pages regardless of writes.
- Concrete failing input: 101 pending in Bristol; an organiser submits while page 2 is in flight; list shows 102 rows with one name twice, count 102, until the 60 s focus refetch.
- Severity: nit (needs a 100+ city and a write inside one round trip; self-healing). CONFIRMED by reading (no dedupe anywhere between the RPC and `items.map`). Fix: dedupe by `key` in `fetchQueue` (a `Map`), four lines; the tie-break belongs in the admin repo (`ORDER BY submitted_at DESC NULLS LAST, target_id`).

### F3. The `items.some(...)` guard on the F2 branch is a tautology, and the `access -> sheet error` branch it protects is now unreachable

- Where: `AmbassadorQueuePage.tsx:145`. `v.item` is `sheetItem`, which the same render found in `items`; `useMutation`'s `onError` is captured at `mutate()` time, so it closes over that very `items`. The guard is always true from the sheets, the comment claims a distinction the code cannot make, and the only place `kind: 'access'` still reaches `setSheetError` is nowhere. The diff deleted the two matrix cases (`42501 permission denied`, `not_authorised` -> "do not have access", item stays) that would have shown this.
- Severity: nit. CONFIRMED by reading. Either drop the guard and say "access from a decision always means changed" in the comment, or keep the guard only if a non-sheet caller is planned.

### F4. A stale `sheetError` can show on the next sheet (pre-existing, more reachable now)

- Where: `AmbassadorQueuePage.tsx:62-63, 194-195, 226-231`. The sheets render only while `sheetItem` is found in `items`. If an `other` error is on screen (sheet open, "Try again") and a background refetch drops the item (someone else decided it), the sheet unmounts WITHOUT `closeSheet`: `sheet` and `sheetError` survive. `onApprove` / `onReject` set a new `sheet` but never clear `sheetError`, so the next sheet on another item opens with "That did not go through..." and a "Try again" label.
- Severity: nit; present in #1086, more reachable now that F2, F3 and the focus refetch refetch more often. PLAUSIBLE (not run). Fix: clear `sheetError` where the sheet is opened, or key the sheet on `sheet.key`.

## The brief's judge items

### 1. F1 `fetchQueue`: CONFIRMED correct for every shape asked, with F2 above as the one gap

- Offsets: `0, 100, ... 900` (`for (offset = 0; offset < 1000; offset += 100)`), 10 requests at most per city; `p_limit` 100 each. A page under 100 rows ends the city (`capped: false`). Exactly 100 rows: one extra empty request at offset 100, then 100 rows, no cap note (matrix case pins `[0, 100]`). 10 full pages: 1000 rows, `capped: true`, the bar says "Oldest loaded", `capText` says "At least 1000 ... only the 1000 most recent ... older ones are not shown". A city with exactly 1000 reads the same ("at least"), as the handover says. 0 rows: one request, `[]`, no error.
- Cities in parallel (`Promise.all` over `cityIds`), pages per city sequential: matrix pins `Bath@0, Bristol@0, Bristol@100` for 30 + 100 rows. `cappedCityIds` is the list of city ids that hit the cap; the page maps them to names through `scopes.data` and passes `capText` to the list.
- Error mid-way: `fetchCityQueue` throws on the first failed page; `Promise.all` rejects; the query is in error as a whole. First load: `ErrorState` with Try again (after the app's one retry, which re-runs every page). Refetch: the previous whole list stays (`useQuery` keeps data) under the stale line. A partial list is never rendered: the matrix case holds page 2 and asserts the skeleton and 0 rows until it resolves.
- Age bar and "Oldest loaded": true. Under the cap the whole queue is loaded, so `oldest` over `items` is the real oldest. At the cap the bar reads "loaded", and the note says older ones are missing. The chips are per row and always true.
- First paint on a slow phone: 0-99 rows is one request per city, unchanged. 100-199 is two sequential round trips of a query with four lateral joins; acceptable for the realistic queue (prod: 0), and the skeleton with "Loading the queue..." covers it. Worth knowing: the 60 s stale + focus refetch and the one retry each pay the full page count again. Not a finding.

### 2. F2: closes the r3 finding; the "removed entirely" case is F1 above

- Reachable only from `decide.onError` (the only caller of `decisionError`), only for `kind === 'access'`, and only via the sheets (`decide.mutate` is called from `ApproveSheet`/`RejectSheet` alone). `loadErrorKind` and the list-level access state are untouched.
- No double toast: the branch sets one toast and returns; `onSuccess` is not involved. `sheetError` is cleared by `takeOff` -> `closeSheet`. Review-route state: `takeOff` calls `backToList()` when in the review, so the URL returns to `/ambassador` (e2e asserts it) and `review-gone` never flashes for this path. `party` is not touched (correct: the item is gone).
- Should the no-access page show instead? For "item moved or deleted" no: the person keeps their queue. For "removed from the city entirely" yes, and the refetch has the information; see F1 for why it is thrown away.

### 3. F3-F6: CONFIRMED

- F3: `refreshQueue()` after the party refusal (`:136`); matrix case shows the second list call and the item dropping to `review-gone` then "All caught up". The `findByTestId('party-note').catch(() => undefined)` in that case is swallowed, but the assertions after it carry the test, so it cannot pass vacuously.
- F4: "Not in your queue" / "This one is not in your queue. Go back to the list to see what is waiting for you." + Back to the list (`:198-205`); the matrix asserts the absence of "decided" and "no longer waiting".
- F5: `setInterval(60_000)` in a mount effect with `clearInterval` cleanup (`:57-60`); `now` flows to `QueueList` (bar recount over `items`) and `Chips` (per row) and `ReviewView`. The `queue-stale` line renders only inside `QueueList`, i.e. only with rows on screen (`:184`, `:104-111`); Try again is `disabled={stale.retrying}` with `queue.isFetching`, label "Trying..." while disabled; `min-h-[44px]`. The matrix tick case fakes `Date` + `setInterval`, advances 60 s and asserts the chip goes from "Waiting 1 day" to the warning + "Waiting 8 days" and the bar to 8: red on the unfixed page (the handover's mutation record agrees).
- F6: `grep -P '[^\x00-\x7F]'` over the module, its tests and the spec: no hits. The middle dot and the warning sign are `·` / `⚠` escapes.

### 4. Regressions vs #1086: none found

- Scroll restore after Back: unchanged code (`:86-104`); `[reviewing]` is the only dependency, so the minute tick does not re-run it.
- Overlay geometry, focus `preventScroll`, portals, reject-needs-reason, double-tap safety: `DecisionSheets.tsx` is not in the diff; the sheets are still portalled to `body`, focus effects have `[]` deps (mount only), both buttons `disabled={busy}`, `checkReason` still refuses under 10 characters client-side. The geometry e2e is unchanged and green.
- The 60 s re-render: `items` is memoised on `queue.data`, so `sheetItem` and `current` keep their identity; the sheets do not remount (same tree position, no key change), the typed reject reason is `RejectSheet` local state and survives, focus is not touched (no effect depends on `now`), and nothing scrolls (`scrollTo` runs only on the `reviewing` edge). The one thing that re-runs each tick is `SheetShell`'s keydown effect (its `onClose` is a fresh function every render), a harmless re-subscribe. CONFIRMED by reading.
- Deep link: `parseReviewPath` unchanged; outside-queue copy is F4.
- Submitter email: `parseQueueRow` still has no email field; the live RPC still emits `NULL` for a non-admin; the e2e assertion that the page never contains the stub email is unchanged.

### 5. Bundle: 0 bytes on `/app`, CONFIRMED by construction

The only importer of `src/modules/ambassador/**` outside the module is `lazyWithRetry(() => import("@/modules/ambassador/AmbassadorQueuePage"))` in `AnimatedRoutes.tsx` (unchanged in this diff), so every changed byte lives in the lazy chunk. `perf-budgets.json` and `vite.config.ts`: no diff. CI `bundle-budget` green at `be77e3f`; the handover's numbers (373.6 KB / 49 files on both heads, shell chunks byte-identical, module chunk 8301 -> 8148 B gzip) are consistent with that. The one way the logic could be wrong is a new static import of the module from the shell, and there is none. Build not re-run here.

### 6. Tests: the new cases fail on the unfixed code; nothing is vacuous

- 101-row case: asserts `queue-loading` present and 0 rows while page 2 is held, then 101 rows with the 30-day item on top and the bar at 30, and no "Show more": the unfixed page rendered 100 rows after page 1 and the bar at 2 days. Real.
- Exactly-100 and 1000-cap cases: assert the exact offset list and `capText`; the cap case also asserts "Oldest loaded". The cap case asserts the note equals `capText(['Bristol'])` AND contains the honest phrase, so the copy is pinned twice (string plus function), fine.
- F2 cases (`not_authorised`, `not_authorized`, `42501 permission denied`): assert the exact toast text as a literal AND as `CHANGED_MESSAGE`, dialog gone, `decision-error` gone, review gone, 1 row left not named the decided one, 2 list calls, 1 decision. On the unfixed page the sheet stayed open with the access copy, so `findByTestId('toast')` times out. Real.
- F3 case: 2 list calls then `review-gone` then "All caught up": red on the unfixed page at the second list call.
- Tick case and stale case: described under item 3; the stale case toggles `focusManager` to force the focus refetch and asserts the line, the kept row, and the line clearing after a good Try again.
- E2E F2 case: the stub removes the item from the queue AND answers `not_authorised`, matching the live order; asserts toast text, no dialog, no `decision-error`, URL back at `/ambassador`, 11 rows, count 11, and the one request body sent. Real; red on the unfixed page as the handover says.
- No assertion that cannot fail was found. The deleted "item stays" cases for `access` are the right deletion given the new behaviour (see F3 for what their deletion hides).

### 7. Known gaps: none bites

S1/S2/N1/N2, the daily publish gate on review-city go-live, no decision emails, client-only noindex on `/ambassador`, no party flag in the list RPC: unchanged by this PR and dormant at 0 ambassadors.

## Gates seen

| Gate | Result |
|---|---|
| `vitest run src/modules/ambassador` at `be77e3f` (TZ Europe/London) | 62 passed |
| Ad-hoc probes (removed ambassador, 1 row and 2 rows) | run, results under F1; not committed |
| CI at `be77e3f` (read 02:12 UTC) | green: `unit` x3, `e2e-smoke`, `integrity`, `bundle-budget`, `build-smoke`, `live-db-gate`, `dancer-area-isolation`, `wallclock-brand`, `masking-check`, `bom-check`, `notification-check`, `no-preview-reason` x4, `open-pr`, `decide` x2, and the re-runs of `real-data-verified` and `phone-qa-section` after the body edit (their first runs failed before the body carried the sections); `phone-qa` in progress; `contract-check` red |
| `contract-check` | red on `main` before this PR (r3 recorded four red `main` runs; the handover names the live OG health check); not this PR's |

## Not reviewed / not verified

- A browser walk at this head (CI `e2e-smoke` and the handover's 15 of 15 stand in); F1's 101-row list and the F5 stale line in a real browser; real iOS Safari / Android Chrome; the on-screen keyboard over the Reject sheet; screen readers.
- A live ambassador session (none exists on prod).
- The production build and `check:bundle-budget` at this head (CI green; argument under item 5).
- The full `npm run lint` chain, `pre-ship`, `typecheck` at this head (the handover reports them; nothing in the diff touches a guard's input).
- `phone-qa` (still in progress when read) and which step reds `contract-check`.
