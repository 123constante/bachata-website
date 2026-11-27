# Brief: organiser page P2 team, continuation 4 (main merge + phone-qa red)
Brief-version: 2
Branch: claude/organiser-page-p2-team
Lane: normal, Opus. Continuation of PR #1437. Screen + hard-tier path (scripts/), no migration. Repo 123constante/bachata-website. Same PR, same branch.

## Goal
Two things only. (1) Merge origin/main into the branch again: main now carries the nights cards (#1438) in src/pages/OrganiserProfile.tsx; keep BOTH sides (main's header bio + nights cards + this branch's public team read). (2) Fix the red CI check `phone-qa` on this PR: the Playwright spec tests/e2e-phone/people-nationality-flag.phone.spec.ts times out (locator.waitFor 15000ms) at 390x844 in the cases "neighbours taps go through" and "clear of every sticker" (it asserts the team flag codes equal ORG3_TEAM_CODES). It is green on main, so this branch changed what the organiser Team section renders or what the fake Supabase (tests/e2e-phone/fakeSupabase.mjs) must serve for the new public team read.

## What main lacks
- extends: the organiser Team section rendering the public team read with the phone spec green -- grep: OrganiserTeamSection
- a fakeSupabase answer for the new public team read the page now calls, so the phone suite sees the team and its flags -- grep: publicTeamApi

## Files
- src/pages/OrganiserProfile.tsx
- src/modules/profile/OrganiserTeamSection.tsx
- src/modules/organiser/team/publicTeamApi.ts
- tests/e2e-phone/fakeSupabase.mjs
- tests/e2e-phone/people-nationality-flag.phone.spec.ts (only if the spec itself is wrong; say why in the handover)

## What to build
1. git fetch origin main; git merge origin/main. Resolve OrganiserProfile.tsx keeping both sides. Re-run the existing OrganiserProfile tests.
2. Reproduce: read the spec and the failure (it waits for a team locator that never appears). Find what the page calls for the team now (publicTeamApi.ts) and whether tests/e2e-phone/fakeSupabase.mjs serves it. Most likely the fake server lacks the new read, so the Team section never renders in the browser test. Fix the fake (or the rendering if it is a real bug: a real visitor must still see the team flags). NEVER weaken the spec assertion to make it pass; if you must change the spec, say exactly why.
3. Run the phone suite for that one spec if you can (npx playwright test tests/e2e-phone/people-nationality-flag.phone.spec.ts per the repo's phone config); if you cannot run a browser in the sandbox, say so under Not verified.
4. tsc 0 errors in touched files; vitest src/pages src/modules/profile src/modules/organiser/team; npm run check:mojibake. Keep the PR body labels exact; run both PR-body checkers. This PR touches scripts/ (hard tier): the owner Approves at the final head, so push once at the end.

## Do NOT touch
EventCalendar.tsx, calendar/*, supabase/**, workflows, .env*, anything else.

## Done when
One push (no [skip preview]); branch merges cleanly with main; the phone spec passes or is explained; last commit subject ends with the [worker-done ...] marker.
