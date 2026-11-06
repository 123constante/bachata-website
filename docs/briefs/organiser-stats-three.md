# Brief: organiser stats strip shows only Next night, Nights hosted, Running since
Brief-version: 2
Branch: claude/organiser-stats-three
Lane: normal, Sonnet. 123constante/bachata-website, no DB, no migration, no workflow, no calendar density-exclusion file.
Serves: visitors to a public organiser page (/organiser/<id>), who today see "Sun 8 Nov / 30 NIGHTS HOSTED / Sundays EVERY WEEK" (owner decision 5, plan elegant-exploring-rocket.md, slice A2).

## What main lacks
- extends: the strip is live (OrganiserProfile renders it from organiserStatsByFeed), but the mapping still ranks eight stats and shows weekly_rhythm; it must offer only next_night, nights_hosted, running_since, in that order -- src/modules/profile/organiserStats.ts
- extends: the by-feed wrapper still lists last_night, tickets_sold, dancers_came, weekly_rhythm, venues in ORDER and in its comment, and passes ticketsSold/dancersCame -- src/modules/profile/organiserStatsByFeed.ts
- extends: the strip comment still says "first three stats that qualify" with no weekly or last-night wording left; keep layout, tap target and failed-dash behaviour -- src/modules/profile/OrganiserStatsStrip.tsx
- extends: matrix test pins the old eight-stat order, weekly rhythm, last_night, tickets, dancers and venues -- src/modules/profile/__tests__/organiserStats.matrix.test.ts
- extends: page matrix rows expect weekly_rhythm and last_night (rows at ~244-257 and ~443) -- src/modules/profile/__tests__/organiserPage.matrix.test.tsx
- extends: feed-error matrix expects last_night when nothing is upcoming (~174-176) -- src/pages/__tests__/OrganiserProfileFeedError.matrix.test.tsx

## Files
src/modules/profile/organiserStats.ts
src/modules/profile/organiserStatsByFeed.ts
src/modules/profile/OrganiserStatsStrip.tsx
src/modules/profile/__tests__/organiserStats.matrix.test.ts
src/modules/profile/__tests__/organiserPage.matrix.test.tsx
src/pages/__tests__/OrganiserProfileFeedError.matrix.test.tsx

## What to build
0. Write INVENTORY.md first (the strip only: each stat the page can show today with file:line in organiserStats.ts, the by-feed wrapper and OrganiserProfile.tsx, plus the admin source of founded_year), and report the coverage count at the end.
1. organiserStats.ts: OrganiserStatKey becomes 'next_night' | 'nights_hosted' | 'running_since'. Candidates in that order only. Next night: only when an upcoming night exists (Tonight / Tomorrow / "Thu 12 Nov" as today); with nothing upcoming it shows NOTHING (no Last night fallback; do not add Last night back). Nights hosted: unchanged rule (distinct past non-cancelled nights >= NIGHTS_HOSTED_MIN, 5). Running since: unchanged rule (real founded_year, else earliest night over a year ago as "~N yrs" with the estimate title). Delete the weekly_rhythm candidate, WEEKDAY_PLURAL, weekdayOfKey import, WEEKLY_RHYTHM_* constants, TICKETS_SOLD_MIN, DANCERS_CAME_MIN, the venues candidate, roundedCount/niceFloor if now unused, and the ticketsSold, dancersCame, venueNames input fields. Keep MAX_ORGANISER_STATS = 3 (now the natural cap). Fewer qualifying = fewer shown; none = []. Update the file header (it still says NOT wired into any screen; it is wired).
2. organiserStatsByFeed.ts: trim ORDER to the three keys, drop the ticketsSold/dancersCame args, rewrite the header comment with no "Last night" or "Every week" wording. Failed-feed behaviour is unchanged (dash for the failed feed's own stat, real founded year kept).
3. OrganiserStatsStrip.tsx: only the doc comment changes (no weekly or last-night wording). No layout change.
4. Tests (red first): update the three test files to the three-stat rule BEFORE touching the source and show them red against the unfixed code, then green after step 1-2. Delete the weekly-rhythm, tickets, dancers, venues describe blocks and the last_night assertions; replace the "real shapes" table with these rows (now fixed at 2026-11-06):
   - weekly organiser, 30 past nights inside one year, upcoming dates, no founded year -> next_night, nights_hosted (the owner's screenshot shape: value like "Sun 8 Nov", "30"; no "Sundays", no "Every week")
   - same with founded_year 2019 -> next_night, nights_hosted, running_since ("Since 2019")
   - new organiser, 1 upcoming, 0 past -> next_night only
   - under 5 past nights (4) with upcoming -> next_night only
   - ended organiser, 12 past, nothing upcoming -> nights_hosted only (no Next night, no Last night)
   - ended organiser, 2 past, founded 2019 -> running_since only
   - no data, no founded year -> [] and the strip is not rendered
   - cancelled-only nights, unparseable starts -> []
   Keep the day-rollover (01:00 Tonight) and threshold-rounding checks that still apply. Add one table-driven guard: for every row, no stat value or label matches /week|sunday|monday|tuesday|wednesday|thursday|friday|saturday|last night|ticket|dancers|venue/i (a weekday inside a Next night date label such as "Thu 12 Nov" is allowed: test labels and the Running/Nights values only, not next_night values).
5. Keep every source file pure ASCII (HTML entities or \u escapes; scripts/check-mojibake.mjs stays green). Files over 2 KB go through the safe-edit and safe-write scripts per CLAUDE.md.

## Tests
Run `npx vitest run src/modules/profile src/pages/__tests__/OrganiserProfileFeedError.matrix.test.tsx`, the mojibake check (npm script check:mojibake or the repo script), `npx tsc --noEmit -p .` filtered to the touched files, and `git grep -n "weekly_rhythm\|last_night\|tickets_sold\|dancers_came" -- src/modules/profile src/pages/OrganiserProfile.tsx` (must be empty). Read .github/workflows and run every job step that applies; put the per-job table in the PR body.
Walk at 390x844 (laptop-walk.mjs, not the PC) on an FK Dance-like shape (about 30 past nights, weekly upcoming, no founded year: expect two tiles, Next night + Nights hosted, no weekly wording) and a new-organiser shape (1 upcoming, nothing past: one tile; and no nights at all: no strip). Screenshot both, no sideways scroll, Next night tile still taps to the upcoming list (44px).

## Done when
- The strip can only ever show Next night, Nights hosted, Running since, in that order; weekly, last-night, ticket, dancer and venue stats are gone from code and tests.
- Red-then-green output, mojibake check, tsc and the walk screenshots are in the PR body, with a Verified / Not verified block (Not verified: real phone; production data not read live, shapes taken from the owner's screenshot and the matrix).
