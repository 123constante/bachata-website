# Brief: organiser nights cards, continuation 1 (merge main, resolve the conflict)
Brief-version: 2
Branch: claude/organiser-nights-cards
Lane: normal, Sonnet. Continuation of the finished slice on this branch (PR #1438). No new features, no database change. Repo 123constante/bachata-website. Same PR.

## Goal
PR #1438 conflicts with main in src/pages/OrganiserProfile.tsx. Main gained the "bio shown once in the header" change (#1436) in that file. Merge origin/main into the branch, resolve the conflict keeping BOTH sides (main's bio change and this branch's Next nights and Past nights sections), and push.

## What main lacks
- extends: the conflict-free OrganiserProfile.tsx with the nights cards and past highlights wired in beside main's header bio change -- grep: past-highlights-strip

## Files
- src/pages/OrganiserProfile.tsx

## What to build
1. git fetch origin main; git merge origin/main on claude/organiser-nights-cards. Resolve src/pages/OrganiserProfile.tsx only: take main's header and bio code exactly, keep this branch's Next nights / Past nights section code exactly. Do not touch anything else.
2. Run npx tsc --noEmit -p . (0 errors in touched files), the nights-cards matrix test (src/modules/profile/__tests__/nightsCards.matrix.test.tsx) and the existing OrganiserProfile tests; npm run check:mojibake.
3. Keep the PR body labels exact and run the two PR-body checkers.

## Do NOT touch
Anything else; EventCalendar.tsx, calendar/*, scripts/**, supabase/**, workflows.

## Done when
One push; branch merges cleanly with main; tests green; last commit subject ends with the [worker-done ...] marker.
