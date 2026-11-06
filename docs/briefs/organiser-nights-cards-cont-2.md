# Brief: organiser nights cards, continuation 2 (review fixes + walkable id)
Brief-version: 2
Branch: claude/organiser-nights-cards
Lane: normal, Sonnet. Continuation of PR #1438 after its independent review and the lead's phone walk. No database change. Repo 123constante/bachata-website. Same PR, same branch.

## Goal
Fix four things found in review and the 390x844 walk. Nothing else.

## What main lacks
- extends: the middle-dot separator in the card meta line written as an escape, not a raw character -- grep: cardMetaLine
- the year shortcut chips shown only when the full list can be closed again (a visitor must never open the full past list with no way to close it) -- grep: past-year-shortcuts
- the Past section shows the hosted count once (header "N hosted" removed when the strip shows "N nights hosted") -- grep: past-highlights-strip
- a non-interactive wrapper with id="next-nights-list" around the Next nights cards so the lead's walk can scroll to the cards without clicking one -- grep: next-nights-list

## Files
- src/modules/profile/nightsCardModel.ts
- src/modules/profile/PastHighlights.tsx
- src/modules/profile/__tests__/nightsCards.matrix.test.tsx
- src/pages/OrganiserProfile.tsx (the Next nights and Past nights sections only)

## What to build
1. nightsCardModel.ts line ~52: `' · '` has a raw U+00B7 in source. Replace with the escape `' \u00b7 '`. Add a test that the output contains U+00B7 and that the source file has no non-ASCII byte (read the file in the test).
2. Year chips: when the strip's "See all N nights" button is not shown (6 nights or fewer in total, or every night is already in the strip), do not render the year chips. When the full list is open there must always be a visible button to close it ("Hide the full list"), whatever the count. Test: 5 nights = no chips, no list toggle; 8 nights = chips + See all + Hide.
3. Remove the duplicate count: the Past section header currently prints "{N} hosted" and the strip below it prints "N nights hosted". Keep the strip's; drop the header's count when the strip is shown (keep it when there is no strip).
4. Wrap the Next nights cards list in a plain `<div id="next-nights-list">` (no onClick, no role).
5. Verify: tsc 0 errors in touched files, the matrix test and src/pages + src/modules/profile vitest green, npm run check:mojibake. Add one line to the PR body under "Verified on real data": the survey counts are from raw tables and differ from the lead's public-RPC figures (39 organisers with 1-9 upcoming, 10 with none), not reconciled. Keep labels exact; run both PR-body checkers.

## Do NOT touch
EventCalendar.tsx, calendar/*, scripts/**, supabase/**, workflows, any other file.

## Done when
One push (no [skip preview]); tests green; last commit subject ends with the [worker-done ...] marker.
