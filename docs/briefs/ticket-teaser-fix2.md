# Brief: ticket teaser fix round 2 (PR #1745, branch feat/ticket-teaser-readonly)
Class: TRIVIAL test fix, same branch/PR. CI on d7f4feda: `unit` red, 2 tests.
- `tests/client/dancerAppShell.test.tsx` ~line 49: `expect(DANCER_SCREENS[r.id], r.id).toBeTypeOf('function')` -> `.toBeTruthy()`.
- `tests/client/dancerTicketsTab.test.tsx` ~line 51: `expect(DANCER_SCREENS.tickets).toBeTypeOf('function')` -> `.toBeTruthy()`.
Why: tickets/teaser screens are now `React.lazy` objects, not functions (fix round 1 made them lazy for bundle-budget). Keep the lazy chunks.
Then run those two test files + `npm run check:bundle-budget`, push once, final commit ends [worker-done <ticket>].
`phone-qa (1)` also red at d7f4feda in `tests/e2e-phone/invite-w2-golive.phone.spec.ts:57` (phone field, untouched by this PR): check whether it fails the same on main; do not fix it here, just report in the handover.
