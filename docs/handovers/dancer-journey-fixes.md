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
