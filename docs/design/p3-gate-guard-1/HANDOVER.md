# p3-gate-guard-1 HANDOVER

Branch `claude/p3-gate-guard-1` from main 9a1ddce (#1306 merged). Website only, no database change, nothing sent or
replayed by the fix.

## Done
- **INVENTORY first** (`INVENTORY.md`): 21 rows, 21 shown, none omitted; 16 reachable, 5 unreachable with reasons.
- **Fix (one place):** the router blocker (`screens/EditTray.tsx` `useRouterBlocker`) lets a dirty Details/Prices
  screen go without "Leave without saving?" ONLY for the gate sheet's Continue for that very screen, and only while a
  kept draft for that event AND screen is in storage (`onboarding/keptDraft.ts` `leavesForGate`; the Continue link
  carries `onboarding/returnTo.ts` `gateGoState(at)`). Every other exit asks as before; a draft storage refused
  (private mode / full) still asks, because then the typing really would be lost. Dates' sheets are untouched (path
  is not details|prices).
- **Tests, red first** (`gateRetry.matrix.test.tsx`, exit matrix, 32 cases + 1 wrong-screen case): on main only #13
  (gate Continue, dirty, stored) x Details/Prices failed (`red-on-main.txt`). Mutants: "leave sheet on gate Continue"
  = main (killed by #13); "skip the which-exit check" (any exit passes while kept) killed by #2/#6/#10 x 2 screens
  (6 red); "never ask" killed by 17 rows.
- **44px:** the Details event-name field already measures 44px (`.p3-in` min-height `--tap`; walk: 44 in P1/P3a/P8).
  The walk's 42px control was the hidden cover-photo file input inside its 44px label (the inset skipped the 1px
  border). `p3.css` `.p3-file input` now spans the border box; the sweep finds no P3 control under 44px.
- **P8 decision:** the old walk mock failed `organiser_onboarding_status_v1` on EVERY read; the checklist needs the
  same read, so it showed its own "We couldn't load your page. Try again." screen (with Try again), and the old spec
  waited for `p3-ob-title`, which that screen does not have: the mock, not the product, made the cell look stuck.
  The honest mock (fails once, answers after) reaches the checklist, Back to your event, typing kept (P8 pictures).
  The always-failing case is kept as P8x: the product already says so in words and the typing is in storage
  (asserted). No product change for P8.

## Gates run (local)
`npm run lint` 24/24 links green (eslint informational as usual; scoped eslint on touched files: 0 errors, 6
pre-existing-pattern warnings). `npx vitest run src/modules/organiser/p3 src/modules/areas`: 93 files, 4997 passed,
2 skipped. `check:bundle-budget` main vs branch: every line identical (/app 372.4 KB, 47 chunks both: 0 bytes).
`check:integrity` ok. `AUDIT_STRICT=1 check:images` 0 issues. Walk: 13/13, 26 pictures all opened (`docs/walk/p3-gate-guard-1/RESULTS.md`).

## Left / next
- Not done here: `/code-review` round (brief: the orchestrator's call), PR checks (pending at hand-off), phone test.
- P8x follow-up for a later brief, if wanted: the checklist's read-failed screen has Try again but no
  "Back to your event"; the kept typing (60 min) only returns through that button.
