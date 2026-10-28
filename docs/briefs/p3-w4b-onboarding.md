# Brief: P3 W4b build 1 - onboarding + claim states in the P3 look (flag organiserP3 stays OFF)
Branch: claude/p3-w4b-onboarding (from main). Lane: normal. Builder: Opus. One PR. Stopping rule: one independent review, one fix round, then orchestrator walk.

## Owner decisions (2026-10-28, binding; do not reopen)
- New account (no page yet): mockup option A "Quiet steps" (docs/design/p3-w4b/new-account-A.html, chosen). Search first; Create sits on the same screen as today.
- Profile not finished (city/photo missing, dancer row exists): option B "Look first, finish on the tap" (docs/design/p3-w4b/no-city-B.html). Screen identical to a new account's; the check runs at the tap, BEFORE any typing, via the existing site-wide fact `ProfileGateContext` (useProfileCompletion / completenessFact / stillToAddText). NO new read. A primary button "Finish your profile" names what is missing and goes to `/finish-profile` via `finishProfileHref`. Never "Message us" for this shape.
- Return copy ships as drawn: "When you are done you come back to Welcome; search for your page again." Do NOT build a task-carry through returnTo.
- No dancer row at all (2 of 42 prod accounts): keep today's NO_PROFILE_TEXT message-us fallback in its own frame; server auto-create is a separate admin slice, not here.
- The create wizard (flows/new) and event files are NOT in scope. Do not touch organiser/events/*, shared/createModel.ts, seriesCommands.ts. Go-live, role question and Dancer4 are the NEXT cluster, not this PR.

## Read first (design contract)
The mockups are NOT on main yet (PR #1114, branch claude/p3-w4b-mockups): run git fetch origin claude/p3-w4b-mockups, then read with git show FETCH_HEAD:docs/design/p3-w4b-mockups.md and FETCH_HEAD:docs/design/p3-w4b/<file>. Do not merge or cherry-pick that branch into yours. Read docs/design/p3-w4b-mockups.md (all sections), the four mockups under docs/design/p3-w4b/, tokens src/modules/organiser/p3/theme/p3.css. Rules: shared/teamRules.ts is the one mapping for team actions; the UI offers only what the RPC accepts; every empty state says what the person CAN do; disabled controls say why; compact density, 390x844, taps >= 44px (explicit px, html is ~13.5px on phones).

## Scope
Rebuild in the P3 look: src/modules/organiser/home/onboarding/{OnboardingView.tsx, OrganiserSheet.tsx, citySearch.ts (logic unchanged), claimStates.ts (hint-to-words map unchanged), SignOutLine.tsx} and home/ClaimNotice.tsx, including: search, results, no-match, error, claim (proof + code step with disabled "Resend in Ns"), claim refused, ask-to-join + Done, "yours" (6a), create name step, city step titled "City", refusals (name taken / 3 a day / invite required "We are checking" / other), offline, sign-out failed, claimed Home confirmation. Behaviour/RPC calls unchanged except the profile-incomplete tap check above. Gate unchanged: server `_require_complete_dancer_profile_v1` decides; the client check only moves the refusal before the typing and falls back to today's behaviour (buttons on, server decides) if the completeness read errors.

## Definition of done (all required, put in PR body with literal lines)
- "- Shapes surveyed:" read-only prod counts (42 accounts, 30 no page, 10 unfinished profile, 28 brand new, 2 open request, 2 no dancer row), "- Checks run:", "- NOT verified:", plus "## Phone QA".
- Table-driven vitest: every screen x every shape above; one shared mapping; no text pointing at a missing control; untouched save sends nothing. RED FIRST commits for any gate behaviour (unfinished profile tap goes to Finish profile, sends no create/claim command; completeness read error falls back to today).
- Run every CI job step in the sandbox; per-job table in the PR body. Zero bytes to /app first load: `npm run check:bundle-budget` main vs branch (never edit perf-budgets.json or vite.config.ts).
- Overlay geometry: sheets/toasts portalled to body, no page scroll on open (focus preventScroll), e2e at 390x844 asserting sheet, confirm and toast boxes inside the viewport.
- Walk at 390x844 on the organiser fake for each shape; write tests/e2e/walk-p3-w4b-onboarding.spec.ts and list it in the e2e gate by name.
- Design record docs/design/p3-w4b-onboarding.md linked in the PR body (chosen options, self-check numbers: contrast >= 4.5, taps >= 44, no clipping, width 390).
- Prove the data source first: read the live RPC bodies read-only on prod and state which table/column each gate depends on before building.
Context cap 35%. Push an early checkpoint (subject ends [skip preview]); handover docs/handovers/p3-w4b-onboarding.md.
