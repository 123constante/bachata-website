# Handover: dancer dashboard build, continuation 2 (admin 1534) -- PARTIAL

Branch `claude/profile-dash-dancer-build`, PR #1577. No DB change.

## Done
1. Strip button (Switch / Account), Switch sheet, Add a profile sheet, Account sheet (`ProfileSwitcher.tsx`, `SwitcherGate.tsx`). One profile = "Account", no Switch.
2. Edit journey checked: no hardcoded name/city, untouched Save disabled with reason, sends nothing (walk test). Fixed duplicate import in `EditScreen.tsx`.
3. `homeComponents.test.tsx`: HomeMainCard per shape, ClaimYourPage per claim status.
4. Walk spec `tests/e2e/dancer-app/profile-dash-walk.spec.ts` (8 walks, in `test:e2e`), screenshots `docs/handover/profile-dash/walk/`, `docs/handover/profile-dash-dancer-build.md`, PR body filled.
5. `npm run lint` 34/34; vitest affected dirs 2725 pass; Playwright dancer specs pass.

## Left
- Home calm first screen: HomeHero, Going tile, NumbersTiles, PartnerTile, LineupPeople still render under the main card (needs removal + test updates).
- Switch sheet is not grouped Dancer / DJ / Organiser; no "Showing" tag (tick only).
- `npm run pre-ship`, remote CI table, real-phone QA.

tsc run on 96e13dd (`tsc -p tsconfig.app.json`): 128 errors repo-wide, 0 in branch files. Note: `npx tsc --noEmit -p .` checks nothing here (tsconfig has `files: []`).
