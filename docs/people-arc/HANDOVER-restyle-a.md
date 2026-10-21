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
- ~~Switcher entries other than the area rows, and browser Back, do not ask~~: WRONG premise, fixed in the fix pass (B4): production runs the data router, and the area registers a router blocker.
- The area screens (Your areas, Teacher/DJ area and details) also keep the site header and the orange footer, not only the account screens (N5).
- Three ways home on Account home and Settings: header logo, breadcrumb Home (48x17, shared chrome) and `SiteHomeLink`; acceptable under D107/D120, for the owner's phone look (N4).

## Fix pass 2 (walk findings F1, F2 on PR #897)

| Finding | Fixed how | Test |
|---|---|---|
| F1 | Teacher / DJ area page reads `areaStatus` + `isAreaShown` (one mapping) with the same `my_roles_v1` and progress queries Your areas reads. A role that is not added or said no shows `not-added-card`: the Your areas status words (`areaStatus(...).words`, tone `AREA_TONE`) and the same Add action, which opens the same ask sheet (`home/DoYouSheet.tsx`, moved out of `YourAreasPage`; Yes / Skip for now through the same `answerDoYou` / `setDeclined` writers). No count, no meter, no Edit, no line-up. The details page `<Navigate replace>`s a not-added role to the area page; it shows a skeleton while roles / progress load, so no flash or early redirect. | `areas.notAdded.test.tsx`: role x 7 shapes x 4 surfaces, loading, Skip writer. Red first on 82961805: 8 of 18 failed (not added, declined, chosen-at-sign-up + progress failed, Skip), green after. E2E: `restyle-a-walk` "not-added teacher opening /account/t". |
| F2 | `AccountShell` takes `homeLink` (default true). `Account.tsx` (both shells) and `AccountSettings.tsx` sit under GlobalLayout breadcrumbs (Home crumb), so they pass `homeLink={false}`. | `areas.homeLink.test.tsx` (one link per frame, sweep of every AccountShell under breadcrumbs, Continue as keeps its one); page tests assert no `site-home-link` under crumbs; e2e walk asserts 0 SiteHomeLink + the Home crumb on account home / settings / delete, exactly 1 elsewhere. |

Sweep of slice A for the same doubling: Account home (`/account`, `/account/dancer`), Account settings, Delete account: doubled, fixed.
Your areas, teacher / DJ area and details: AreaFrame, no breadcrumbs, one link, unchanged. Continue as: no breadcrumbs, one link, unchanged.

Side effects, all expected: five existing tests pinned the old behaviour and were updated (`areas.screens`, `areas.fixpass` mocks now serve
`my_roles_v1` / progress with the role held; `releaseBSeams.empty` dj case serves DJ intent steps; the loading test waits for both skeletons);
`tests/regression/today` snapshots for account and account settings lose the "Bachata Calendar" link line (42 snapshots, only that line and its
wrapper differ); the e2e walk gives DJ routes a DJ-held fixture.

Roles failed to load on a teacher / DJ area page: shows the "Your areas did not load" error with Retry, never a count (we cannot say the role is added).

