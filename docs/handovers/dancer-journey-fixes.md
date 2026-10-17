# Fix pass from the signed-in walk (ticket dt_a874ff1c956e)

Brief: arc/briefs-dancer-rebuild briefs/fix-789-walk-bugs.md. Walk: docs/review-packs/dancer-journey-fixes/WALK.md on claude/done-walk-789.
Fix commit 3fe9e0c (on top of the merge of origin/main, 12c6d45: #797 + #802, no conflict).

## Done
- **Bug 1 (no dancer profile trapped on Options / Home).** Both screens keep the "message us" text + WhatsApp button and add under it
  `screens/options/NoProfileWayOut.tsx`: "Go to my organiser area" (-> `/account/o`, ONLY when organiser_home_v1 lists >= 1 organiser),
  "Account settings" (-> `/account/settings?from=app`), and "Sign out". Sign out is ONE shared component, `screens/options/SignOutControl.tsx`
  (row + "Sign out?" sheet + the lazy `SignOutConfirm` -> `useSignOutToHome`, so it still lands Home and clears local data); the full Options
  screen's sign-out row now renders the same component. `Sheet` / `ROW` moved to `screens/options/optionsUi.tsx` (no copy).
  The organiser read uses the gate's cache key (`organiserHomeKey`, pinned equal to `organiserHomeQueryKey` by a test) and imports the
  organiser API on demand, so the dancer-app first load does not grow by a chunk. Resolves WALK Observation A.
- **Bug 2 (17 px crumbs).** `/account/settings` and `/account/settings/delete`: every crumb link is >= 44 px (Home 44, Your account 44,
  Account settings 44 on delete), via a `<style>` mounted only with that page (`CRUMB_TAP_CSS` in `src/pages/AccountSettings.tsx`).
  Organiser-area footer links untouched.
- Observations B and C left as is (orchestrator decision).

## Red first, then green
| Test | Unfixed code | Fixed |
|---|---|---|
| `journeyConsistency.test.tsx` "walk bug 1": every signed-in `DANCER_SHAPES` shape + organiser-no-dancer + organiser-and-dancer x Options/Home: Sign out + Account settings, organiser link only for an organiser, no pointer to an absent control, Sign out opens the confirm | 6 failed / 36 passed (the 3 no-profile shapes x 2 screens) | 43 passed (+1 cache-key pin) |
| `tests/e2e-phone/account-crumbs.phone.spec.ts` (phone-qa project): crumb links >= 44 px and a tap at the centre hits them | 2 failed (Home 17, Your account 17) at 390x844 | 4 passed (390x844 + 360x640) |

## Decisions (mine, with reasons)
- **Home with a profile is unchanged.** The brief's test line says "Options and Home each expose Sign out + Account settings" for every
  shape, but decision 1 changes only the no-profile state. The matrix asserts both controls ON Home for no-profile shapes, and for a
  full Home asserts the Options tab (where they live) is on screen. If the owner wants Sign out on the full Home too, that is a new decision.
- **Crumb fix lives in AccountSettings.tsx, not PageBreadcrumb/GlobalLayout.** I first added an opt-in `tapTargets` prop to the shared
  crumb, but `check:dancer-area-isolation` went red: those two files are not seams, and adding a seam is an orchestrator decision. The
  scoped `<style>` touches only the AccountSettings seam. Cleaner later option: make PageBreadcrumb a seam and add the prop.
- No budget pin raised: dancer-app 362.9 KB / 57 chunks (budget 363 / 57).

## Per-job CI table (run locally on 3fe9e0c; GitHub Actions not used)
| Workflow / job | Command | Exit | Result |
|---|---|---|---|
| unit-tests / unit (Europe/London) | `TZ=Europe/London npm run test:unit:offline` | 1 | 9073 passed, 16 skipped, 5 failed: all in `tests/integrityCouldNotRun.test.ts` ("typescript resolved in the temp repo -- precondition gone"): this container has a GLOBAL typescript, CI runners do not. Same as the previous pass. |
| unit-tests / timing | `npm run test:unit:timing` | 0 | pass |
| unit-tests / unit (America/New_York, Australia/Sydney) | tz vitest list from unit-tests.yml | 0 / 0 | 213 / 213 each |
| unit-tests / dancer-area-isolation | `--self-test`; `npm run check:dancer-area-isolation` | 0; 0 | OK (was red with the first crumb approach, see Decisions) |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0, 0 | pass |
| architecture-guard | `bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:plan-hygiene:self-test`, `prove:entry-point` | all 0 | pass |
| lint chain | `npm run lint` (after `chmod +x bin/*.sh`, as CI does) | 0 | 20 of 20 links green; eslint informational |
| perf-budget / bundle-budget | 3 self-tests; `npm run build` (job env); `check:bundle-budget`; `check:first-load-requests`; `check:chunk-cycles` | all 0 | dancer-app 362.9 KB / 57 chunks (budget 363 / 57) |
| e2e-smoke | `npm run test:e2e` (job env) | 0 | 148 passed, 1 skipped |
| phone-qa / phone-qa | `npx playwright test --config playwright.phone.config.ts` | 0 | 272 passed, 74 skipped (incl. the new crumb spec) |
| phone-qa / build-smoke | `npm run build` (fake env) + `npx playwright test --config playwright.build.config.ts` | 0 | 66 passed |
| pr-mergeable-guard, seo-check | `check:pr-mergeable:self-test`, `check:seo:self-test` | 0, 0 | pass; live checks need a preview |

## Browser walk (390x844, dev server, fake Supabase, throw-away spec not committed)
`/app/options` and `/app/home` x {no profile, organiser with no dancer}: overflow 0; every control 44-48 px high and a tap at its centre
hits it (Message us, Go to my organiser area [organiser only], Account settings, Sign out); Sign out opens the "Sign out?" sheet with
"Yes, sign out". Shots: `docs/review-packs/dancer-journey-fixes/shots-fix/`.

## Not verified
- A real sign-out on a real phone after the new no-profile path (the confirm is the same component the walk already checked end to end).
- The organiser link against the real `organiser_home_v1` (fake answers only); the production build for the no-profile walk (dev server).
- Live contract suites (need prod secrets); ci-budget-guard (needs its token); Vercel preview (see report).

## Left / next
- Nothing left from the brief. Possible follow-ups (owner): Sign out on the full Home; PageBreadcrumb as a seam with a tap-target prop.

---

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

### NITs: none taken
None is a few lines in a file this pass already touches: DancerAppShell `retry`, keyboardSafe timers, AppChrome's
FocusHeader fallback and `/account/continue` focus are untouched files; the picker `aria-labelledby` fix spans 7 callers.

### Dancer-area isolation (step 4, done)
- `scripts/dancer-area-isolation-allowlist.json`: 77 paths added to `seams`, each with seamNotes
  "dancer journey audit fixes 2026-10-16 (#789)". Removed from `protected`: `src/components/account/DancerHome.tsx`,
  `src/pages/FinishProfile.tsx`, `src/components/profile/DancerDashboard.tsx`, `src/pages/EditProfile.tsx`,
  `src/pages/AccountSettings.tsx`, `src/lib/accountSettings.ts`, and the glob
  `src/modules/event-page/bento/blocks/RsvpBlock*.tsx` (it expands to exactly the two changed files, RsvpBlock.tsx
  and RsvpBlockPlaceholder.tsx). Doc prefixes and rules untouched.
- Guard change (needs the orchestrator's eye): with no glob left in `protected`, the self-test's "protected glob"
  case would have gone green-for-nothing. It now adds a fixture-only `SELF_TEST_GLOB = 'src/fixture/Guarded*.tsx'`
  to the rules it runs with (`main` takes `deps.rules`, default `RULES`); the real check is unchanged.
- `npm run check:dancer-area-isolation` exit 0 (15 protected files checked); `--self-test` exit 0 (51 cases);
  `tests/client/dancerAppReviewFixes.test.ts` 117/117.
- Paths added to `seams` (for the orchestrator to mirror into `briefs/dancer-rebuild-INTERFACE.md`):

```
src/components/account/DancerHome.tsx
src/pages/FinishProfile.tsx
src/components/profile/DancerDashboard.tsx
src/pages/EditProfile.tsx
src/pages/AccountSettings.tsx
src/lib/accountSettings.ts
src/modules/event-page/bento/blocks/RsvpBlock.tsx
src/modules/event-page/bento/blocks/RsvpBlockPlaceholder.tsx
app/root.tsx
docs/handovers/dancer-journey-fixes.md
docs/handovers/djf-auth-chrome.md
docs/handovers/djf-dancer-app.md
docs/handovers/site-keyboard-safe.md
index.html
src/components/AuthPromptModal.tsx
src/components/GlobalHeader.tsx
src/components/LevelRatingSignInSheet.tsx
src/components/__tests__/LevelRatingGate.test.tsx
src/components/__tests__/MagicLinkConfirmationEmail.test.tsx
src/components/account/EmailText.tsx
src/components/account/profiles/PersonAvatar.tsx
src/components/account/profiles/__tests__/avatarFallback.test.ts
src/components/account/profiles/__tests__/avatarSurfaces.test.tsx
src/components/account/profiles/__tests__/continueAsHint.test.tsx
src/components/account/profiles/__tests__/signOutAuthGuard.test.tsx
src/components/account/profiles/__tests__/signOutEntryPoints.test.tsx
src/components/account/profiles/__tests__/switcherSignOut.test.tsx
src/components/account/profiles/avatarFallback.ts
src/components/account/profiles/signOutToHome.ts
src/components/auth/ConsentLine.tsx
src/components/auth/TermsAcceptCard.tsx
src/components/layout/FocusHeader.tsx
src/components/profile/AvatarUpload.tsx
src/components/search/HeaderSearch.tsx
src/components/ui/__tests__/pickerAccessibleName.test.tsx
src/components/ui/city-picker.tsx
src/components/ui/nationality-picker.tsx
src/index.css
src/lib/__tests__/accountSettings.test.ts
src/lib/__tests__/focusMode.test.ts
src/lib/__tests__/termsConsent.version.test.ts
src/lib/accountDeletionCopy.ts
src/lib/accountPaths.ts
src/lib/auth-labels.ts
src/lib/breadcrumbs/siteIa.ts
src/lib/contactLinks.tsx
src/lib/focusMode.ts
src/lib/keyboard/__tests__/previewBarKeyboardHide.test.tsx
src/lib/keyboard/keyboardSafe.ts
src/lib/keyboard/useKeyboardInset.ts
src/lib/termsConsent.ts
src/modules/event-page/bento/BentoGrid.tsx
src/modules/event-page/bento/EventStickyActionBar.tsx
src/modules/event-page/bento/TapHintSticker.tsx
src/modules/event-page/bento/blocks/ErrorScreen.tsx
src/modules/home-map/cards/controls.tsx
src/modules/organiser/shell/TabBar.tsx
src/modules/organiser/ui/PreviewBar.tsx
src/modules/organiser/ui/useKeyboardInset.ts
src/pages/AccountDeleted.tsx
src/pages/AccountRestore.tsx
src/pages/CreateVideographerProfile.tsx
src/pages/Onboarding.tsx
src/pages/OrganiserProfile.tsx
src/pages/Privacy.tsx
src/pages/VendorDashboardPage.tsx
src/pages/VendorPortal.tsx
src/pages/__tests__/AccountSettings.test.tsx
src/pages/__tests__/AccountSliceB.test.tsx
src/pages/__tests__/AuthJourneyFixes.test.tsx
src/pages/__tests__/AuthOtpDisabled.test.tsx
src/pages/__tests__/FinishProfile.test.tsx
src/pages/__tests__/FinishProfileNoProfile.test.tsx
src/pages/__tests__/LegalPages.test.tsx
src/pages/__tests__/journeyConsistencySite.test.tsx
src/pages/legal/LegalShell.tsx
vite.chunks.ts
```

### Continuation (brief `briefs/review-789-fix-cont.md` @ 925ed7b6; ticket dt_fcc38efcb499)

No code change was needed: every mutant is still red and every gate that can run in a container is green.
Base for every run: branch head `b9fd165` merged with `origin/main` @ `ecc3432` (merge-base = main head).

#### Step 5: the review's 10 mutants, re-run on the fixed code (all red; each reverted with `git checkout`)

| # | Test | Mutant | Base | Result |
|---|---|---|---|---|
| 1 | `src/lib/__tests__/focusMode.test.ts` | photo `?return=/app/welcome` rule -> `return false` | 42/42 | red 3/42 |
| 2 | same | `trimSlash` = identity (no trailing-slash folding) | 42/42 | red 2/42 |
| 3 | same | drop `.split('?')[0]` on the nested return | 42/42 | red 1/42 |
| 4 | `src/components/ui/__tests__/pickerAccessibleName.test.tsx` | CityPicker trigger drops `id` / `aria-label` / `aria-labelledby` | 25/25 | red 3/25 |
| 5 | same | remove `id="ob-city"` in `onboarding/steps.tsx:76` | 25/25 | red 2/25 |
| 6 | `avatarSurfaces.test.tsx` | PersonAvatar no-photo disc `background: 'transparent'` | 21/21 | red 16/21 |
| 7 | same | remove `onError` from PersonAvatar | 21/21 | red 8/21 |
| 8 | `journeyGuards` + `journeyConsistencySite` | `DancerHome.tsx` reverted to `origin/main` | 85/85 | red 5/85 |
| 9 | `optionsAudit.test.tsx` | `APP_ACCOUNT_SETTINGS_PATH` without `?from=app` (accountRouting) | 31/31 | red 2/31 |
| 9b | same | `optionsModel` link hard-coded to `/account/settings` | 31/31 | red 2/31 |
| 10 | `termsConsent.version.test.ts` | `termsConsent.ts` keeps its own copied `TERMS_VERSION` | 4/4 | red 4/4 |

`termsConsent.ts` does not exist on `origin/main` any more, so "revert to main" became the closest real regression
(a local version copy, audit L27); the emptied-file variant is also red 4/4.

#### Item 3: the isolation guard's self-test, read once and mutated
- Allowlist diff: the 77 seam paths + the 7 protected removals listed above; `protected` is 15 plain paths, no glob.
  The self-test adds the fixture-only `SELF_TEST_GLOB` so the trailing-`*` case still proves something.
- Self-test (51 cases) still breaks every rule on purpose; each rule mutated in the script turns it red:
  glob matcher broken -> 18 cases fail (fixture config error); rule (a) protected-edit disabled -> 18 fail;
  rule (a) non-seam disabled -> 4 fail; rule (b) disabled -> 13 fail; rule (c) disabled -> 5 fail.
- Real check exit 0 (164 changed files, 15 protected checked). Note: with a STALE local `origin/main` it exits 2
  ("protected entries match no file"): fetch main first, as its own message says.

### Per-job table (final; run locally in this container, GitHub Actions not used)

| Job / step | Command | Exit | Counts |
|---|---|---|---|
| unit-tests (London, full) | `npm run test:unit` (offline Supabase placeholders) | 1 | 9010 passed, 17 failed, 27 skipped / 371 files. All 17 are pre-existing: the same 5 files on `origin/main` @ ecc3432 give the same 17 failed / 75 passed (4 live-DB `*.contract.test.ts` with no network, 5 in `integrityCouldNotRun.test.ts` with no TS helper). 0 failures elsewhere. |
| unit-tests timing | `npm run test:unit:timing` | 0 | 65/65 |
| unit-tests New York | tz-sensitive file list from the workflow | 0 | 213/213 |
| unit-tests Sydney | same | 0 | 213/213 |
| dancer-area isolation | `--self-test`, `npm run check:dancer-area-isolation` | 0 / 0 | 51 cases; OK |
| lint chain | `chmod +x bin/*.sh; npm run lint` | 0 | 18/18 links PASS (whole-tree eslint informational, red on main too) |
| architecture-guard | every step of the job (integrity, legacy-tables, legacy-program-rpcs, lint:architecture, `AUDIT_STRICT=1 check:images`, image-widths + self-test, plan-hygiene self-test, workflow-artifact-policy + self-test, mojibake self-test + grep, entry-point proof + self-test) | all 0 | integrity 1770 files 0 issues; entry points 44/44 |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0 / 0 | OK |
| e2e-smoke | `npm run test:e2e` (workflow env) | 0 | 146 passed, 2 flaky, 1 skipped. The 2 flaky (`dancer-app/home-nights:63`, `dancer-home:168`) failed only on the first attempt of the cold dev server; re-run `--repeat-each=5 --retries=0`: 25/25 passed. |
| phone-qa phone suite | `npx playwright test --config playwright.phone.config.ts` | 0 | 268 passed, 74 skipped (spec-declared), 0 failed |
| phone-qa build-smoke | fake-Supabase `npm run build` + `playwright.build.config.ts` | 0 / 0 | 66/66 |
| perf-budget | 3 self-tests, `npm run build`, bundle-budget, first-load-requests, chunk-cycles | all 0 | budgets respected; 6/6 routes match the request pin |
| perf-budget lighthouse, doc-weight | `check:lighthouse`, `check:doc-weight` | not run | need the PR's Vercel preview via the GitHub Deployments API (`GITHUB_TOKEN`) + `VERCEL_AUTOMATION_BYPASS_SECRET`: CI-only |

### Left (next worker)
1. Nothing in the review-fix scope. GitHub Actions on the current head (billing may refuse jobs; the table above is
   the record), and the owner's phone test.
2. Organiser sign-outs (`organiser/profile/index.tsx:280`, `onboarding/SignOutLine.tsx:26`): organiser session (B1).
3. The orchestrator mirrors the seam list above into `briefs/dancer-rebuild-INTERFACE.md`.

### Not verified
- Real phone, real keyboard (Android S5 especially: verified only by attribute + keyboardSafe's CSS rule).
- S7 on a throttled network. B1 delete-flow row was green on screen even before the fix (red only in the unit table).
- Live prod data in the browser; the Vercel preview (lighthouse, doc-weight); GitHub CI on the head.
- The 4 live-DB contract suites (no network to prod here); they fail identically on main for that reason.
- `.githooks` pre-commit/pre-push are not executable in this container, so they did not run on these commits.

### Continuation: unhandled error in unit job (brief `briefs/pr789-unhandled-error.md`; ticket dt_79f599c435c9)
- Failure: GitHub job "unit (Europe/London, full)" exited 1 on `TypeError: document.elementFromPoint is not a function` (input-otp `use-pwm-badge` timer, from `MagicLinkConfirmationEmail.test.tsx`), though all tests passed.
- Fix: new `vitest.setup.ts` (wired via `setupFiles` in `vitest.config.ts`) stubs `document.elementFromPoint` only when missing.
- Before/after: `MagicLinkConfirmationEmail.test.tsx` exit 1 with Unhandled Errors -> exit 0, none. Full `npm run test:unit`: no "Unhandled Errors" section; only the pre-existing 15 failures here (4 live-DB contract files, no network; `integrityCouldNotRun` with global typescript). Not verified: the GitHub job itself.

## Sign-out storage race (brief `briefs/pr789-signout-storage.md` @ 4da16cb7; ticket dt_20bd2678a05a)

**Failure.** build-smoke `account-edges.build.spec.ts:28` ("no trace of A"), intermittent on GitHub at e92f315:
`storage keys still holding A after sign-out: auth_last_email, sb-phoneqafakenotaproject-auth-token, auth_form_state_v1`.

**Cause (verified by reading, then red-first).** `useSignOutToHome` (B1/S7) navigated home FIRST, waited up to 2 s for
the move to commit, and only THEN called `useAuth().signOut`, which is where `clearPersonScopedStorage()` ran and where
supabase-js removed its token. The URL left `/app/` while A's keys were still in storage; the spec reads storage as soon
as the URL changes, so it raced. On a shared phone the next person could find A's e-mail and form in that window, and
for good if the sign-out never completed.

**Fix (by construction, no retry or wait in the spec).** `useAuth().signOut` owns the order, in four steps
(`src/hooks/useAuth.tsx`):
1. server revoke (`auth.admin.signOut(token, scope)` with the provider's own session token), capped at 3 s;
2. `clearPersonScopedStorage()` on success, failure AND timeout;
3. the caller's new `leave` step (`useSignOutToHome` passes navigate + commit wait; H10 still holds, as `user` is still
   set in memory);
4. the in-memory sign-out (`auth.signOut({ scope: 'local' })`: storage is empty, so no request, only SIGNED_OUT), then
   storage again plus the query cache.
The Supabase session keys (`sb-*-auth-token`, `-user`, `-code-verifier`) joined the ONE list,
`src/lib/personScopedStorage.ts` (`PERSON_SCOPED_LOCAL_PATTERNS`). There is no second copy.
Changed behaviour: an ordinary sign-out while offline now clears the device and returns `signed-out`. Before, it
returned `failed` and the person stayed signed in. `everywhere` with an unrevoked server session still returns
`signed-out-locally`. `failed` now means the client never loaded (nothing is left: the person stays on the page with
the toast) or the local sign-out threw.
Organiser sign-outs call `useAuth().signOut` without `leave`, so the same order applies without a navigation.
Organiser files untouched.

**Tests.** New `src/components/account/profiles/__tests__/signOutStorageRace.test.tsx`: real AuthProvider and hook, with
a navigate spy that snapshots storage. Fast, slow (10 s, past both caps) and rejecting server call. Red-first on the
e92f315 sources (fix stashed):
```
 FAIL  ...signOutStorageRace.test.tsx > sign-out clears A from storage BEFORE leaving the page > server call fast: ...
 FAIL  ...signOutStorageRace.test.tsx > ... > server call slow: ...
 FAIL  ...signOutStorageRace.test.tsx > ... > server call reject: ...
AssertionError: expected [ …(3) ] to deeply equal []
      Tests  3 failed | 1 passed (4)
```
Green with the fix: 4/4. Existing mocks updated to the `leave` contract: `switcherSignOut`, `signOutEntryPoints`,
`AccountSettings` (`objectContaining`), and `personScopedStorage` (the token is now cleared; scope goes to the revoke; a
throwing local sign-out says `failed` with A already gone).
Spec assertion untouched. `account-edges.build.spec.ts --repeat-each=10 --retries=0` on the fake-Supabase production
build: **80 passed, 0 failed** (8 tests x 10, "no trace of A" 10/10).

**Isolation.** `vitest.config.ts` and `vitest.setup.ts` are now seams with the note "test setup for #789 (input-otp
elementFromPoint stub)", plus the new test file. Rule (a) counts only `tests/` as a test prefix, so the sibling
`__tests__` files are seams too.
Check: exit 0, OK. `--self-test`: exit 0, 51 cases.

### Per-job table (this pass; run locally in this container, GitHub Actions not used)

| Job / step | Command | Exit | Counts |
|---|---|---|---|
| unit-tests (London, full) | `npm run test:unit` | 1 | 9017 passed, 15 failed, 27 skipped / 372 files; no "Unhandled Errors". The 15 are the known ones: 3 live-DB `*.contract.test.ts` with no network (10), `integrityCouldNotRun.test.ts` (5). |
| dancer-area isolation | check, `--self-test` | 0 / 0 | OK; 51 cases |
| typecheck | `npm run typecheck` | n/a | 96 errors vs baseline 106 in `pre-ship.mjs`; none in the changed files |
| eslint (changed files) | `npx eslint <changed>` | 0 | 0 errors; the warnings were already there |
| phone-qa build-smoke | fake-Supabase `npm run build` + `playwright.build.config.ts` | 0 / 0 | 66/66 |
| build-smoke repeat | `account-edges.build.spec.ts --repeat-each=10 --retries=0` | 0 | 80/80 |
| phone-qa phone suite | `playwright.phone.config.ts` | 1 | 267 passed, 1 failed, 74 skipped. The failure was `keyboard.phone.spec.ts:358` timing out in `settled()` (hydration wait on open); there is no sign-out in that path. Re-run `keyboard.phone.spec.ts --repeat-each=5 --retries=0`: 400/400 passed. |
| e2e-smoke | `npm run test:e2e` (workflow env) | 0 | 148 passed, 1 skipped, 0 flaky |
| perf-budget | perf-env `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 / 0 / 0 / 0 | dancer-app 362.7 KB of 363 KB, 57 files. With the phone-qa build env (organiser flags on) dancer-app is 363.3 KB, over budget, as noted under S6 (flag-on only) |

### Not verified
- GitHub Actions on the new head (billing may refuse jobs), the Vercel preview, and a real phone.
- The server revoke against real Supabase. It was tested only with mocks and the fake backend.
  `auth.admin.signOut(jwt, scope)` is the same call supabase-js makes inside `signOut`.
- The lint chain and architecture-guard were not re-run in this pass. The code change is 3 ASCII source files plus tests.
- `.githooks` are not executable here, so pre-commit and pre-push did not run.
