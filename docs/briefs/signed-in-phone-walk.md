# Brief: signed-in phone walk (admin queue #1575), lane normal
Goal: walk the dancer and organiser dashboards, Team tab and Tickets tab at 390x844, signed in as the walk TEST account, flag on and off (VITE_ENABLE_DANCER_DASH_B, organiserDash), shapes empty / normal / huge.
Report only: tap sizes under 44px, text contrast under 4.5:1, console errors, dead-end states. Evidence = screenshots + summary.json in the PR.
Tools: node ~/.claude/bin/walk-session.mjs <file> makes the session file; node ~/.claude/bin/laptop-walk.mjs --branch website:<ref> <paths> --session-file <file> --env VITE_ENABLE_DANCER_DASH_B=true. On Git Bash set MSYS_NO_PATHCONV=1. Never run builds/servers/tests on the owner PC. Do not self-grant admin; if the test account lacks a role, say so and stop.
No saves, no prod writes, no source edits except a walk spec/script under e2e/ or scripts/ if needed to tap into tabs. Output: docs/walks/signed-in-phone-walk.md with findings; one PR.
