# Brief: organiser public page - stats mapping (pure logic + tests, no screen)

Brief-version: 2
Lane: normal (no database change). Model: Opus (new rule logic). Repo: 123constante/bachata-website. Work branch: claude/organiser-stats-mapping.
Arc plan: ~/.claude/plans/luminous-crunching-goose.md (owner approved 2026-11-05). Real-data survey: ~/.claude/plans/SURVEY-organiser-stats-2026-11-05.md (read it; counts only). Inventory: ~/.claude/plans/INVENTORY-organiser-public-page.md. Both live in the lead's folder, not the repo: the rules below are restated so you need nothing else.

## Goal
One shared pure function that decides which stats the organiser public page shows, so the page never shows 0, "--" or a placeholder. This slice builds ONLY the function, its types, and a table-driven test matrix. It does NOT edit OrganiserProfile.tsx or any screen.

## The rule (owner decided; thresholds are first guesses, keep them as named constants in one place)
Input: facts about one organiser. Output: the first 3 qualifying stats in this priority order, 0-3 items, each `{ key, value, label }`. Never return a stat that would be 0, empty, "--" or a placeholder. If fewer than 1 qualifies return [] (the strip is hidden).
1 next_night: any upcoming dated non-cancelled event -> value is the next date ("Tonight", "Tomorrow", "Thu 12 Nov"); if none upcoming but a past night exists -> key last_night with the last date.
2 tickets_sold: ticketing live for this organiser AND sold >= 100 -> "100+" style rounding down to a nice step (100+, 250+, 500+, 1,000+). Never show below 100.
3 dancers_came: Going data live AND unique count >= a named threshold (default 100) -> same rounding. Input is optional and may be absent.
4 nights_hosted: past non-cancelled nights >= 5.
5 weekly_rhythm: of the LAST 12 MONTHS of non-cancelled dates, at least 4 fall on one weekday AND that weekday holds at least 60% of them -> "Thursdays" (plural weekday). Survey finding: counting all dates ever lets 4 scattered dates qualify, so recency and share are required.
6 running_since: a real founded_year, else the first listed event more than 1 year ago (shown with a "~" because inferred). Value like "Since 2023" or "~3 yrs".
7 teaching_lineup: removed from this strip (the Team section covers people). Do not implement.
8 venues: exactly one main venue name known -> that name (truncate by width in the screen, not here).
Dates: London time, use the repo's existing date helpers (find them; do not write new date maths). Day boundaries: events 00:00-08:00 belong to the previous day (src/lib/programDayRollover.ts).

## What main lacks
- A shared stats mapping module -- grep: organiserStats
- Table-driven tests for every shape -- src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx exists for the page; no stats matrix exists

## Files
- src/modules/profile/organiserStats.ts
- src/modules/profile/__tests__/organiserStats.matrix.test.ts
- docs/handover/organiser-stats-mapping.md

## Steps
1. Prove the data source first: read how OrganiserProfile.tsx (around lines 1050-1070 and 1274-1292) computes upcoming/past counts and the third stat today, and which fields the page already has. Describe in the handover which inputs the function needs and where each comes from (do not wire them).
2. Write the types and function. Pure, no I/O, no Date.now() inside (take `now` as an input).
3. Matrix tests (red first): the real shapes: big ticketed organiser (221 dates, tickets>=100), small weekly class (35 past, 53 upcoming, Thursdays), nothing upcoming but 14 past (-> last_night, nights_hosted, running_since), brand new (1 upcoming), no events at all (-> []), 4 scattered dates over 3 years (-> NO weekly_rhythm), exactly 4 on one weekday in 12 months but 3 others on other days (share 57% -> NO), 5 of 7 on one weekday (yes), 100 vs 99 tickets, founded_year present vs inferred, cancelled-only organiser (-> []), upcoming today vs tomorrow wording, day rollover at 01:00. Assert max 3 items, order stable, never 0/empty/"--".
4. Run npm run test:unit for the new file and the pre-ship gates your repo requires; no screen changes so no walk.
5. PR body from the repo template: Shape survey with real numbers from the survey file (cite it), Verified / Not verified (state: not wired into the screen yet).

## Hard limits
No change to OrganiserProfile.tsx, perf-budgets.json or vite.config.ts; zero bytes to /app first load (the module is not imported by any screen yet). Never merge or approve. One push. No raw Unicode punctuation in source (use plain ASCII).
