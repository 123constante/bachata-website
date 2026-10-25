# B1b festivalClientState fix: handover (PARTIAL, not fixed)

## What changed
Docs only (this file). No product code changed: the failure was NOT reproduced, so no fix was made.

## Findings
- CI run 39046317520 log: the assertion that fails is `tests/client/festivalClientState.test.tsx:733`,
  `expect(openDay(container)).toBe(2)` -- the SETUP click on day tab 2, BEFORE `navigateTo` runs.
  Received 0 = the click was dropped and the day reverted to the seed.
- That is the race the file's own `mountFestival` comment documents: a lazy `PageTransition` chunk
  (`app/InitialVisiblePageTransition.tsx`, module-scoped `clientNavigated` set by earlier cases) resolves
  after the click and the real subtree replaces the one that took the click. The `await act(async () => {})`
  drain is not enough when the chunk import is slow (CI load).
- The test mounts `FestivalDetail` through `app/routes/festival.tsx`, not `FestivalHub`. Nothing in the
  S1 `FestivalHub.tsx` diff is on that path. The branch's non-doc changes near it are `useAuth.tsx`
  (adds `missing`), `ListingRequestForm.tsx`, `app/routes/dancers.tsx`; none touches the festival route.
- So "S1's FestivalHub change causes it" is NOT supported by what I could measure. It is a load-dependent
  harness race; it may have been made likelier by module-graph timing, which I could not show.

## Red-first proof
Not obtained. Reproduction attempts (TZ=Europe/London, CI offline env stubs):
- full `npm run test:unit:offline`: festivalClientState PASSES (374/375 files; 5 failures all in
  `tests/integrityCouldNotRun.test.ts`, sandbox-only: typescript resolution in temp repos).
- `npx vitest run tests/client` (23 files): all pass.
- the file alone with 8 busy-loop processes on 4 cores: 8/8 pass.

## CI per-job table (sandbox)
| job / command | exit | result |
|---|---|---|
| test:unit:offline (London) | 1 | festivalClientState green; only sandbox-only integrityCouldNotRun (5) red |
| tests/client | 0 | 774 passed |
| check:dancer-area-isolation | 0 | OK |
| npm run build | 0 | built |
| check:bundle-budget | 0 | all budgets respected |
Going lock tests (`goingLock.test.tsx`, `rsvpBlock.test.tsx`) ran in the full run and passed.

## Verified / Not verified
Verified: the above commands. Not verified: any fix of the CI failure (none attempted: no repro, and the
brief forbids changing the test); the other two TZ legs; a real browser walk.

## What is left / next steps
The brief forbids editing the test, but the root cause is in the harness settle step. Owner decision
needed: either (a) allow `mountFestival` to await the PageTransition chunk deterministically
(e.g. `await import('@/components/PageTransition')` before mounting, then drain), or (b) re-run CI on
this head to see whether it still fails (4 prior `main` runs green). Do not call it flaky-and-ignore.
