# Independent review: PR #789 (dancer journey fixes)

Reviewed head `d176c86` (`claude/dancer-journey-fixes`), read-only. Review branch `claude/review-789`. Ticket dt_675750c6196e.
Brief: `arc/briefs-dancer-rebuild:briefs/review-789.md`. No code fixes in this branch; every fix below is a description.
`scripts/dancer-area-isolation-allowlist.json` not reviewed (orchestrator owns it).

**Verdict: 1 BLOCKER. The owner's next phone test fails on it in one tap path: Options &rarr; Account settings &rarr; Sign out
lands on "Welcome back" (sign-in form), the exact H10 bug the PR fixes elsewhere.** Everything else is SHOULD/NIT.

How it was checked: diff read end to end (src); production build (phone-qa build-smoke env, `_serve-build.mjs` + fake
Supabase preload, `journeyHarness` with the `DANCER_SHAPES` fixtures from the 2026-10-15 prod survey) at 390x844 and
360x640, keyboard simulated both ways as in `keyboard.phone.spec.ts`; bundle checks on clean builds of `origin/main` and head;
10 mutants; read-only SQL on prod (`_dancer_strength_v1`, `search_cities`, counts only).

---

## BLOCKER

### B1. Three sign-out buttons still land on the sign-in form (H10 only half fixed) &mdash; VERIFIED ON SCREEN
- `src/pages/AccountSettings.tsx:113` `await signOut()` then `:119` `navigate("/")` (SignOutSection).
- `src/pages/AccountSettings.tsx:155` `await signOut({ everywhere: true })` then `:166` `navigate("/")` (SignOutEverywhere).
- `src/pages/AccountRestore.tsx:42` `await signOut()` then `:48` `navigate("/")` (`leave()`, new in this PR, M26).
- All three pages sit in `<AuthGuard>` (`AccountSettings.tsx:531`, `AccountRestore.tsx:168`). When `user` goes null the guard
  redirects before `navigate('/')` runs &mdash; the race `signOutToHome.ts:17-25` documents and the handover's M77 note confirms.
- Production build, 390x844, complete dancer:

  | Tap | Final URL after 3 s | Screen |
  |---|---|---|
  | `/account/settings?from=app` &rarr; Sign out &rarr; Yes, sign out | `/auth?mode=signin&returnTo=%2Faccount%2Fsettings%3Ffrom%3Dapp` | "Welcome back" |
  | same page &rarr; Sign out of all devices | same | "Welcome back" |
  | `/account/restore` (deleted, expired) &rarr; Sign out | `/auth?mode=signin&returnTo=%2Faccount%2Frestore` | "Welcome back" |

- Why the owner hits it: Options now links straight to `/account/settings?from=app`, and FinishProfile says
  "Account settings (sign out or delete account)". Options' own Sign out works (lands on the site home), so the two
  sign-out buttons a beginner can reach behave differently.
- Same order, not checked on screen: the delete flow, `AccountSettings.tsx:409` then `:414`.
- Fix:
  1. SignOutSection and AccountRestore `leave()`: use `useSignOutToHome()` (`src/components/account/profiles/signOutToHome.ts:31`).
  2. Give the hook an `{ everywhere?: boolean }` option, passed to `signOut()` (~line 60). Have it return the outcome so
     SignOutEverywhere can still raise the "Other devices may still be signed in" toast after it leaves the page.
  3. Check whether delete-then-navigate needs the same leave-first order.
  4. Add one build-smoke row per button (incl. delete) asserting the final path is not `/auth`. Today
     `account-delete.build.spec.ts:100-107` only asserts that `logout:global` was called.

---

## SHOULD

### S1. "Back to Options" (`?from=app`) is lost on most routes into settings (M4 partial)
- **Breadcrumb (on screen):** on `/account/settings/delete?from=app`, the "Account settings" crumb links to
  `/account/settings` with no param (`src/pages/AccountSettings.tsx:507`). One tap later, "Back to Options" is gone.
  - Fix: map the crumb, e.g. `c.path === ACCOUNT_SETTINGS_PATH ? { ...c, path: withFromApp(c.path, fromApp) } : c`.
- **Code:** three more entry points never add the param:
  - `src/components/account/profiles/ProfileSwitcher.tsx:132`: "Account settings" uses `ACCOUNT_SETTINGS_PATH`, also inside the dancer area.
  - `src/modules/dancer-app/screens/home/HomeScreen.tsx:89` and `src/modules/dancer-app/screens/me/MeScreen.tsx:30`:
    the hidden-profile banners use a plain `<a href="/account/settings">`, which also forces a full reload.
  - Fix: `withFromApp(ACCOUNT_SETTINGS_PATH, where.area === 'dancer')` in the switcher; `<Link to={withFromApp(...)}>` in both banners.
- Browser Back from `/delete` does keep the param (checked).

