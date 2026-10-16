# Handover: dancer journey fixes, finishing slice (claude/dancer-journey-fixes)

Ticket dt_49a3af1c5b92. Brief: arc/briefs-dancer-rebuild briefs/dancer-journey-fixes-finish.md.
Status: see the CI table and "Not verified" at the end.

## Step 0: slice B merged
- `git merge origin/claude/djf-dancer-app` (d5f9808). One conflict, `src/lib/focusMode.ts` (add/add): kept slice A's module
  (leaf, superset: `/auth` with no mode and `/auth/callback?mode=signup` count; case/trailing-slash folding). Slice B's copy was a
  placeholder that said "on merge, Slice A's version wins". Added the gap B reported: the photo hand-off carrying an onward
  destination (`/app/me/photo?return=%2Fapp%2Fwelcome%3FreturnTo%3D...`) is focus too (path compared before `?`); new row in
  `src/lib/__tests__/focusMode.test.ts`. Importers: AppChrome, FocusHeader, DancerAppShell, focusChrome.ts, FinishProfile -- all
  unchanged and green (focusMode, focusChrome, signupFocusChrome tests: 80/80).

## Step 1: done per audit ID

| ID | Result | Where / test |
|---|---|---|
| M17 | Fixed. `CityPicker` + `NationalityPicker` take `id` / `aria-label` / `aria-labelledby` and forward them to the `role="combobox"` trigger. Every caller in `src` is named: the existing visible `<label htmlFor>` now points at the trigger (setup CityCard, Edit city + nationality, FinishProfile, Auth sign-up, AuthStepper, Onboarding, EditProfile, OrganiserProfile -- the last two had a `htmlFor` that pointed at nothing); organiser/vendor screens got `aria-label="City"` only. | `src/components/ui/__tests__/pickerAccessibleName.test.tsx` (25; red 24 failed -> 25 passed). Rendered rows for the dancer callers and Auth; source rows for heavy legacy pages; a completeness row fails if any `<CityPicker`/`<NationalityPicker` in `src` is missing from the table. |
| M24 | Verified, already removed by slice B. Server rule read READ-ONLY (prod `_dancer_strength_v1`): pct = 10 + 15 x (first name, city, role, photo) + 10 x (year, styles, bio+link) only once the four required are set. The UI shows only the server's `strength.pct`; no "70%" literal remains in `src` (grep). Required-done in the client is the one `firstRequiredStage(strength.missing)` reading, shared by setup and the focus chrome. | grep + SQL, no code change |
| M28 (sign-up) | Fixed. Auth.tsx city step: "City not in the list? Message us to add your city", same text and builder as setup/Edit (`dancerMessageUsUrl(ADD_CITY_MESSAGE)`), 44px tap area. The second copy (`CITY_REQUEST_WHATSAPP_URL`) is deleted. | pickerAccessibleName (Auth row), `auth.today` snapshots (4, intended) |
| L1 (code step) | Fixed. `MagicLinkConfirmation` uses the shared `components/account/EmailText` (its private copy deleted). | `src/components/__tests__/MagicLinkConfirmationEmail.test.tsx` (49-char email; red 1 -> green 1) |
| H6 wording | Fixed in `src/lib/profileCompletion.ts`: `NO_PROFILE_TEXT` = "Your account does not have a dancer profile yet. Message us and we&rsquo;ll set one up for you." (no rating words); `NO_PROFILE_CONTACT_URL` = the dancer prefill (`dancerMessageUsUrl(NO_PROFILE_MESSAGE)`), not "list my events". | FinishProfile.test pins the dancer prefill; 17 `today` snapshots updated (diff = exactly these two strings) |
| M21 / L13 crumbs | Fixed in `siteIa.ts`: `accountSettings` label "Account settings"; `accountSettings.delete` parent `accountSettings` (no "Account ownership" crumb). | breadcrumb tests green |
| M4 remainder | Owner decision applied: NO focus mode on `/account/settings*`, restore, deleted (focusMode maps only sign-up + setup). Options links to `/account/settings?from=app` so settings shows "Back to Options"; pinned equal to `withFromApp('/account/settings', true)`. The delete button over the keyboard (M3) is now a keyboard spec row (Step 2). | `optionsAudit.test.tsx` "M4" |
| Chunk ratchet 60 vs 58 | Fixed with pins, not allowance: `vite.chunks.ts` puts `src/lib/focusMode.ts` in `lib-event-rules` (it had become a chunk on EVERY budgeted route: +1 on all 9) and the one avatar (`PersonAvatar` + `avatarFallback`) with `accountRouting` in a new `lib-account` group. dancer-app 61 -> 57 chunks (allowance tightened 58 -> 57); all other routes exactly at allowance. KB 362.3 vs 361: raised to 363 with the measurement in `perf-budgets.json`. | `tests/chunkClassifier.test.ts` (43) |
| B: focusMode photo hand-off | Fixed: `/app/me/photo?return=/app/welcome?returnTo=...` is focus too. | focusMode.test row |
| B: DancerHome own avatar | Fixed: DancerHome, the Finish photo field (`AvatarUpload`) and the switcher's unknown-side face all use `PersonAvatar`. | `journeyGuards.test.tsx` (source: avatars only via PersonAvatar), `avatarSurfaces.test.tsx` |
| B: OptionsScreen sign-out note | Left as B described (the toast carries the error after the hook returns to Options). | -- |
| B: dancer-area isolation | NOT fixed, orchestrator decision: see CI table. | -- |
| M27 | Not mine (owner: support inbox). | -- |

