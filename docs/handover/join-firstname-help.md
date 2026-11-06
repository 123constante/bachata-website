# Handover: join "First name" help line

Done: `about.firstNameHelp(pageName)` in joinCopy.ts; AboutStep renders it under the field (`aria-describedby="join-first-name-help"`, 13px muted). Page name source: `preview.organiserName` (parsePreview rejects an empty name, so "unknown" is defensive, shown plain).
Test: `join/__tests__/aboutFirstNameHelp.table.test.tsx`, 2 x 3 cells. RED on unfixed code: 6 of 6 failed. Fixed: join dir 329/329 pass.
Gates: `npm run lint` 24/24 green; tsc: no errors in touched files (one existing error in untouched inviteNextAction.table.test.tsx); `check:bundle-budget` green on the branch after a build.
Not verified: bundle budget on main (not run; the change is outside the /app graph); 390x844 phone walk (orchestrator walks it); independent review round (left to orchestrator).
Left: review, then merge by owner.
