# Handover: gateRetry.matrix.test.tsx flake (fix/gateretry-matrix-flake)

Brief: `docs/briefs/brief-gateretry-flake.md` on `brief/fix/gateretry-matrix-flake`.

## Root cause: a timing bug in the test, not a product bug
Row "P1 owner, unfinished page | gate on | details" read `keptDraft('ser-1')` right after
`findByTestId('p3-details-kept')` and expected it to be null. The screen clears the kept copy in a
**passive effect** (`EditTray.tsx` `useKeptEdit`: `useEffect(() => { if (kept) dropKept(seriesId) })`).
React's Node scheduler runs passive effects on a `setImmediate` tick after the commit that put the line
on screen. RTL's `findBy*` settles with a `setTimeout(0)`. On an idle machine the scheduler tick usually
wins; on a busy CI runner (`unit (Europe/London, full)`, ~900 files) the timer can win, so the
assertion ran before the drop. Product behaviour is fine: the drop happens one tick later and no person
can act in between. Gate behaviour was not changed.

## Proof (red first)
- Not reproduced naturally: the file alone passed, and a full local `vitest run` passed it too (4 cores).
- Deterministic repro: push React's tick 8 ms late (`setImmediate` -> `setTimeout(fn, 8)`, hoisted
  before React loads). Unfixed test: exactly `P1 owner, unfinished page | gate on | details` fails with
  `AssertionError: expected { screen: 'details', …(2) } to be null`, the CI message. Fixed: 79/79.

## What changed (test file only)
1. Line ~188: `await waitFor(() => expect(keptDraft('ser-1')).toBeNull())`.
2. The file now always runs in that "loaded runner" mode (slowed tick), so any future read of an
   effect's write in the same tick fails on every run, not one run in N. `afterAll` checks the slowed
   tick was really used (if React stops using `setImmediate`, the mode would otherwise do nothing).
3. Leak check between rows (`afterEach`): after teardown and clearing, let late ticks run (30 ms), then
   sessionStorage must be empty and the gate closed. Proven: a deliberate late
   `sessionStorage.setItem` at the end of the refused rows reds 6 rows with
   "a finished row wrote to sessionStorage after its teardown"; removed, green.
4. Order independence: `--sequence.shuffle` with seeds 1, 7, 42, 1234, 99: 79/79 each.

## Left / next steps
- Other files may use the same "read an effect's write right after findBy" pattern; not swept here.
- Money, prices, refunds: untouched.

## Status
- PR: #1543 (label automerge-ok; not merged by the worker).
- tsc run on bbd1331: 0 errors in branch files (0 errors repo-wide).
- Not verified: `npm run pre-ship` (full suite, more than 10 min in the sandbox); local git hooks did not run (not executable in this clone); CI per job is in the PR checks.