## Step 2: keyboard rows (`tests/e2e-phone/keyboard.phone.spec.ts`)
10 rows x 2 keyboard modes x 2 phones = 40 new cells: `/account/settings/delete` (field + Delete), setup first name, setup shown name + Continue, setup city search, Edit first name, Edit city search, Edit website + Save, Finish first name + Save, Finish all-missing first name, Finish city search. New switch `KEYBOARD_SAFE_MUTANT=1` serves a do-nothing helper, so red-first needs no source edit.

Red first (`KEYBOARD_SAFE_MUTANT=1 npx playwright test --config playwright.phone.config.ts tests/e2e-phone/keyboard.phone.spec.ts --project phone-390x844 -g "delete|dancer|finish"`): 5 failed / 15 passed. Delete, resize mode:
```
+   "field outside the visible area: top 725, bottom 769, visible 0-470",
+   "field: a tap at (195, 469) hits section",
+   "primary button outside the visible area: top 776, bottom 820, visible 0-470",
+   "primary button: a tap at (195, 469) hits section",
- Timeout 4000ms exceeded while waiting on the predicate
```
Edit city / website without the helper: "field: a tap at (195, 469) hits nav[dancer-app-tabs] in a fixed nav[dancer-app-tabs]".

Real bug found WITH the helper on, fixed: on `/app/me/edit`, City opened then keyboard raised left the search box at top 500 of 470 visible. The box lives in a fixed popover anchored to its trigger and `scrollBy()` stops at the fixed parent, so nothing scrolled. `src/lib/keyboard/keyboardSafe.ts` now finds the popover's trigger (`aria-controls`) and scrolls that into view; the popover re-places under it. City rows 36/36 with `--repeat-each 3`.

