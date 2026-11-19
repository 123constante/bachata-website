# Dashboard switch build &mdash; handover (dt_17d77993a23d)

Brief: `brief/dashboard-switch:docs/briefs/dashboard-switch-build.md`. Branch `claude/dashboard-switch`. Flag `dashboardSwitchR4`
(`VITE_ENABLE_DASHBOARD_SWITCH_R4=true`); OFF = unchanged.

## Done
- `src/components/account/profiles/switchR4Model.ts` &mdash; the one Teacher / DJ rule (picked at onboarding = `my_role_intent_v1` roles, not declined; held does not count) and the Switch words.
- `ProfileSwitcherR4.tsx` &mdash; Round-4 sheet (both areas); `ProfileSwitcher.tsx` picks it when the flag is on.
- `src/modules/areas/home/SwitcherSoonR4.tsx` &mdash; lazy Coming soon card + link card (Add a profile, Your areas with the Discard guard, Account settings).
- `src/modules/organiser/p3/r4/R4Shell.tsx` &mdash; flag on: top-right Switch profile button in the R4 header (lazy).
- `src/modules/organiser/switch/index.tsx` &mdash; flag on: outlined SHOWING, Coming soon rows, one-row "+ Add a page" card (Add-a-profile card leaves).
- `src/pages/AccountSettings.tsx` &mdash; flag on: `QuietSignOut` link at the foot (two steps); the section&rsquo;s own plain button hidden.
- Tests: `src/components/account/profiles/__tests__/dashboardSwitchR4.test.tsx`; e2e `tests/e2e/dashboard-switch-r4.spec.ts` (in `test:e2e`).
- Shots: `docs/handover/dashboard-switch/` (before-* flag off, after-* flag on, 390x844).

## Owner decisions flagged in the PR
1. Signal: intent, not `isAreaShown` (progress steps include held roles &mdash; read from prod function def).
2. Added the sheet to the R4 organiser header (there was none since #1822).
3. "Add card = option B, one row" read as one "+ Add a page" row.

## Left / next
- Turn the flag on for Preview in Vercel and walk on a phone.
- `check:no-social-word` is red on main (not this branch).
