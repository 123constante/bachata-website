# Handover: P3 W0 foundation (Website), 2026-10-25

Brief: `brief/p3-w0-foundation:briefs/p3-w0-foundation.md` (sha 32d06c2). Branch
`claude/p3-w0-foundation`. Design record: [`docs/design/p3-w0-foundation.md`](../design/p3-w0-foundation.md).

## Done
1. Flag `organiserP3` (`VITE_ENABLE_ORGANISER_P3`, default off) in `src/lib/featureFlags.ts`.
2. Area `/account/p3/*` (lazy chunk `p3/shell/P3Routes.tsx`, AuthGuard + noindex inside it), frame +
   C3 tab bar Home / Events / Stats / You, placeholder per tab. Mounted only with the flag on;
   `/account/p3/*` added to `CATCHALL_CLIENT_PATHS` (with the flag off the client shows NotFound).
3. Shared model `src/modules/organiser/p3/model/` (see the design record).
4. Tokens `src/modules/organiser/p3/theme/p3.css`.
5. Tests: `model.matrix.test.ts` (every CONTRACT section 1 shape), `realShapes.test.ts` (prod types,
   null times; red first), `p3Theme.contrast.test.ts`, `flagOff.test.ts`, `P3Shell.test.tsx`.
   Walk script `tests/e2e/walk-p3-w0.spec.ts` (not in the gate list).

## Left / next slices
- Readers: wire `admin_event_workspace_p5` / `organiser_home_v1` into the model (an adapter from the
  workspace programme rows to `P3Session`; forward rules wait for A1).
- Home / Events / Stats / You screens on top of the shell; going mounts only when both
  `organiserP3` and the going switch are on (CONTRACT section 5).
- Decide whether `/account/p3` eventually replaces `/account/o` (a later flip), and the entry link.

## Notes for the next worker
- Build every word from `L`; every start time from `startPhrase`; every class count from `classCount`.
- Kind word: `kindWordStored` / `kindWordFromSessions` only (eventCategory).
- Times may be null; sort with `byStart`.