## Step 3: consistency checks
- `src/modules/dancer-app/__tests__/journeyChecks.ts`: the shared checks (a) no copy names a control that is not on screen, (b) every empty/error state offers an action, (c) every disabled control shows a reason, (d) avatars only through PersonAvatar with a non-black, non-transparent no-photo disc. `journeyGuards.test.tsx` self-tests each check on a broken and a fixed example.
- `journeyConsistency.test.tsx`: 7 in-app screens x 7 prod shapes = 49 cells, plus Terms/Privacy on Options are enabled links (6 shapes) and the avatar face on Home/Me/Edit (18 cells).
- `src/pages/__tests__/journeyConsistencySite.test.tsx`: 6 site pages x 6 shapes = 36 cells + 2 DancerHome avatar cells.
- Bugs the matrix found (red -> green): with no dancer profile, Home said "Message us from Options" (Options cannot load without a profile), Me and Edit offered only "Try again", Options offered only "Retry". All four now show the server reason + "Message us on WhatsApp" (the dancer prefill). Options red-first: 1 failed -> passed.

## Decisions (mine, with reasons)
- focusMode: slice A's module kept whole (it was the superset and the leaf for the perf ratchet); slice B's file said A's wins.
- The dancer "Message us" builder lives in `src/lib/contactLinks.tsx` (the file it derives from, already on every first load); `modules/dancer-app/api/messageUs.ts` re-exports it. A separate `src/lib` module cost a first-load request on every route (measured), so it was folded in.
- Chunk pins instead of allowances (dispatch preference). focusMode joins `lib-event-rules` because its bytes were already on every route (root AppChrome); the avatar joins `accountRouting` because every importer of the avatar already loads accountRouting and only dancer-app among budgeted routes does.
- KB budget raised 361 -> 363 rather than cut features: the bytes are the owner-reported fixes; chunks fell by 4.
- No focus mode on account pages (owner decision); the way back is the `?from=app` "Back to Options" link.
- Keyboard: on setup, Continue is asserted from the LAST field, not the first: at 360x640 with first name focused Continue is two fields lower; the keyboard's Next key moves on (audit M2), and forcing the button up would hide the next field. Same for Finish (Save asserted when first name is the only field) and Edit (Save from the last text field).
- `NO_PROFILE_TEXT` no longer mentions rating; the rating card keeps its own `NO_PROFILE_REASON` ("...so it can&rsquo;t rate").

## Per-job CI table (run locally in this container; GitHub Actions not used)

