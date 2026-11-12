# Review: PR #1584 (organiser Events tab core), head 78f5094

**Verdict: FIX**

1. The "Every night" bulk cancel (`occurrence.bulk_cancel`) refreshes the same set as Change dates, reads older pages of dates, and the version-conflict "Reload the event" does refetch the event. But the idempotency key never changes after a conflict or a failed send: `setKey` is declared and never called. The handover says Reload uses "a fresh idempotency key". It does not.
2. With `flags.organiserDash` off, the existing Events screen is unchanged. Contributor seats are view-only: Cancel is disabled with its reason shown, there is no Delete, and the link reads "Open". Loading, error, empty, all-past and no-match states each give the person something to do.
3. The walk shots are 390x844 and show the states they are named after. The "conflict-after-reload" shot is byte-identical to "every-night-confirm", so it cannot show that a new version was picked up.

One review round (risky class). `contract-check` red is inherited from main (P5 drift) and is not counted as a finding.

## Findings

### F1 (must fix): the idempotency key is not rotated after a conflict or a failed send
- `src/modules/organiser/p3/events/DashEvents.tsx:33`: `const [key, setKey] = useState(newIdempotencyKey);`. Nothing calls `setKey`.
- `src/modules/organiser/p3/events/DashEvents.tsx:65-69`: `reload()` refetches the event and clears the conflict, but keeps the old key.
- `src/modules/organiser/p3/events/DashEvents.tsx:48`: the retry sends the new `version` (and maybe a new `ids` list) with the old key.
- **How I checked:** I added a probe test to `dashEvents.test.tsx` locally and did not push it. It goes conflict, then Reload, then Confirm, and both `runBulkCommand` calls got the same key (`7efd6f18-...` both times).
- **Why it matters:** the house rule is in `docs/design/1068.md` #3. The server looks keys up by (actor, key) only and replays the stored success whatever the envelope says, so a key must be per (version, command) and dropped after any failure that is not a network error. Today a refusal stores no row, so the conflict path does no harm yet. The real risk is a send that lands but loses its response: `finally` invalidates the workspace, the version goes up, and the next tap carries the same key, so the server replays the old answer for a different set of nights.
- **Fix:** call `setKey(newIdempotencyKey())` in `reload()` and in the non-network `catch`. Or key by `${version}|${JSON.stringify(command)}` the way `sessions.ts useEverySend` does.
- **Test gap:** `__tests__/dashEvents.test.tsx:139` says "returns to the confirm with the new version" but never sends a second time. Add one: after Reload, Confirm sends a key different from the first and the refetched `expected_version`.

### F2 (minor, evidence): the post-Reload walk shot proves nothing
- `docs/design/profile-dash/shots/organiser-events-walk-conflict-after-reload.png` has the same blob as `organiser-events-walk-every-night-confirm.png` (926e471). In `tests/e2e/walk-p3-organiser-events.spec.ts:49-62` the fake never bumps the series version or changes the nights, so the shot cannot show the new version or a changed count. Either bump the version or add or cancel a night in the fake before Reload, or drop the claim from the handover.

### F3 (nit): the conflict sheet has two Close controls
- `src/modules/organiser/p3/events/DashEvents.tsx:82` adds a "Close" button under the Sheet's own header "Close" link (see the `walk-conflict` shot). One is enough.

### F4 (nit): an unknown role gets write controls
- `src/modules/organiser/p3/events/DashEvents.tsx:201`: `page.role as Seat` treats any value other than `'contributor'` as able to write, including undefined or a future role. Safer to default to view-only: `role === 'owner' || role === 'manager' ? role : 'contributor'`.

## Checked, no finding
- Refresh set after a bulk send (`DashEvents.tsx` `finally`) matches `flows/change/Pick.tsx:88-94` line for line: series workspace, event workspace, home, date detail, programme, public caches.
- The cancel list reads every date: `CancelNightLoaded` pages older dates through `useOlderDates`/`withOlder`. While loading it shows a sheet; if that read fails it says "Nothing has changed" and offers Try again. Pending, error and incomplete all stop the cancel.
- `EventsScreen.tsx`: the new branch is `flags.organiserDash && scope.selected`. With the flag off, the existing code path is untouched.
- Contributor seat (`eventsModel.ts:121-151`): every Cancel goes through `gate(WHY.contributor)`, `canDelete` is false, and the view banner explains why.
- Disabled controls (New event, Cancel, Duplicate) each have `aria-describedby` pointing at visible text. Delete draft shows its load error and links it with `aria-describedby`.
- `vitest src/modules/organiser/p3/events`: 4 files, 48 tests, all passed on 78f5094.
- The walk shots (normal, empty, huge, error, conflict) are all 390x844 with no horizontal scroll, and match what the spec asserts.

## Not verified
- I did not do a browser walk on prod-shaped data. I did not run the full pre-ship or the per-job CI table, and I made no Supabase read.
