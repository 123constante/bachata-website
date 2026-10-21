# HANDOVER: RESTYLE-RELEASE-B-WEB (slice A), ticket dt_6fbb82db530d

Brief: `bachata-admin` branch `brief/people-d89`, `briefs/people-arc/RESTYLE-RELEASE-B-WEB.md` (sha cee3705b). Branch `claude/people-release-b-web` (PR #897). Merged `origin/claude/er-ui-ember` first (clean, no conflicts).

## State: DONE (full finish)

### Done
- Ember look (`EmberWorld`) on: `AreaFrame` (Your areas, Teacher/DJ area + details), Account home, Continue as, Account settings (+ delete view), and the sign-up "What do you do?" step only (`Auth.tsx`; email steps unchanged, D106).
- D119 1 Saved toast (`shared/SavedToast.tsx`; SR announcement kept). 2 Discard sheet (`shared/leaveGuard.ts`, `GuardedLink`, `DiscardSheet`; AreaFrame owns the sheet; back link, home link, switcher area entries and Your areas row go through it; `beforeunload` while dirty). 3 Ask sheet Yes / Skip for now (`YourAreasPage`, Skip = same `setDeclined`). 4 Confirm sheets for Hide my profile and Sign out of all devices (prototype words). 5 Account home "Your areas" row (`home/AccountAreasRow.tsx`, words from `accountAreasWords` in `areaStatus.ts`). 6 Surname Save is outlined. 7 D109 short reasons ("Nothing changed yet", "Choose at least one"). 8 D120 `SiteHomeLink` (`shared/SiteHomeLink.tsx`, exported from `@/modules/areas`) on every owned screen except the roles step.
- D118: meter reads "0 of M details added" (never "No details added yet") when the server says Complete (`completenessLine(c, {complete})`; `RoleAreaPage` reads `my_roles_v1`). Meter never says "left".
- Tests: `areas.statusMeter.test.tsx` (18 shapes x 4 surfaces), `areas.restyle.test.tsx`, route/home-link assertions in account tests, updated sheet flows, 3 snapshot files (accessibility-tree diffs: home link, sheets, roles step).
- Walk: `tests/e2e/restyle-a-walk.spec.ts` (not in the e2e-smoke list; run by name). Screenshots `docs/people-arc/restyle-a/*-390.png` next to `proto-*.png` (prototype jumps).

### Red-first record
- D109 strings: literals pinned in `areas.screens.test.tsx` and `AuthSignupRoleIntent.test.tsx`; run on unchanged code: 3 failed (old strings); passed after the change.
- Consistency matrix (D118): written against unchanged code. Whole file failed on the missing Account row (and `OPEN_OR_ADD_WORDS`); with only a stub row, the unchanged meter read "No details added yet" for a Complete area with 0 filled (the contradiction), fixed by the `complete` option.
- Home link: absent before (element did not exist); every owned route asserts it.

### Asked of the rebuild (blocks built locally, `src/modules/areas/shared/`)
Link-styled button (account links keep Tailwind pills mapped to ember vars), `SavedToast`, `DiscardSheet`, `AccountShell`.

### Not built / known differences from the prototype
- Account/site header (GlobalLayout) stays above the Ember content on account screens; the `HideSurnameSwitch` (`components/profile`, not owned) keeps its site look.
- Prototype's circular back button, per-row filled "Open" pills (one primary rule) and the "answers left = blank fields" meter (D118) are not built.
- Switcher entries OTHER than the teacher/DJ area rows (dancer, organiser, ProfileSwitcher itself, not owned) do not ask "Discard changes?"; browser Back cannot be blocked (BrowserRouter, no `useBlocker`).

## Next steps
Orchestrator: fill "## Phone QA" in PR #897; owner phone look. A review worker should read `leaveGuard.ts` (module-level store) first.