### S2. FocusHeader "Not now" can send a signed-out person to the sign-in form &mdash; code-traced
- `src/components/layout/FocusHeader.tsx:12-18` (`focusNotNowHref`) returns any safe `returnTo` that is not itself a focus path.
- Path: the organiser launch link `/auth?mode=signup&userType=organiser&returnTo=/account/o` &rarr; "Not now" &rarr; `/account/o`.
  - Signed out: AuthGuard sends it to `/auth?mode=signin...`, so "Welcome back" with full chrome.
  - After the code step: dancer gate &rarr; `/finish-profile` &rarr; setup again.
- The dancer shell twin (`src/modules/dancer-app/shell/focusChrome.ts`, `notNowTarget`) already excludes gated targets.
- Fix: in `focusNotNowHref`, return `/` when the target is AuthGuard-only (`isAccountPath` / `isDancerGatedTarget`). FocusHeader is lazy, so the import is free.

### S3. City search: the popover flips above its trigger with a long list, pushing the search box off the top &mdash; on screen, latent in prod
- With the fake search returning 20 rows (the picker's real request: `src/components/ui/city-picker.tsx:93-96`, `p_limit: 20`, runs on open with an empty query):
  - Setup at 390, Android-style keyboard: the search box ends at y=-94 (3/3 runs).
  - Edit at 360, before any keyboard: y=-47 (Playwright could not click it).
- Prod today (read-only SQL): `search_cities` returns only `is_active` cities, and there is **1** active city of 319. So prod
  shows a 1-row list and H1 passes on screen. The moment the owner activates a few more cities, owner bug #1 ("the keyboard
  hides the search results") comes back.
- `tests/e2e-phone/keyboard.phone.spec.ts` stays green because its fake returns too few cities to flip.
- Fix:
  - `city-picker.tsx:248`: `<PopoverContent side="bottom" avoidCollisions={false}>`, plus
    `<CommandList className="max-h-[min(300px,calc(var(--radix-popover-content-available-height)-48px))]">`. Sturdier: a full-screen sheet on phones (the audit's suggestion).
  - Add a 20-row fake to the keyboard spec.

### S4. L7 not done on `/finish-profile` &mdash; on screen
The floating decorative icons draw over "Not now" and the "Account settings" link.
- Fix: `showGradientBg={false}` on the `GlobalLayout` in `src/pages/FinishProfile.tsx`.

### S5. Android: the organiser PreviewBar card no longer hides while typing &mdash; code, not on device
- `interactive-widget=resizes-content` (`index.html:5`, `app/root.tsx:71`) makes Android shrink `innerHeight`. So
  `useKeyboardInset().inset` is about 0, and `PreviewBar.tsx:36` `typing` stays false.
- What a person sees: the preview card (up to 22dvh) stays above the keyboard on organiser edit screens.
- The TabBar still hides via `data-keyboard-hide`.
- Fix: put `data-keyboard-hide` on the preview div, or report "keyboard open" when the layout viewport shrinks by 120px or more.

### S6. `lib-account` loads on every route once `VITE_ENABLE_ORGANISER_SELF_SERVE=true` &mdash; measured
- The comment at `vite.chunks.ts:318-325` ("only dancer-app loads it") holds only while the flag is off.
- `GlobalHeader.tsx:13-14` imports `accountRouting` statically, so with the flag on, 2.5 KB gz (PersonAvatar,
  avatarFallback, authRouting) lands on every public page. /event is left with about 1.1 KB of headroom.
- Flag off (CI and prod today): all green; dancer-app 362.3 KB / 57 chunks, /event +0.5 KB vs main, no chunk cycles.
- Fix: its own group for PersonAvatar + avatarFallback, or keep `accountRouting` out of `lib-account`. Measure with the flag on and off.

### S7. The `useSignOutToHome` 2 s cap starts before the navigation &mdash; suspected
- `src/components/account/profiles/signOutToHome.ts:52-58` arms `setTimeout(done, 2000)` before `await navigate(...)`.
- On a slow phone where the `/` chunk takes more than 2 s, `signOut()` can run before the guarded tree has unmounted. That reopens H10 on 3G.
- Fix: arm the timer after `navigate` resolves.
- `flushSync` may already make this moot; only a throttled-network build spec can tell.

---

## NIT
- `tests/e2e-phone/keyboard.phone.spec.ts`: with `KEYBOARD_SAFE_MUTANT=1` (a real switch, line 253), 14 of 20 cells still
  pass. They check layout but do not prove the helper. Rerun gave 6 failed / 14 passed vs the handover's 5 / 15 (edit city
  search, resize mode, is timing-dependent).
- `src/lib/keyboard/keyboardSafe.ts:185`: `timers` grows by two ids per focus until uninstall. Drop ids as they fire.
- `DancerAppShell.tsx` new `useQuery` uses the default `retry: 1`, while Onboarding uses `retry: false`. A `no_profile` error shows about 1 s late. Pass `retry: false`.
- `/account/continue` is not a focus path, so the full site header flashes between the sign-up callback and `/app/welcome`.
- Picker names: `aria-label="City"` and `<label htmlFor>` replace the trigger text, so a screen reader says "City, combobox", not "London".
  - Callers: DancerDashboard:1530, VendorPortal:652, VendorDashboardPage:1101, CreateVideographerProfile:354, OrganiserProfile:1552, EditProfile:477/487.
  - Fix: `aria-labelledby="labelId triggerId"`.
- `AppChrome.tsx:91`: FocusHeader is lazy with `fallback={null}`, so a cold /auth sign-up shows an empty 60px bar until the chunk loads.
- `organiser-contact-sheet.phone.spec.ts:85` [360x640]:
  - The 1/9 flake is plausibly caused by keyboardSafe's 300/700 ms re-checks scrolling the sheet back to the phone field.
  - "2/9 pre-fix" was an earlier PR head, not main, which has no keyboardSafe.
  - Fix: wait for `html[data-keyboard-open]` to settle before measuring; run it 20 times on main and on head.
- The breadcrumb links on the settings and delete pages are 17px tall (under 44px; left on purpose per the density rule).
- Tapping "Delete account" leaves the page body blank for about 1 s with no skeleton.

---

## Audit IDs spot-checked on screen (production build, 390x844 AND 360x640)

| ID | Result |
|---|---|
| H2 sign-up focus chrome (details, e-mail, code) | PASS: focus header only. Sign-in keeps normal chrome. |
| H5 `/app/welcome` + photo: no tabs / Events | PASS (L11 "Back to setup" present) |
| H3 Terms/Privacy rows on Options | PASS: 48px enabled links, open /terms and /privacy |
| H4/H11 no-photo avatar (header, Home, Me, Edit, switcher) | PASS: purple disc + initial (3.56:1 header, 3.23:1 cards); a broken URL falls back |
| H6 no-profile wording + action | PASS ("Message us on WhatsApp") |
| M17 picker accessible name | PASS |
| M28 sign-up "City not in the list?" | PASS, 44px |
| M21/L13 crumbs "Account settings" | PASS |
| M4 Back to Options | PARTIAL: survives Back; lost via the crumb (S1) |
| M3 Delete above keyboard | PASS |
| L1 49-char e-mail on code step | PASS (breaks at @) |
| H10 sign-out landing | PASS from Options/switcher; **FAIL** from settings x2 and restore (B1) |
| H1 keyboard vs city results | PASS with the prod shape (1 active city); FAIL with 20 rows (S3) |
| L7 decorative icons | FAIL on /finish-profile (S4) |
| 360-wide horizontal scroll | PASS on the main sign-up and dancer screens |

Profile strength copy vs prod `_dancer_strength_v1` (read-only):
- The server gives pct = 10 + 15 x (first name, city, role, photo), plus 10 x (year, styles, bio AND a link) only once all four required are set.
- The client copy matches: "70%" = 10 + 4x15, "100%" = 70 + 3x10.
- The "+10%" optional cards appear only after the required stage.
- `nextStep.ts` labels match the server's `missing` keys, and `fixtures.ts:37-44` mirrors the rule.
- No finding.

## Mutation results (all 10 mutants went red; no test stayed green)

| Test | Mutant | Result |
|---|---|---|
| `src/lib/__tests__/focusMode.test.ts` | drop the photo?return=/app/welcome rule | red 3/38 |
| same | no trailing-slash folding | red 2/38 |
| same | drop `.split('?')[0]` on the nested return | red 1/38 |
| `src/components/ui/__tests__/pickerAccessibleName.test.tsx` | CityPicker stops forwarding id/aria | red 3 (callers use stand-ins, by design) |
| same | remove `id="ob-city"` in `onboarding/steps.tsx:76` | red 2/25 |
| `avatarSurfaces.test.tsx` | no-photo disc `transparent` | red 16/21 |
| same | remove `onError` from PersonAvatar | red 8/21 |
| `journeyGuards` + `journeyConsistencySite` | DancerHome avatar reverted to main (raw img, black disc) | red 5/129 |
| `optionsAudit.test.tsx` | settings link without `?from=app` | red 2/31 (M4, L13) |
| `termsConsent.version.test.ts` | revert `termsConsent.ts` to main | red 4/4 |

Gap the mutants could not show: no test exercises sign-out from settings or restore. That is why B1 got through.

## Could not check
- Real phone, real on-screen keyboard, safe areas, camera upload; real inbox; live prod data in the browser (fixtures from the 2026-10-15 survey).
- DancerHome's own no-photo avatar on screen: the fixtures route a no-photo user to setup and a complete one to `/app/home`. The source guard and mutant cover it.
- On screen: the H7 resend-refused path, M26/L21 restore beyond the sign-out row, H12 organiser onboarding search, the delete-flow landing.
- The repo's full phone-qa and e2e suites were not re-run (only the keyboard mutant subset plus scratch specs against the build).
- GitHub CI, live DB contracts, SEO/OG, Vercel: not touched.
