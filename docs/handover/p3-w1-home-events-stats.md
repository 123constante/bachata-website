# Handover: P3 W1 Home + Events + Stats (PR #1047, 2026-10-25)

Brief: `brief/p3-w1-home-events-stats` (sha 96360c80). Branch `claude/p3-w1-home-events-stats`. Flag `organiserP3` OFF.
Design record: `docs/design/1047.md`. Shots: `docs/handover/p3-w1-walk/`.

## Done
- `/account/p3` Home, Events and Stats fill the W0 placeholders (You stays a placeholder).
- `p3/data/home.ts`: organiser_home_v1 -> rows (P3Event via the W0 model; `startPhrase` for the next date's time,
  `kindOf`, `kindWordStored`, `dayWord`), Next up, Needs you, status groups. `p3/model/status.ts`: `statusOf`
  (fact from `shared/lifeLabel.ts` seriesLife, words from `L`), `dayWord`.
- `p3/data/stats.ts`: **views source found and stated**: `organiser_series_stats_v1` (owner-callable, team-wide,
  counts only, London days, 366-day cap; `event_views` select is admin-only). One 30-day read; Today / 7 days sliced.
- Going: the going module's `useMyOrganiserGoingTotal` + `GoingTotalStat`; nothing renders while the switch is off.
- Tests: `p3/screens/__tests__/screens.matrix.test.tsx` (every screen x 15 prod-shaped fixtures, C3 probes #24,
  S18, #8b, #8d, #15, R-sim-m1-header, R-pol-w1, R-sim-s4-tile, R-sim-stats-sum, two review rounds' findings).
- Two `/code-review` rounds (high); every finding fixed. Round-2 fixes are unreviewed code.

## Model limits a later slice should know
- home_v1 has NO programme: each event reaches the model as one time-only session at the stored start, moved on
  a date whose materialised start differs. The long startPhrase ("Party 9pm, class from 8pm") needs the workspace.
- home_v1 has no rule mode: monthly / dates-I-pick read as weekly in `kindOf` (the chip word is still right).
- home_v1 lists only SCHEDULED dates (<= 3): "Cancelled tonight" cannot be shown from it.
- `classCount` is not called: home_v1 has no full date list; "N classes left" is the server's upcoming_count.

## Next steps
- Event page slice: make rows open it (rows are read-only today, with one link to `/account/o`).
- Stats: date-by-date (`views_by_date`) and where views come from (`link_clicks_by_zone`) are already in the RPC.
- Needs you: pay / teachers / names once a read carries passes and programme.
- Regenerate Supabase types to drop the narrow `statsRpc` caller.

## Walk harness
Screens rendered by a throwaway Vite page (scratchpad, not committed) with the matrix fixtures seeded into the
TanStack cache and `useAuth` / the Supabase client stubbed; Playwright at 390x844 and 360x640, light + dark.
