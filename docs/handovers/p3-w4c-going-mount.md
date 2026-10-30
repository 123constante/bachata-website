# Handover -- P3 W4c "Who is going" mount (branch claude/p3-w4c-going-mount)

## Done
- Data source proved (read-only, prod stsdtacfauprzrdebmzg, 2026-10-30): `public.get_my_series_going_v1(p_series_id uuid) returns jsonb`,
  SECURITY DEFINER, ACL `postgres, service_role, authenticated` (no anon, no PUBLIC), body delegates to `get_my_event_going_v1`.
- `fetchMySeriesGoing` (goingRpc.ts) reuses `parseMyEventGoing` and `MyEventGoing`; `useMyEventGoing(id, { bySeries: true })` reuses the
  hook (own query key `series:<id>`).
- `screens/P3Going.tsx`: `p3GoingOn()` (organiserP3 && GOING_CHECKIN_ENABLED, gated OUTSIDE the hook), `p3GoingSlot` (one mapping:
  off/not_organiser -> nothing; ready -> night; else GoingLoadState), `P3NightGoing` (Home hero by day, DateSheet by `occurrence_id`),
  `P3SeriesGoing` (Stats By-event, sum over not-cancelled nights).
- Tests: `screens/__tests__/p3Going.matrix.test.tsx` (18).

## Not done
- No e2e at 390x844 (no browser walk); no live signed-in organiser call; no "before" bundle-budget run (after run is green with unchanged allowances).
- Stats makes one read per row (batch read is a separate admin ask).
- Sandbox lacks `jsqr` (door tests fail to resolve; build needs `npm i --no-save jsqr`) -- pre-existing.