### Gates (fix pass 2, this head; exit codes)
- `npm run test:unit:offline`: exit 1, ONLY pre-existing `tests/integrityCouldNotRun.test.ts` (5 tests; the same 5 fail on the unchanged base: the sandbox cannot resolve the TS helper). The two `tests/regression/today` account snapshot files were failing on the removed link and are updated (76/76 pass).
- Touched suites `src/modules/areas src/pages src/components/account`: 51 files, 1007 tests pass.
- `npm run typecheck`: exit 2 from pre-existing generated-type errors (`venuePublicService.ts` etc.); 0 errors in any file this pass touches.
- `npm run lint` chain: 19 of 20 links PASS; `check:integrity` exit 126 only because `bin/check-integrity.sh` is not executable here; `bash bin/check-integrity.sh` exit 0 (2152 files, 0 issues). eslint link informational (skipped by the chain's rule).
- `check:rpc-typing`, `check:wallclock-brand`, `check:dancer-area-isolation`: exit 0.
- `npm run build`: exit 0. perf-budget: `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles`: exit 0.
- build-smoke (`playwright.build.config.ts`): exit 0, 66 passed.
- phone-qa (`playwright.phone.config.ts -g "account|area"`, 390x844): exit 0, 14 passed. The full phone suite was not run.
- `tests/e2e/restyle-a-walk.spec.ts`: 25 pass at 390x844 and 1280x800 (one full run showed 6 failures, 4 from the DJ fixture now being correctly "not added" and fixed in the spec, 2 on account home / settings at 390 that passed on re-run once the other 4 were fixed: not reproduced, treat as load flake). Screenshots refreshed: account-home, account-settings, dj-area, dj-details, new teacher-not-added.
- Not run: Docker / live-DB contract suites, lighthouse, a real phone, the owner's look at the new Not added card.

### Not verified
Real-data shapes were not re-surveyed this pass (no new query, no new field; the status words come from the existing server answers). A real dancer-only account on a phone: orchestrator walk.

## Parked questions (fix pass 2)
1. Roles query fails on a teacher / DJ area page. Default: "Your areas did not load" with Retry. Options: show the old page. Cost if wrong: small. `src/modules/areas/shared/RoleAreaPage.tsx` (the `roles.status === 'error'` branch).
2. After Skip for now on the not-added area page the person stays there and reads "You said no" with Add still offered (same as Your areas). Options: go back to Your areas. Cost if wrong: small. `RoleAreaPage.tsx` `NotAddedCard.done`.
3. The Not added card has only the status tag and Add (no explanatory sentence), to keep "same words as Your areas". Options: add a line. Cost if wrong: small. `RoleAreaPage.tsx` `NotAddedCard`.

## Next steps
Orchestrator: fill "## Phone QA" in PR #897; owner phone look. A review worker should read `leaveGuard.ts` (module-level store) first.

## Fix pass (ticket dt_32fac2df398c, brief FIX-RESTYLE-A sha 48d60e95)

Review: `claude/review-restyle-a:docs/people-arc/reviews/RESTYLE-A.md` (head 94b5c428). Every behaviour fix is red-first: the new
and changed tests were copied onto a 94b5c428 worktree and run there: **17 failed**, every one listed below; all pass on the fix head.

| Id | Fixed how | Test (red on 94b5c428, green now) |
|---|---|---|
| B2 | `git merge origin/claude/er-ui-ember` (4b2a357, clean, no conflicts). Small-text gold to `--gold-fg`: AreaFrame back link, DancerHome Try again / Sign out / settings / organiser links, `settings-back-to-options`, Your areas "Open". `--gold` kept for icons, fills, borders. | `emberContrast.test.ts` (from ER-UI) |
| B1 | The 2 build specs tap `settings-signout-all-confirm` after `settings-signout-all` (D119 #4 made it a sheet). No other spec taps the old one-step path (searched `tests/e2e-build`, `tests/e2e`). Test not weakened: same `logout:global` + landing assertions. | build-smoke 66/66 (was 64/66) |
| B3 | `SavedToast` pill is solid: `bg-[var(--ok-fg)] text-[var(--btnfg)]`, no `backdrop-blur`, no translucent `--ok-bg`. Measured over the orange footer in the walk. | `areas.statusMeter.test.tsx` "B3: the Saved toast is a solid pill"; walk "saved toast over the footer" (computed contrast >= 4.5, fails on a translucent ground) |
| B4 | One guard: `shared/useAreaLeaveBlocker.ts` registers a router blocker (getBlocker/deleteBlocker like the rebuild's `useLeaveBlocker`, NOT `useBlocker`, bundle budget) when a data router is present; `AreaFrame` drives the same `DiscardSheet` from `blocker.state` (Keep editing = `reset()`, Discard = `proceed()`). Under the blocker, `GuardedLink` and the switcher let navigation run and the blocker asks; the module store stays the fallback for MemoryRouter / BrowserRouter. `beforeunload` sets `e.returnValue = ''`. | `areas.leaveBlocker.test.tsx`: 6 leave paths (back link, home link, switcher area, switcher dancer row, header link, history back) x dirty/clean + returnValue; red on 94b5c428: header link, switcher dancer, history back, returnValue. Walk "browser back with edits asks first" (real data router) |
| S1 | px, not rem: Account / Continue as / Settings titles, `CARD` padding `p-[16px]`, every `space-y-*`/`gap-*`/`pt-*`/`pl-*`/`h-11` in Settings, DancerHome, Continue as, HideSurnameCard (`text-xs` -> 13px). | walk shots |
| S2 | One title class `shared/typeScale.ts` `PAGE_TITLE` (28px/800, the prototype's) in AreaFrame (now its own row under the back link) and the account screens. Meter: "N of M" is a 34px/800 number with the rest at 17px muted; the other D118 sentences at 24px/800. `completeness-line` text is unchanged, so D118 words match exactly. | statusMeter (text unchanged), walk shots |
| S3 | Settings: Change email and Show again are `OUTLINE`; local `PILL`/`OUTLINE` disabled = `--card2` ground + `--mut` text (no opacity-on-orange). Account home rule: Finish your profile is the one filled action; the hidden banner link is always outlined; the organiser link is outlined while Finish shows. | `AccountSettings.test.tsx` "one primary ... (visible/hidden)"; `AccountSliceB.test.tsx` "DancerHome: Show again is outlined, ..." |
| S4 | `accountAreasRowWords` (areaStatus.ts): no sublabel while `my_roles_v1` or progress is pending; "Open Your areas" when `my_roles_v1` failed; D112 words only once settled. A failed progress read gives the same words Your areas shows without it. | statusMeter "roles pending" / "roles error" (teacher + DJ) |
| S5 | The lower `settings-disable-error` renders only when the sheet is closed. | `AccountSettings.test.tsx` no_profile case; `accountSettings.today.test.tsx` (one alert) |
| S6 | Roles-step buttons get `focus-visible:outline-2 ... outline-[var(--gold)]`. | walk "sign-up roles step" (Tab to a role: 2px solid outline) |
| S7 | The meter shows the skeleton until `my_roles_v1` has answered too. | statusMeter "roles pending: ... the meter waits" |
| S8 | PR body: real `## Verified on real data` (fix-pass survey) and `## Phone QA` sections; both parsed locally with the check scripts' `parse()`. | `check-pr-*.mjs` parse OK |
| N1 | Shape "held not complete, all filled" added and pinned (meter "All M details added", row "... left"); fixed `setTimeout` sleeps replaced by `waitFor(qc.isFetching() === 0)`. | statusMeter |
| N2 | `AccountShell`, `AccountAreasRow`, `Auth.tsx` import from `@/modules/organiser/ui`. Measured: bundle budget, first-load requests and chunk cycles all still pass. | perf-budget steps |
| N3 | Discard is red quiet text (`--danger`, no fill), Keep editing stays the one primary. The sheet's body line is kept (acceptable per review). | walk discard shots |
| N4 | Kept; listed in known differences for the owner's phone look. | - |
| N5 | Added to known differences. | - |

### Phone-qa note (found by this pass)
S1's px spacing pushed the delete view's Delete button 26px under the keyboard line (`keyboard.phone.spec.ts` "account settings:
delete confirm word + Delete button", resize + overlay). Fixed with the site's own `keyboardSafe` hook: the field and the button sit
in a `data-keyboard-scope`, the button in `data-keyboard-results`, so the hook keeps it on screen. Keyboard spec 80/80 after.

### Asked of the rebuild (from this review)
- `PrimaryButton` disabled look: `--card2` ground and `--mut` text instead of `opacity-50` on orange (S3).
- A danger-quiet button variant (N3 is built locally in `DiscardSheet`).
- `SheetView` title (prototype: 24px/800 left) and `GhostButton` fill vs text-link "Skip for now"; Chip placement on Teacher details.

## Parked questions (fix pass)
1. Account home one-primary rule (S3). Default: Finish your profile is always the filled one; Show again (banner) outlined; organiser
   link outlined while Finish shows. Options: make Show again the filled one when hidden. Cost if wrong: small.
   `src/components/account/DancerHome.tsx` (OUTLINE const and the two links).
2. Account row when only `my_profile_progress_v1` fails (S4). Default: the same words Your areas shows without progress (one fact,
   one wording), not the neutral line. Options: neutral "Open Your areas" on any error. Cost if wrong: small.
   `src/modules/areas/home/areaStatus.ts` `accountAreasRowWords`.
3. AreaFrame title row (S2). Default: back link on its own row, then the 28px title (the prototype's stacked header). Options: 22px
   inline with the back link. Cost if wrong: small. `src/modules/areas/shared/AreaFrame.tsx`.

### Gates (fix pass, this head; full table in the PR body)
build-smoke 0 (66/66); phone-qa keyboard spec 80/80 after the delete-view fix (full suite under load: the 2 delete-view failures fixed, 1 organiser flake passes alone); perf-budget steps 0; e2e-smoke 0 (160 passed); touched-area vitest 0 (1351); unit offline 1 (5 sandbox `integrityCouldNotRun` + 1 load flake that also fails on 94b5c428 under load and passes alone); restyle walk 0 (22); lint chain 19/20 PASS (integrity exit 126 is the sandbox chmod; via bash 0).

## Next steps
Orchestrator: phone look by the owner (28px titles, stacked AreaFrame header, Discard as red text); the 3 parked questions above.
