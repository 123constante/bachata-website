# Handover: fix-main-red-live-qa (Live QA daily red on main)

Branch `claude/fix-main-red-live-qa`. Ticket dt_758331b6e1ae. Source: run 41973390944 (2026-11-05).

## Findings and classification

| # | Finding (CI) | Pages | Class | Action |
|---|---|---|---|---|
| 1 | tap-target 12x12 button "Dismiss hint" | /event/:slug (8 visits) | DETECTOR BLIND SPOT (not a visitor bug) | The button already has a `before:-inset-[16px]` hit box = 44x44. The detector measured only the element box. `checkTapTargets` now counts an absolutely positioned ::before/::after (insets off the padding box). Canary added in detectors.spec.ts; it was red on the old detector with the exact CI numbers. |
| 2 | tap-target 88x24 "All Events" / "Tonight" | /city/london-gb | REAL BUG (small) | The ::before lift (-10px each side) assumed a 24px button. With the phone root font about 13.5px it rendered 23.6px, so the tap area was 43.6px. Added `min-h-[24px]` (px) to TabBar tabs. Failing-first vitest `src/modules/home-map/__tests__/tabBarHitArea.test.tsx`. |
| 3 | hammersmith-salsa-bachata-club not under Upcoming on /organisers/incognito-dance | organiser page | TEST BUG (spec assumption) | The page shows the first 3 upcoming items plus "Show all N dates"; incognito-dance has 5 live series and Hammersmith is 5th. The spec now opens "Show all" before looking. The page is correct. |

No baseline.json rows were added. No DATA findings.

## Verified
- The suite ran locally against a local production build (prod Supabase, anon key, read-only guard), with the survey taken read-only through the Supabase MCP: 26/26 passed, 368 findings, 0 new.
- Detector canaries: 8/8 passed. tsc, eslint on the touched files, check:mojibake, and `npm run lint` all passed.
- test:unit: 15 failures in 4 contract/integrity files. They fail the same way on unmodified main in this sandbox, so they are environmental.

## Not verified
- The run against https://www.bachatacalendar.co.uk itself: the sandbox network policy blocks prod and Vercel (403 CONNECT), and the local SUPABASE_ACCESS_TOKEN is invalid (401).
- The live result needs the fix deployed (the TabBar change) and the next scheduled run, or a workflow_dispatch after merge.
