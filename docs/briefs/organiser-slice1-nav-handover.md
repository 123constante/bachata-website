# Handover: organiser slice 1 nav fixes

Branch `feat/organiser-slice1-nav`. All behind organiserShellV2 + organiserP3 + organiserDash (OFF = unchanged).

## Done (brief items)
1. Role strip (seat word, page, Switch page + to-do badge) on every V2 tab. One `SwitchControl` shared with the P3 strip.
2. Back links are router `Link`s (no full reload), incl. the Gate loading state.
3. Pushed screens (New event, Team, You pushes): V2 top bar, strip, exit bar and tabs hidden; their own Back only.
4. Tab links keep only `?e=` and `?o=` (`tabSearchOf`).
5. "Home" in GetPaid, OnboardingFlow (+ finish label) and the `*` fallback goes to Events when V2 is on (`homePathOf` / `homeWordOf`).
6. Event switcher options say `Name · 3 coming / Draft / Hidden / No dates coming` when there are several events; `v2-switch-empty` now defined in v2.css. Role is already on the strip.
7. `nightsOfChoice` includes draft and hidden series that have a date.
8. V2Shell and V2Tabs are now lazy in P3Routes; `check:bundle-budget` passes with no budget change.

## Left / next
- 390x844 browser walk on prod-shaped data not done (no laptop-walk.mjs in this checkout, no auth in the cloud sandbox).
- Pushed-screen choice: tabs are hidden too, as the brief says; if the owner wants the bottom tabs kept, delete `!pushed &&` on the `<nav>` in V2Shell.tsx.
- Undated drafts still say "has no coming dates" (no night to open a sheet on).

tsc run on the branch head before this doc: 0 errors.
