## Summary
Dancer Home Option B ("one thing in focus", owner pick 2026-11-12) behind `VITE_ENABLE_DANCER_DASH_B` (default off). One focus card: profile step, else next night, else "Find events this week". Rows: Share my page (disabled with a reason until the 4 required steps), "N more plans" and "N nights attended" (only above 0). States: new, partial, complete, unclaimed, empty, loading, error, each with an action. Website only: no migration, no DB write.

Coverage of INVENTORY.md: `docs/handover/dancer-dash-slice1/COVERAGE.md`.

## Verified on real data
- Shapes surveyed: existing read-only prod survey (counts only, 2026-11-12, docs/design/dancer-dash-protos/INVENTORY.md): 183 dancer profiles, 169 unclaimed, 14 claimed, 7 attendance rows; not re-queried in this run (Supabase connector unavailable here).
- Checks run: table-driven vitest over every DANCER_SHAPES fixture x went (null/0/12) x night (none/one), 256+ cases; all 1243 dancer-app tests pass; 390x844 walk of 6 shapes plus the night focus (no sideways scroll, controls at least 44px); `npx tsc --noEmit -p .` clean; `npm run lint` chain 36 of 36 links green; e2e spec-coverage and dancer-area isolation guards OK.
- NOT verified: a fresh prod query; the definition of "nights attended" (G-10, reads my_dancer_stats_v1.nights_went as Option A does); a real phone; contrast was not re-measured (reuses the pinned --da token pairs). The flag-on walk spec is in test:e2e but skips in CI (flag is off there); run it with VITE_ENABLE_DANCER_DASH_B=true.

## Phone QA
- Sizes checked: 390x844
- Walked: Home /app/home in new, partial, complete with a next night, complete with nothing planned, unclaimed and error shapes (Playwright, fake backend)
- Not verified: a real phone; 360x640 and other sizes; contrast not re-measured

## Screenshots
docs/handover/dancer-dash-slice1/home-b-{new,partial,complete-night,complete-empty,unclaimed,error}.png