| Workflow / job | Command | Exit | Result |
|---|---|---|---|
| unit-tests / unit (Europe/London, full) | `TZ=Europe/London npm run test:unit:offline` | 1 | 8958 passed, 16 skipped, 10 failed in the full parallel run. Re-run alone: 5 of those 6 files pass (organiser shell, heroMetaLine, eventTruth matrix, gateCacheReset, account.today = load flakes). `tests/integrityCouldNotRun.test.ts` (5) fails ONLY because this container has a GLOBAL typescript (`/opt/node22/lib/node_modules/typescript`), so its "typescript must not resolve in a temp repo" precondition is false here; CI runners have none. Live `*.contract.test.ts` not run (prod secrets; `ci-live-db-gate` says a PR runs them). |
| unit-tests / unit (America/New_York, Australia/Sydney) | the tz-sensitive vitest list from unit-tests.yml | 0 / 0 | 213 / 213 passed each |
| unit-tests / timing | `npm run test:unit:timing` | 0 | 65 passed |
| unit-tests / dancer-area-isolation | `--self-test`; `npm run check:dancer-area-isolation` | 0; **1** | **RED, needs the orchestrator** (see below) |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0, 0 | pass |
| architecture-guard | `chmod +x bin/*.sh`, `bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:image-widths(+self-test)`, `check:plan-hygiene:self-test`, `check:mojibake:self-test`, `check:workflow-artifact-policy(+self-test)`, `prove:entry-point(+self-test)` | all 0 | integrity 1767 files, 0 issues |
| lint chain | `npm run lint` | 1 then 0 | the only red link was `check:integrity` exit 126 = the checkout lost the exec bit on `bin/*.sh` (CI chmods first); with +x it passes, 17 other links PASS. eslint is informational. |
| perf-budget / bundle-budget | self-tests; `npm run build` (job env); `check:bundle-budget`; `check:first-load-requests`; `check:chunk-cycles` | 0 all | all 9 routes within KB and exactly at chunk allowance; dancer-app 362.3 KB / 57 chunks (budget 363 / 57); 6 prerendered routes match request pins; 251 chunks, no cycle |
| e2e-smoke | `npm run test:e2e` | 1 then 0 | 147 passed, 1 skipped, 1 failed: `dancer-app/me-edit.spec.ts` nationality (looked for a combobox INSIDE `#nationality`; M17 put the id on the combobox). Spec fixed; me-edit.spec 14/14. `home-nights.spec.ts` and `options.spec.ts` passed in the run. |
| phone-qa / phone-qa | `npx playwright test --config playwright.phone.config.ts` | 1 | 259 passed, 74 skipped, 1 failed: `organiser-contact-sheet.phone.spec.ts:85` [360x640] "a tap on Done reaches Done" (organiser screen). Passes alone (12/12). With `--repeat-each 3`: 1/9 fail on this head, 2/9 fail with the PRE-fix keyboard helper, so it is a pre-existing flake, not from this branch. |
| phone-qa / build-smoke | `npm run build` (job env) + `npx playwright test --config playwright.build.config.ts` | 0 | 62/62, incl. `account-edges.build.spec.ts` |
| workflow-lint | masking; notification (+self-test) | 0 | pass |
| ci-budget-guard | `check-ci-budget.mjs --self-test`; run | 0; 2 | self-test pass; the guard needs `CI_BUDGET_GITHUB_TOKEN` (could not run) |
| pr-mergeable-guard | `check:pr-mergeable:self-test` | 0 | pass |
| seo-check / og-image-check | `check:seo:self-test` | 0 | the live checks need a preview deploy: not run |
| phone-qa-section / real-data-verified | `check-pr-phone-qa.mjs --self-test` | 0 | the PR-body checks run on the PR the orchestrator opens: its body must carry the Phone QA section and "Verified on real data" |
| db-contract-check | -- | -- | needs prod secrets: not run |

### dancer-area isolation (needs the orchestrator)
72 rule-(a) lines. This branch is by design a cross-area fixes PR (slice A site chrome + keyboard helper + slice B + this slice), so it changes files the rebuild guard lists as PROTECTED: `DancerHome.tsx`, `FinishProfile.tsx`, `DancerDashboard.tsx`, `EditProfile.tsx` (M17 picker names only), `AccountSettings.tsx`, `lib/accountSettings.ts`, `RsvpBlock.tsx`, `RsvpBlockPlaceholder.tsx`, plus ~64 site files that are not seams. The script says adding a seam is an orchestrator decision mirrored from `briefs/dancer-rebuild-INTERFACE.md`, so I did not edit `scripts/dancer-area-isolation-allowlist.json`. Rule (b) and (c) are clean (no site file imports the dancer module; Auth reads `lib/contactLinks`).

## Not verified
- No real phone: real on-screen keyboard (both keyboard models are simulations), real camera/photo upload, safe-area insets.
- No real inbox (code e-mail) and the support mailbox (M27, owner).
- No browser walk against PROD data; shapes come from the fixtures built from the 2026-10-15 prod survey. The only prod read this slice was the READ-ONLY `_dancer_strength_v1` definition (M24).
- Live DB contract suites, SEO/OG/Lighthouse (need secrets or a preview deploy). Vercel not touched.
- `/code-review` not run (no owner in the session).
- The full unit and phone runs each had load-only failures listed above; each was re-run in isolation, but CI on GitHub may still show the phone flake.

## Review fix (review #789, brief `briefs/review-789-fix.md` @ 23eaac07; ticket dt_94afc180f567)

Review: `origin/claude/review-789:docs/review-packs/dancer-journey-fixes/REVIEW.md` (head reviewed `d176c86`).

### B1 (done): every sign-out button goes through `useSignOutToHome`

