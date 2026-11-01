# Brief: walk-seven-edits (WEBSITE, READ-ONLY WALK, Sonnet). Branch claude/walk-seven-edits. Output = one docs file, no source changes.

Context line: stay under 35% of your context; at 45% start nothing new; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY (SELECT only).

## Goal
First organisers will mostly EDIT existing events (most are weekly recurring parties). Walk the new organiser area (flags VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true) as the walk test account on origin/main and report, for a RECURRING weekly event with many dates AND a one-off event, whether each of the seven minimum edits is possible, in how many taps, and where a first-timer would hesitate:
1 description  2 flyer (cover picture)  3 gallery  4 sessions (add/edit/remove a class or workshop)  5 people of a session (teachers/DJs)  6 levels of a session  7 tickets (a ticket link and prices; NOT Stripe selling).
Also: change of scope question ("this date or all dates") appears where it should (flyer, venue, prices via admin RPCs; description?), what the Save button says, "Saved" confirmation, and what happens when you leave with unsaved changes.

## How
- Test account events: org "test org" has drafts named "WALK weekly30dates (draft, do not publish)", "WALK weekly-lineup ...", "WALK weekly16 ...", "WALK oneoff-2dates ...". Use those (they are the test account's own drafts). Do NOT edit real organisers' events.
- Walk with `node ~/.claude/bin/walk-session.mjs <file>` then `node ~/.claude/bin/laptop-walk.mjs --branch website:origin/main <paths> --session-file <file> --env VITE_ENABLE_ORGANISER_SELF_SERVE=true --env VITE_ENABLE_ORGANISER_P3=true --size 390x844 --out <dir>` (export MSYS_NO_PATHCONV=1, explicit paths). The walk tool cannot click, so for flows needing taps use a local Playwright run (add playwright with --scope local in a throwaway worktree only, remove afterwards) driving the real screens; light AND dark.
- Code reading allowed to answer "is X possible": src/modules/organiser/p3/screens/{EventPage,DetailsScreen,DateSheet,DateFieldSheets,SessionSheet,LineupSheet,PricesScreen,PriceCard}.tsx and p3/tickets/*.
- Apply the 8-row Screen quality bar to every screen walked (one clear action, plain words, calm tone, easy to read >=16px, easy to follow, few choices, taps >=44px, cold-read hesitations). Rank friction High/Med/Low with screenshot paths.

## Deliverable
docs/walk/seven-edits-r1.md: a table (edit x recurring x one-off: possible? taps, saved-proof, scope ask?), the ranked friction list (each with file:line to fix and a one-line suggested fix), and Verified / Not verified. Commit, push branch claude/walk-seven-edits, subject ending [worker-done <ticket>].
