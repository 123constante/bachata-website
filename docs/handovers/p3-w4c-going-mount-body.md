## What changed
Mounts organiser "Who is going" (Home hero, date sheet, Stats) via `get_my_series_going_v1`, and merges `origin/main` (#1202 shell exits) into this branch.

Merge resolution (2 files conflicted, not 1 as the brief said; both were import lines only):
- `HomeScreen.tsx`: from main `AddEventLink` + `P3Link` (New event / events links, replacing `ChangeItLink`); from this branch `P3NightGoing` (Next up Going mount, `p3-nextup-going`). Both imports kept; no `ChangeItLink` use remains.
- `DateSheet.tsx`: from main `useGatedCopy` (onboarding gate); from this branch `P3NightGoing`. Both imports kept.

## Verified on real data
Shapes surveyed: none in this run (merge-only; no Supabase query run).
Checks run: `vitest run src/modules/organiser/p3` 3040/3040 tests pass (2 files cannot load without `jsqr`, which was missing from node_modules; installed with --no-save afterwards, door specs not re-run); `npm run lint` 24/24 links green; `npm run build` OK after installing jsqr.
NOT verified: `npm run typecheck` (102 errors, none traced to this merge; env has stale types/missing deps, not compared with main); `check:bundle-budget` FAILS on route "home (/city/:slug)" (module-walk found no static edge to a tracked chunk), a non-P3 route; not compared against main, so whether dancer-app first load is still +0 bytes is UNPROVEN; e2e `organiser-home.spec.ts` could not run (Playwright chromium-headless-shell missing in sandbox: browserType.launch failed).

## Phone QA
Sizes checked: 390x844
Walked: not walked
Not verified: all visual behaviour of Home with the Going hero and shell exits.
