# Brief: skip-door sheet refetches failed night loads (open problem P46)

Repo: bachata-website. Branch: claude/skip-door-refetch (from main). One PR.
Size: 2 files, 60 lines

## Bug
`src/modules/organiser/p3/v2/TicketsV2.tsx` ~line 418-422, 481, 516.
The skip-door sheet needs every coming night loaded (`nights = useQueries(...)`).
Those queries are already `enabled` in the background when the run has a door payment.
If one of those background loads failed earlier, tapping Choose/Change (`skipDoor: () => setSkipOpen(true)`)
does NOT refetch, because `enabled` was already true. `nightsFailed` is true at once,
so the effect closes the sheet straight away and shows the `nightsLoadFail` toast. The organiser can never open it.

## Fix (keep it this small)
1. In the `skipDoor` handler: before `setSkipOpen(true)`, reset every night query that is in error, so it goes back to loading and fetches again:
   `coming.forEach((d, i) => { if (nights[i]?.isError) void qc.resetQueries({ queryKey: dateDetailQueryKey(d.id), exact: true }); });`
   (`qc` is the existing `useQueryClient()`; `coming` and `nights` share the same order.)
2. `nightsFailed` must only fire for a load that failed AFTER the sheet opened: change it to
   `rebuild && skipOpen && nights.some((q) => q.isError && !q.isFetching)`.
3. Nothing else changes: same toast, same copy, same save path, no flag (bug fix to an existing flow).

## Test
Add one case to `src/modules/organiser/p3/v2/__tests__/skipDoorSheet.test.tsx` (or the closest existing TicketsV2 test that mounts the skip door; read it first and copy its mocks):
a night fetch fails once, then succeeds; tap Choose -> the sheet opens (no `nightsLoadFail` toast). Keep the existing "fails while open -> toast + close" behaviour covered.

## Done when
- tsc: no new errors in touched files; the touched test file passes.
- PR body: what changed, the test, "no behaviour change except the retry".
