# #1220 (branch claude/p3-fix-cache): merge main, resolve conflicts, finish F-33

Lane: normal. Model: Sonnet. Context cap 50%. Max 3 files of NEW logic; the rest is conflict resolution.

## Why
#1208 (create-event, 4bb3e43f8) and #1217 (editor states) are now merged on main. `gh api .../update-branch` says "merge conflict between base and head", so #1220's CI gates cannot queue (the conflicting-PR trap) and main's `mergeable` guard is red.

## Do
1. `git fetch origin main`, merge main into claude/p3-fix-cache (a merge commit, not a rebase; plain git). Resolve conflicts keeping BOTH sides' intent. This is not mechanical: after resolving, name every conflicted file in the handover and say which side each hunk kept and why.
2. Now that #1208 is on main: in `src/modules/organiser/p3/data/sessions.ts` `reload()` call `invalidatePublicEventCaches(qc)` (check the helper's current signature in this branch; it may no longer take a seriesId after r2) and remove sessions.ts from the EXEMPT list in `publicCache.test.tsx`. Red first: the exemption removal must fail before the call is added.
3. The new create-event save path (`p3/new/*`, `useCreateSave.ts`) also writes events: confirm it invalidates the public caches too (same helper). If it does not, add the call and a test.
4. Run every CI job step locally (read .github/workflows), `npm run check:bundle-budget` (add 0 bytes to dancer-app first load; never edit perf-budgets.json or vite.config.ts).
5. Keep PR body bullets exactly: `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` (text after the colon), `- Sizes checked:`, `- Walked:`, `- Not verified:`. Update them for this round.
6. One push, handover docs/handover/fix-1220-merge-main.md with the conflict table and an honest Verified / Not verified.
