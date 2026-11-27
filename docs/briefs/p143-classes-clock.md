# P143: pin the clock in classesTwoDoors.test.tsx (branch claude/p143-classes-clock)

Website `main` unit tests are red: `src/pages/__tests__/classesTwoDoors.test.tsx` test
"Next class card, day drawers in date order, today + tomorrow open, row tags and BEGINNERS" (line ~119)
expects the Next class card to show "Friday Social Night" (fixture 2026-11-27T19:00). The test mocks
`useLondonToday` to '2026-11-27' but the page also reads the REAL clock, so once real time passes
Friday 27 Nov 19:00 London the Friday class is treated as started and "Saturday Partnerwork" shows.
Any later date breaks it too.

## Fix (test only, no src change)
In that test file pin the system clock for every test to Friday 27 November 2026 at 12:00 London
(`2026-11-27T12:00:00Z`): `beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-27T12:00:00Z')); })`
and `vi.useRealTimers()` in afterEach (keep the existing `cleanup`). Fake ONLY Date (`toFake: ['Date']`) so
React/testing-library timers still run. Precedent: src/components/raffles/__tests__/RaffleRedesignA.test.tsx:99.
Add a one-line comment saying why (fixture dates are fixed; page reads Date.now).

## Prove it
1. `npx vitest run src/pages/__tests__/classesTwoDoors.test.tsx` green.
2. Prove the class is fixed: temporarily set the pinned time to `2026-11-27T20:00:00Z` -> the Next class test must FAIL (shows the bug is the clock); put it back to 12:00 -> green. Say so in the handover.
3. Also run it with `TZ=America/New_York` and `TZ=Australia/Sydney` (CI runs those) -> green.

## Out of scope
Any src/ file. Any other test.

Open a PR to main (bot opens it on push). Size: 1 file, ~10 lines. Max 1 file. Design: none.
Commit message ends with [skip preview]. Last commit carries `[worker-done <ticket>]`.