- The hook (`src/components/account/profiles/signOutToHome.ts`) now takes `{ everywhere, to, state, onFailed }`
  and returns the `SignOutOutcome` (was `'ok' | 'failed'`). No second copy of the leave-first order anywhere.
- Moved onto it: Account settings Sign out, Sign out of all devices (still raises the "Other devices may still be
  signed in" toast on `signed-out-locally`), the delete flow (`to: /account/deleted`, `onFailed: 'stay'`, then
  `otherDevicesSignedIn` state when the sign-out was not complete), restore `DeletedCard` Sign out, and the old
  `/account` home's Sign out (`DancerHome` `SignOut`, same bug, also inside `AuthGuard`).
- Decision: a failed sign-out now comes BACK to the page and says why in a toast (the hook's existing contract).
  The inline error lines stay for the case where the page never unmounted. Tests updated to that contract:
  `AccountSettings.test.tsx` (sign out everywhere failing; delete caveat now appears after the page),
  `AccountSliceB.test.tsx` (restore failure), `switcherSignOut.test.tsx` (`'ok'` -> `'signed-out'`).
- NOT moved (out of scope, owned by the organiser-rebuild session): `src/modules/organiser/profile/index.tsx:280`
  and `src/modules/organiser/home/onboarding/SignOutLine.tsx:26` still sign out then `navigate('/')`. If those
  screens sit inside an AuthGuard they have the same H10 race; the organiser session should move them onto
  `useSignOutToHome()`. `InviteRedeemPage` "Not you?" deliberately goes to sign-in; `Profile.tsx` is not guarded.
- Table test: `src/components/account/profiles/__tests__/signOutEntryPoints.test.tsx` (6 rows, real `AuthGuard`,
  data router with lazy landing routes as in framework mode). Red-first on `d176c86` source:

```
FAIL 'Account settings: Sign out -> Yes, si…'   AssertionError: expected '/auth' to be '/'
FAIL 'Account settings: Sign out of all dev…'   expected '/auth' to be '/'
FAIL 'Restore (deleted, expired): Sign out'     expected '/auth' to be '/'
FAIL '/account home: Sign out -> Yes, sign …'   expected '/auth' to be '/'
FAIL 'Account settings: Delete my account'      AssertionError: expected '/auth' to be '/account/deleted'
Tests  5 failed | 1 passed (6)      (the passing row is Options, already fixed)
```

- Build-smoke rows: `tests/e2e-build/account-delete.build.spec.ts` "sign-out lands on ..." x4 (final path after the
  move settles, plus 1.5 s). On the unfixed source (production fake-Supabase build): settings Sign out, settings
  Sign out of all devices, restore Sign out red with `Received string: "/auth"`; the delete row passed on the
  unfixed build (the race did not fire on screen there; the unit table catches it). With the fix: 11/11 pass.

### S1 (done): `?from=app` kept on every route into settings
- New `APP_ACCOUNT_SETTINGS_PATH` in `src/lib/accountRouting.ts` (one value; Options' `optionsModel` now points at it).
- Settings crumb maps `/account/settings` -> `withFromApp(...)`; switcher row uses it when `where.area === 'dancer'`;
  Home and Me hidden-profile banners are `<Link to={APP_ACCOUNT_SETTINGS_PATH}>` (no full reload).
- Tests: crumb x2 (`AccountSettings.test.tsx`), switcher x2 + banner source guard (`switcherSignOut.test.tsx`);
  `profiles.test.tsx:105` and `homeAudit.test.tsx:149` updated to the `?from=app` href.

### S2 (done): FocusHeader "Not now" never targets a guarded page
- `focusNotNowHref` returns `/` for `isAccountPath`, `isDancerAppPath` (/app/*) and `isDancerGatedTarget`.
  `isDancerAppPath` added beyond the review's two because `/app/home` passed both (red row proved it).
- Red-first: 4 new rows in `focusMode.test.ts` failed on the unfixed function (`/account/o`, `/account`,
  `/app/home`, `/account/settings`); 42/42 after.

### S4 (done): `/finish-profile` passes `showGradientBg={false}`; source guard in `AccountSliceB.test.tsx` L7 block.

### S3 (done): city picker popover stays below its trigger
- `city-picker.tsx`: `side="bottom" avoidCollisions={false}`; `CommandList` max height
  `min(300px, var(--radix-popover-content-available-height) - 48px)` (the review's fix; a full-screen phone sheet
  was the sturdier option, not taken: bigger change to a shared picker used by 7 callers).
- `keyboard.phone.spec.ts`: 2 rows with the picker's real first request (empty query, 20 rows), both keyboards, both sizes.
- Red-first on the unfixed picker: 1 of 8 cells red (`[phone-390x844] keyboard (resize) dancer setup: city search,
  20-row list`, the review's measured case); 7 passed. Fixed: 8/8, and 58/60 over `--repeat-each=3` of every city
  row, the 2 failures being "Execution context was destroyed / navigation" from Vite reloading while I edited files
  during that run (dev-server suite), not layout.

### S5 (done): organiser PreviewBar hides its preview card and live note under an Android keyboard
- `data-keyboard-hide` on the preview card and the live note (index.css hides those whenever keyboardSafe flags
  `html[data-keyboard-open]`, which it does for a resize keyboard too). Nothing else on organiser screens changed.
- Test: `src/lib/keyboard/__tests__/previewBarKeyboardHide.test.tsx` (red on the unfixed bar: `expected false to be true`).

### S6 (done): `lib-account` off the public routes with the self-serve flag on
- Cause, measured: `authRouting` (import-free) was pulled INTO `lib-account` (accountRouting imports it), and the
  header imports `authRouting` + `accountRouting` when `VITE_ENABLE_ORGANISER_SELF_SERVE=true`.
- Fix: new leaf `src/lib/accountPaths.ts` (`ACCOUNT_HOME_PATH`, `isAccountPath`; accountRouting re-exports);
  GlobalHeader reads it; `accountPaths.ts` and `authRouting.ts` join `LIB_EVENT_RULES_MODULES` (the every-route
  group, as focusMode did). `tests/chunkClassifier.test.ts` list updated.
- Also: S2's first version imported `isDancerAppPath` from `modules/dancer-app/shell/routes` into FocusHeader, which
  split `routes.ts` into its own chunk (dancer-app 58 vs allowance 57). Moved into `accountRouting`
  (`isSignedInOnlyTarget`, `DANCER_APP_PREFIX` pinned equal to `DANCER_APP_BASE` by a test).
- Measured on PRODUCTION builds (perf-budget env), no budget raised:

  | build | bundle-budget | first-load-requests | chunk-cycles | /event KB | dancer-app KB / chunks |
  |---|---|---|---|---|---|
  | head, flag off (CI, prod) | exit 0 | exit 0 | exit 0 | 377.6 / 381 | 362.5 / 363, 57 / 57 |
  | head, flag on | exit 1 (2 overs) | exit 0 | exit 0 | 377.8 | 363.1 / 363, 58 / 57 |
  | d176c86, flag on | exit 1 (9 overs) | exit 1 (6 overs) | exit 0 | 379.9 | 362.9, 58 / 57 |

  Flag on, every public route (home, event, parties, classes, faq, landings) is back at its flag-off chunk count and
  allowance. Left with the flag on: auth 34 vs 33 (base 35) and dancer-app 58 vs 57 (base 58) chunks, and dancer-app
  363.1 KB vs 363 (+0.2 KB vs base: the B1/S1 code). Both routes need lib-account (AuthGuard imports it). Not fixed
  here; flag is off in CI and prod. Whoever turns the flag on must re-measure these two.

### S7 (done, in B1): the 2 s cap is armed only after `navigate()` resolves (`Promise.race` after the await).
  Not proven on a throttled network (no throttled build spec written).
