# Handover: Slice B, dancer app + account (`claude/djf-dancer-app`)

Brief: `briefs/dancer-journey-fixes.md` (arc/briefs-dancer-rebuild @ d13fd4d). Audit:
`docs/audits/dancer-journey-2026-10-16/report.md` (claude/dancer-journey-audit). Base: main @ ecc3432. No PR (orchestrator merges).

## Two CI reds the orchestrator has to decide (config files neither slice owns)
1. **perf-budget / check:bundle-budget**: dancer-app first-load **362.1 KB gzip > 361 KB** (chunks are back to 58/58, no first-load
   request added). The +1.7 KB is real Slice B code (one avatar, focus chrome, sign-out helper). Needed: `perf-budgets.json`
   dancer-app `maxFirstLoadGzipKB` 361 -> 363 with a dated note. Re-measure after Slice A merges.
2. **unit-tests / check:dancer-area-isolation**: 26 rule-(a) violations. The brief gives Slice B `src/components/account/**`,
   `src/pages/Account*.tsx`, `/finish-profile`, `src/pages/legal/**`, `legalVersions.ts`, `termsConsent.ts`, but the guard treats
   them as protected / non-seam for a dancer-area PR. Needed: an owner-approved entry in `scripts/dancer-area-isolation-allowlist.json`
   (hard tier; not edited here). Exact file list: run `npm run check:dancer-area-isolation`.

## Pinned interface
`src/lib/focusMode.ts` was ABSENT on main when this slice started, so this branch carries a stub with the exact pinned signature
(`isSignupFocusPath(pathname, search, profileComplete)`, `FOCUS_NOT_NOW_LABEL`). **On merge take Slice A's version.** Slice B only
imports it (`src/modules/dancer-app/shell/focusChrome.ts`, DancerAppShell). Known gap for Slice A's mapping: the photo step reached
from the organiser sign-up link carries an extra `returnTo` param, so `/app/me/photo?return=/app/welcome&returnTo=...` should also
count as focus (the stub checks `return` only, which already handles it; check Slice A's version does too).

## Finding status (detail, tests red->green and decisions in the appendices)
Fixed: H3, H4, H5, H10, H11, M2 (name card enterKeyHint/Enter), M3 (delete field enterKeyHint/Enter), M5, M8, M9, M14, M16, M19,
M20, M21 (labels; breadcrumb parent unowned), M22, M23, M24 (claim removed: prod RPC `set_my_occurrence_attendance_p5_v1` has no
profile rule), M26, M28 (setup + Edit city), M29, L1 (account pages), L2, L3, L4, L7 (account pages), L9, L10, L11, L12, L13 (Slice B
files), L14, L15, L16, L17, L18, L19, L21, L22, L23, L24, L26 (ProfileSwitcher), L27, M4 (Back to Options via `?from=app`).
Partly fixed: **H6** -- the site cannot create a dancer stub (`my_dancer_edit_v1` / `save_my_dancer_profile_v2` raise `no_profile`;
only the sign-up trigger makes one), so routing a profile-less account to /app/welcome would be the same dead end. FinishProfile now
reads "Set up your dancer profile" with Not now + browse. The remaining wording lives in an unowned file (below).
Not fixed, owner action: **M27** -- send a test mail to support@bachatacalendar.co.uk to confirm the inbox exists (not verifiable here).
Not mine (keyboard class / Slice A): H1, H2, H7, H8, H9, H12, M1, M6, M7, M10, M11, M12, M13, M15, M18, M25, L5, L6, L8, L20, L25.

## Unowned (needs a file in neither slice list)
- `src/lib/profileCompletion.ts`: `NO_PROFILE_TEXT` still mentions rating parties; `NO_PROFILE_CONTACT_URL` uses the
  "list my events" prefill (H6). Exact replacements in appendix A3.
- `src/lib/breadcrumbs/siteIa.ts`: delete crumb parent -> `accountSettings`; label `Settings` -> `Account settings` (M21, L13).
- `src/components/ui/city-picker.tsx` + nationality picker: accept `id` / `aria-label` (M17); M28 on sign-up needs `Auth.tsx` (Slice A).
- `src/components/AppChrome.tsx`: focused chrome for `/account/settings*`, `/account/restore`, `/account/deleted` (M4 remainder, Slice A).
- `src/components/MagicLinkConfirmation.tsx` (Slice A): use `src/components/account/EmailText.tsx` for the long-email wrap (L1).

## Process notes
- `/code-review` was not run (no owner in the session to type it); review the branch before merge.
- The isolation guard and bundle budget reds above are the only CI steps red because of this branch.

## Not verified
- No browser walk at 390x844 / 360x640 with prod-shaped data by a human-like pass; checks were jsdom + the Playwright phone and
  build suites (fake Supabase). Real keyboard, real upload, real sign-out against prod auth, and the support mailbox not checked.
- Every city having a slug in prod (What's On uses the dancer's own city).
- Lighthouse, SEO/OG/SSR preview checks and the ~50 live DB contract sweeps (need a preview deploy / prod secrets).
- PR-body checks (Phone QA section, "Verified on real data") -- the orchestrator's PR body must carry them.


---

# Appendix A1 (sub-agent report)

# Agent A1 report (Slice B: avatar, switcher, shell, focus mode)

## Findings

| ID | Status | Test file::test | Red (before fix) | Green |
|---|---|---|---|---|
| H4 | fixed: one `PersonAvatar` (header, sheet, Continue as, Me/Home/Edit); no-photo disc = new token `--da-avatar` #8A5A9C (3.56:1 on #1C0D22, 3.23:1 on --da-surface #2A1433, --da-text on it 4.84:1) | profiles/__tests__/avatarSurfaces.test.tsx::* (3 surfaces x 5 shapes + contrast) | 16 failed | 16 passed |
| H11 | fixed: onError fallback in PersonAvatar (all surfaces) | avatarSurfaces.test.tsx::"broken photo, named/no name" | failed (header/sheet kept the img) | passed |
| M29 | fixed: no name / "Your dancer profile" / "No name yet" -> person glyph (was "Y" / "?") | avatarSurfaces.test.tsx::"no photo, no name yet"; avatarFallback.test.ts | failed ("Y", "?") | passed |
| (pure fn) | `avatarFallback({photoUrl,imgFailed,name})` in profiles/avatarFallback.ts | profiles/__tests__/avatarFallback.test.ts (11 rows) | MUTATION: ignored imgFailed + placeholder -> 4 failed | restored -> 11 passed |
| L10 | fixed: sheet carries data-profile="dancer", background var(--da-surface) (it is portalled outside the shell); organiser keeps site tokens | switcherSignOut.test.tsx::"L10: inside the dancer app..." | 1 failed | passed |
| H10 | fixed: `src/components/account/profiles/signOutToHome.ts` `useSignOutToHome()` (exact pinned signature). Navigates to "/" first, waits until the move COMMITS (the hook's component re-renders on "/" or unmounts with the guarded page; 2 s cap), then signs out. On 'failed': toast.error(SIGN_OUT_FAILED) + navigate back to where they were, returns 'failed' | switcherSignOut.test.tsx::useSignOutToHome (signOut must run while location is "/"; failure row); signOutAuthGuard.test.tsx (real AuthGuard) | MUTATION (old order: signOut then navigate) -> 3 failed ("signOut ran at /app/options") | 5 passed |
| L23 | fixed: switcher Sign out opens an in-sheet "Sign out? / You can sign back in any time with your email." step with Cancel + "Yes, sign out" | switcherSignOut.test.tsx::"switcher sign-out asks first" (2) | 2 failed | passed |
| H5 | fixed: shell reads `isSignupFocusPath`/`FOCUS_NOT_NOW_LABEL`; focus = logo (plain text) + "Not now"; no tabs, Events, type chip or picture. profileComplete = onboarding's own `firstRequiredStage(strength.missing) === null`, read from the shared ['my-dancer-edit'] cache and only on paths that can be focus | shell/__tests__/focusChrome.test.tsx (7-row path table x mapping and rendered shell, Not-now targets) | 7 failed (shell rows) | 23 passed; MUTATION (shell ignores mapping, focus=false) -> 3 failed; restored -> 23 passed |
| L2 | fixed: .da-logo nowrap + ellipsis safety, `clamp(13px, calc(10vw - 21.5px), 16px)` (16 at 375+, 14.5 at 360); Events padding 10->6. No @media (theme test forbids at-rules) | shell/__tests__/shellHeader.test.tsx::L2 | 3 failed (old sheet) | passed |
| L9 (shell) | fixed: logo is no longer a link; "Events" is the one header control to "/" | shellHeader.test.tsx::L9 (4 tabs) | 4 failed (old shell) | passed |
| L26 | fixed: `&hellip;` in ProfileSwitcher; raw-punctuation scan over all my sources | switcherSignOut.test.tsx::L26 (12 files) | 1 failed (ProfileSwitcher) | passed |
| L13 (mine) | fixed: switcher row uses ACCOUNT_SETTINGS_LABEL. Tab "Options" kept (see decisions) | switcherSignOut.test.tsx::"L13..." | n/a (value was already equal; now imported) | passed |
| L14 (mine) | not changed: the only browse string in my files is the header "Events" (a destination noun, kept). Others' verbs ("Browse what's on", "Browse all events") are not mine | - | - | - |
| L18 | fixed: hint "You can switch later by tapping your picture, top right." shown ONLY when every button lands in a shell with the picture (/app/* except setup, /account/o*); else no line | profiles/__tests__/continueAsHint.test.tsx (3 rows) | 3 failed | 3 passed |

## Decisions
- Avatar disc is a NEW token --da-avatar (#8A5A9C), not --da-surface-2: surface-2 measures 1.29:1 on the header, so it fails 3:1. Pinned in tokens.ts TEXT_PAIRS (letter 4.5, disc 3.0 on bg and surface).
- Outside the dancer theme the disc falls back to site muted-foreground with background-colour text (AA in every site theme) -- keeps ONE component for organiser area / Continue as.
- L9: keep "Events", drop the logo link -- a labelled control says where it goes; also makes the logo identical in focus mode (never a link that abandons setup).
- Focus mode hides the "Dancer" chip too -- minimal frame = logo + Not now.
- Profile not read yet on a setup path = focus (never flashes the full app); other paths never wait on the read.
- "Not now" target: carried returnTo (also the one nested in the photo step's ?return=) if safe and NOT dancer-gated (/account/o, /invite, ?claim=1 would bounce straight back into setup); else "/".
- Sign-out failure goes back to the screen they were on + toast: the calling sheet has unmounted by then, an inline line could not be seen; going back lets them retry.
- Tab label "Options" stays: /app/options is a different screen from /account/settings (which is ACCOUNT_SETTINGS_LABEL); "Account settings" also does not fit a 4-tab bar at 360.
- Single-side sheet title "Your account" kept: it names the sheet, not the settings page.
- L18: no hint when a button lands where there is no picture (gate closed -> /account/dancer, or the setup) rather than a line pointing at a missing control.

## Files changed
- NEW src/components/account/profiles/signOutToHome.ts, avatarFallback.ts, PersonAvatar.tsx
- src/components/account/profiles/SideAvatar.tsx, ProfileSwitcher.tsx, ContinueAsPage.tsx
- src/modules/dancer-app/screens/me/ui.tsx (Avatar -> PersonAvatar)
- NEW src/modules/dancer-app/shell/focusChrome.ts; src/modules/dancer-app/shell/DancerAppShell.tsx
- src/modules/dancer-app/theme/tokens.ts, dancer.css
- NEW tests: src/components/account/profiles/__tests__/{avatarFallback.test.ts, avatarSurfaces.test.tsx, switcherSignOut.test.tsx, signOutAuthGuard.test.tsx, continueAsHint.test.tsx}; src/modules/dancer-app/shell/__tests__/{focusChrome.test.tsx, shellHeader.test.tsx}
- Old tests updated (expectations legitimately changed): profiles/__tests__/profiles.test.tsx (sign-out now confirms first); tests/client/dancerAppShell.test.tsx (logo href null; wait for full chrome on /app/welcome) -- tests/client is outside my list, edited only for my own behaviour change.

## Unowned / for the lead
- CHUNK RATCHET: `check:bundle-budget` says dancer-app 60 first-load chunks vs allowance 58. Both extra chunks come from this work: (1) focusMode-*.js (shell imports src/lib/focusMode, shared with FinishProfile -- import mandated by the brief); (2) signOutToHome-*.js (shared by OptionsScreen in dancer-app and the lazy ProfileSwitcher used by the organiser shell too). Needs either perf-budgets.json allowance +2 with this justification, or a vite.config.ts manualChunks pin -- both unowned.
- src/lib/focusMode.ts: the photo hand-off WITH an onward destination is `/app/me/photo?return=%2Fapp%2Fwelcome%3FreturnTo%3D...` (screens/onboarding/steps.tsx photoHandoff); isSignupFocusPath only matches return === '/app/welcome' exactly, so organiser-link sign-ups get full chrome on the photo step. Fix belongs in focusMode (Slice A).
- OptionsScreen (other agent): with the real hook, a failed sign-out navigates back to /app/options, so Options remounts and its inline "still mounted" alert is not seen; the toast carries the error. Their test mocks the hook, so it stays green; fine as is, just know it.
- src/components/account/DancerHome.tsx keeps its own Avatar (a second avatar copy outside the dancer app) -- not mine.
- Pre-existing/other agents' failures seen in the wider run (same with my shell reverted): onboarding.test.tsx / onboardingEnds.test.tsx (5+1), dancerAppMeEdit "paused" (1), dancerAppReviewFixes S8 raw Unicode in noProfileGate.test.tsx and setupFixes.test.tsx.

## Not verified
- No browser walk at 390x844 / 360x640: header fit at 360 is estimated (logo 14.5px), not measured.
- H10 in the real framework-mode router (data router + lazy route): the commit-wait logic is tested in MemoryRouter and with the real AuthGuard, but the original abort race does not reproduce in MemoryRouter (the real-AuthGuard test passes with the old order too); only the "signOut runs after location is /" test went red.
- Sonner toast look inside the plum app.

---

# Appendix A2 (sub-agent report)

# Agent A2 -- Options, Home, Nights

| ID | Result | Test (file::name) | Red | Green |
|---|---|---|---|---|
| H3 | fixed: two links Terms (/terms), Privacy policy (/privacy); TERMS_REASON deleted; no "not published/not live" text left in my files (a "series not live" comment reworded) | options/__tests__/optionsAudit.test.tsx::"H3: two working links..." + "%s carries no not published / not live text" | part of 15 failed / 29 | 29 passed |
| H10 (Options half) | fixed: OptionsScreen uses useSignOutToHome (A1's file, imported only); confirm sheet kept; 'failed' shows the shared SIGN_OUT_FAILED line + Retry if still mounted (the hook also toasts and returns to Options) | optionsAudit.test.tsx::"H10: confirm calls signOutToHome once" / "'failed' (still mounted)..." | failed (spy 0 calls; no alert) | passed |
| M16 (Options + Home) | fixed: share reason = HIDDEN_SHARE_REASON built from HIDDEN_STATE_LINE + SHOW_AGAIN_LABEL + ACCOUNT_SETTINGS_LABEL (account link is on screen); Home banner = HIDDEN_STATE_LINE + SHOW_AGAIN_LABEL link; PAUSED_REASON deleted | optionsAudit.test.tsx::"M16 ... $name" (Options x Home table) + source pin per owned file | failed | passed |
| L9 (Options part) | fixed: "Browse all events" removed (one link to /); organiser row now below Help | optionsAudit.test.tsx::"L9 / L12 ..." table + "one link to the site home" | failed | passed |
| L12 | fixed: I teach / I DJ rows not rendered; SOON_REASON deleted | same table | failed | passed |
| L13 (my strings) | fixed: account link renders ACCOUNT_SETTINGS_LABEL | optionsAudit.test.tsx::"reads ACCOUNT_SETTINGS_LABEL from sharedCopy" | failed (source pin) | passed |
| L15 | fixed: shareOrCopy(): navigator.share, AbortError = cancelled (nothing), other error or no share = copy, then manual field | optionsAudit.test.tsx::"L15 ..." (4 cases) | 2 failed | passed |
| M14 | fixed: hero background = gradientBg (--da-gradient-from #6E2380 / --da-gradient-to #C23B55, white >= 5.18:1); was --da-accent #FF7A66 = 2.55:1. No token change | home/__tests__/homeAudit.test.tsx::"M14 ... %s" (computes contrast from the style's colours via DANCER_TOKENS) | failed (2.55) | passed |
| M19 | fixed: both Coming soon tiles removed | homeAudit.test.tsx::"no Coming soon tile on Home" | failed | passed |
| M20 | fixed: new useDancerCitySlug(cityId) (cities.id -> slug, as lib/city-canonical.ts) in nights/useBrowseHref.ts; What's On uses it; no city -> "Add your city to see what's on near you. Add my city" -> /app/me/edit?focus=city; unresolved slug = error, never "Nothing listed" | homeAudit.test.tsx::"M20 ..." (3) | 3 failed | passed |
| L4 | fixed: nudgeTitle(): "Rate last night" only if 1 day ago, else "Rate Sat 10 Oct" | homeAudit.test.tsx::"L4 ... %i days ago" | 3 failed | passed |
| L3 | fixed: PAST_STATUS_LABELS Went / Was interested via statusLabel (one mapping, Home+Nights) | nights/__tests__/nightsAudit.test.tsx::"L3 ..." | 3 failed | passed |
| L22 | fixed: zero nights = one card "No nights saved yet." + "Tap I'm Going or Interested on any event..." + Browse events; only-past = "No upcoming nights." + Browse events | nightsAudit.test.tsx::"L22 ..." | 2 failed | passed |
| L14 (my strings) | fixed: BROWSE_EVENTS_LABEL "Browse events" (home/homeCopy.ts) everywhere in my files; noun "nights" (tile now "Upcoming nights") | homeAudit + nightsAudit "L14 ..." | failed | passed |
| L23 (Options half) | already consistent: Options keeps its confirm sheet; the switcher is A1's | -- | -- | -- |

Red totals: home 11 failed / 13; nights 6 failed / 10; options 15 failed / 29. Green: 143 passed (my 3 dirs + tests/client/dancerAppHomeNights.test.tsx).

## Decisions
- "Browse events" is the one browse verb -- it matches the site header's "Events", the place the link lands.
- "nights" is the one noun for saved RSVPs -- it is the tab name; Home tile renamed "Upcoming nights".
- Browse events (Home hero, What's On, Nights) all go to the dancer's own city calendar, falling back to the site's active city, then /parties -- one destination for one label on the same screen.
- What's On with a city id but no resolvable slug shows the load-error line -- a "nothing on" claim would be false.
- Kept "Back to the Bachata Calendar website", dropped "Browse all events" -- leaving the app is what people look for in Options; browsing lives on Home and Nights.
- Organiser row placed after Help, before Terms/Privacy/Sign out -- dancer tasks first, legal and exit last.
- Hero uses the existing gradient token pair rather than a new colour -- that pair is already pinned at AA by tests/client/dancerAppTheme.test.ts.
- Nudge subtitle dropped the date (the title carries it now) -- no repeated date.
- A cancelled native share shows nothing -- the person chose to close it.
- Kept data-testid "paused-banner" -- test id only, renaming would break other tests for no user gain.

## Files changed
- src/modules/dancer-app/screens/options/optionsModel.ts, OptionsScreen.tsx, __tests__/OptionsScreen.test.tsx (updated expectations: terms links, no teacher row, hidden reason, no browse-events link, sign-out failure now returns to Options), __tests__/optionsAudit.test.tsx (new)
- src/modules/dancer-app/screens/home/HomeScreen.tsx, RateNudge.tsx, WhatsOn.tsx, homeCopy.ts, __tests__/homeAudit.test.tsx (new)
- src/modules/dancer-app/screens/nights/NightsScreen.tsx, nightsModel.ts, useBrowseHref.ts, __tests__/nightsAudit.test.tsx (new)
- tests/client/dancerAppHomeNights.test.tsx -- outside my dirs, edited ONLY because my fixes changed its expectations (getSupabase mock gains cities.from; Browse events label; no Coming soon tiles; hidden line; Add my city link; nights-empty). Lead: please confirm.

## Not verified
- No browser walk at 390x844; no prod read of cities.slug nulls (assumed every city has a slug).
- Typecheck: no errors in src/modules/dancer-app or the test above; the repo has ~97 pre-existing errors elsewhere (app/routes, venues) unrelated to this work.
- Failing tests NOT mine: onboarding.test.tsx, onboardingEnds.test.tsx, dancerAppMeEdit "Open account settings", dancerAppReviewFixes S8 (noProfileGate.test.tsx, setupFixes.test.tsx raw Unicode).
- On a real sign-out failure the Options sheet has unmounted (hook navigates away first), so the person sees A1's toast, not the inline line.

---

# Appendix A3 (sub-agent report)

# Agent A3 report (Slice B: setup, photo, Me, Edit, api, gate, FinishProfile)

## Findings

| ID | Status | Test file::test | Red | Green |
|---|---|---|---|---|
| H6 | Partly fixed. The flow and the page are fixed in my files. The shared wording and prefill are **unowned**: `src/lib/profileCompletion.ts` (see below) | `src/pages/__tests__/FinishProfileNoProfile.test.tsx` (all 8 tests); `src/modules/dancer-app/gate/__tests__/noProfileGate.test.tsx` (both gate states) | First version: 6 failed / 6 passed (heading, Not now, gate line, prefill). The noProfileGate tests passed at red: they are a guard on the existing redirect | 8/8 and 4/4 pass |
| M5 | fixed: line and wrong comment deleted; notes only render for a linked profile | `onboarding/__tests__/setupFixes.test.tsx`::M5 empty stub / half-finished | 2 failed | pass |
| L16 | fixed: static dancer prefill, href is there on first render (no lazy import) | setupFixes::L16 linked profile | 1 failed | pass |
| M8 | fixed: tag "NN% &middot; Your profile is live" (server pct; left out when the profile is hidden), button "Two quick questions" / "One quick question", body "People can find your page now." or HIDDEN_STATE_LINE | setupFixes::M8 + M24 (3 cases) | 3 failed | pass |
| M23 | fixed: Try again (refetch) plus "Back to the calendar" (`/`). For no_profile / profile_mismatch, Try again is replaced by "Message us on WhatsApp" with a dancer prefill, because retrying cannot help | setupFixes::M23 (2 cases) | 2 failed | pass |
| M24 | fixed: the claim is removed from Me and from the "You're in" card | setupFixes::M24 Me (2 seeds) and the M8 case | 2 failed (Me), M8 failed | pass |
| M9 | fixed: ONE "Add my photo" link to the photo screen | setupFixes::M9 | 1 failed | pass |
| L11 | fixed: pick and crop show "Back to setup" (when return is /app/welcome) or "Back", linking to the `return=` target. No extra link without `return=` | `photo/__tests__/photoExits.test.tsx`::L11 (3 paths and the no-return case) | 3 failed | pass |
| M22 | fixed in `photo/uploadFailure.ts`: network errors keep the shared sentence; uploadToR2's own curated refusals (401/403/413/422, too large) keep theirs; anything else becomes "We could not upload your photo. Please try again." and the raw text goes to console.warn | photoExits::M22 (3 cases) | 1 failed (the curated case was added after green, as a guard) | pass |
| M2 | fixed (name card): `enterKeyHint="next"` on both fields; Enter submits when the first name is filled; an empty name sends nothing. The other required cards have no text field | setupFixes::M2 (2 cases) | 1 failed | pass |
| M17 | **unowned**: `CityPicker` and `NationalityPicker` take no `id` or `aria-label` prop, so nothing correct can be passed from my files | none | n/a | n/a |
| M28 | fixed for setup and Edit: "City not in the list? Message us to add your city" (dancer prefill). The sign-up side (Auth.tsx) is unowned | setupFixes::M28; `edit/__tests__/editCity.test.tsx` (2 shapes) | 1 failed; 2 failed | pass |
| L17 | fixed: "Pick Leader, Follower or Both." (the test builds the sentence from ROLE_CHOICES labels; the chips say Leader/Follower/Both, not Lead/Follow) | setupFixes::L17 | 1 failed | pass |
| L13/L14 | Me paused card now uses HIDDEN_STATE_WORD, HIDDEN_STATE_LINE and ACCOUNT_SETTINGS_LABEL. The link label stays "Open account settings" (tests/client/dancerAppMeEdit.test.tsx pins it). FinishProfile's settings link uses ACCOUNT_SETTINGS_LABEL. There are no browse or saved-nights strings in my files | covered by FinishProfileNoProfile::settings and the client Me test | n/a | pass |

## Evidence (prod, read-only SELECTs, counts only)
- M24: `set_my_occurrence_attendance_p5_v1` checks only auth.uid, the anonymous flag, the arguments, series lifecycle 'live', occurrence not cancelled and not ended. **It has no profile or completeness check**, so the claim was removed rather than made true.
- H6: `my_dancer_edit_v1` and `save_my_dancer_profile_v2` both RAISE `no_profile` when `_my_dancer_profile_id_v1()` is NULL. The stub (`dancer_profiles.id = auth id`, profile_source 'auto_stub') is created ONLY by `trg_handle_new_dancer_profile` on the auth.users insert. `claim_my_dancer_profile_v1` only links admin-made profiles by email. **Nothing reachable from the site can create a profile for a no-persona account.**
- Counts: 23 auth users, 2 with no resolvable persona, 0 of those created in the last 60 days (legacy accounts from before the trigger existed), 0 archived own rows. The `dancer_area_open` flag is ON, so every signed-in user is allowed. The audit's "18 of 23 have no profile" are stubs, which already count as "incomplete" and are sent into /app/welcome.

## Decisions
- H6: no_profile is NOT redirected to /app/welcome in either gate state. Reason: welcome would hit `no_profile` from my_dancer_edit_v1, the same dead end in another skin. The real next step is a message.
- H6: the no-profile body keeps the ONE shared fact (`completenessFact().text`) and `NO_PROFILE_CONTACT_URL`. Reason: `DancerFirstGate.matrix.test.tsx` enforces one fact and one contact on the dancer home, the Finish screen and the rating card. A local rewording broke 30 cells. So the wording fix belongs in profileCompletion.ts (unowned, below).
- H6, in my file: heading "Set up your dancer profile" (not "Finish"), a separate line "You can still browse events in the meantime." (plain visits only), and "Not now" (FOCUS_NOT_NOW_LABEL) instead of a grey "Continue". The gated visit keeps DANCER_GATE_REASON and "Back to the calendar".
- M9: one button, not file inputs on the card. Reason: decode, crop and offline handling live on the photo screen, and that screen already offers camera (capture="user") and library.
- L11: label "Back to setup" when the return is setup, else "Back". Not "Not now", because the photo step cannot be skipped. The link replaces history.
- M23: retry with no busy text ("Saving..." would be wrong for a read). The way back is the calendar, because Home reads the same failing profile.
- New `api/messageUs.ts` (dancerMessageUsUrl + four dancer messages). Reason: importing optionsModel would drag lucide/searchEntities into the setup chunk. lib/contactLinks already rides every route's chunk (GlobalHeader, BottomNav), so the static import is free and the href is there on first render.
- M8: "You're in" never says "100%", and no per-question gain is claimed. Only the server pct is shown.

## Unowned (exact changes needed)
1. `src/lib/profileCompletion.ts` (H6):
   - `NO_PROFILE_TEXT = "Your account does not have a dancer profile yet. Message us and we’ll set one up for you.";` (no rating words; NO_PROFILE_REASON for the rating card can stay.)
   - `NO_PROFILE_CONTACT_URL`: use a dancer prefill, not the "list my events" one: `export const NO_PROFILE_CONTACT_URL = (() => { const b = new URL(WHATSAPP_GET_LISTED_URL); return \`${b.origin}${b.pathname}?text=${encodeURIComponent("Hi! My Bachata Calendar account has no dancer profile yet. Please can you set one up?")}\`; })();` This is the same text as `NO_PROFILE_MESSAGE` in api/messageUs.ts. The matrix and FinishProfile tests compare against the constants, so they stay green.
2. `src/components/ui/city-picker.tsx` and `src/components/ui/nationality-picker.tsx` (M17): add `id?: string` and `'aria-label'?: string` to the props and forward them to the trigger `<Button role="combobox">`. Then pass `aria-label="Your city"` in onboarding/steps.tsx CityCard and FinishProfile, and `id="based_city_id"` / `id="nationality"` in EditScreen (and drop the wrapper div ids). I can do the call sites once the props exist.
3. `src/modules/dancer-app/screens/options/optionsModel.ts`: `messageUsUrl` should re-export `dancerMessageUsUrl` from `../../api/messageUs`, so there is one builder. HELP_MESSAGE is the same text as PROFILE_HELP_MESSAGE.
4. e2e specs pinned to the old UI:
   - `tests/e2e/dancer-app/onboarding.spec.ts:58`: replace the consent assertion with `await expect(page.getByTestId('onboarding-consent')).toHaveCount(0)`.
   - `tests/e2e/dancer-app/onboarding.spec.ts:80` and `tests/e2e-build/helpers/journeyHarness.ts:353`: use `getByTestId('onboarding-add-photo')`.
5. M28 on sign-up (`src/pages/Auth.tsx`, city required): same "Message us to add your city" link.

## Files changed
- src/modules/dancer-app/api/errors.ts (L17)
- src/modules/dancer-app/api/messageUs.ts (new)
- src/modules/dancer-app/screens/onboarding/notes.tsx, OnboardingScreen.tsx, steps.tsx, ui.tsx (linkButton)
- src/modules/dancer-app/screens/photo/PhotoScreen.tsx, uploadFailure.ts (new)
- src/modules/dancer-app/screens/me/MeScreen.tsx
- src/modules/dancer-app/screens/edit/EditScreen.tsx
- src/pages/FinishProfile.tsx
- Tests: onboarding/__tests__/setupFixes.test.tsx (new), photo/__tests__/photoExits.test.tsx (new), edit/__tests__/editCity.test.tsx (new), gate/__tests__/noProfileGate.test.tsx (new), src/pages/__tests__/FinishProfileNoProfile.test.tsx (new)
- Old tests whose expectations my fixes changed: onboarding/__tests__/onboarding.test.tsx (one photo button, new in-card copy, no consent line), onboarding/__tests__/onboardingEnds.test.tsx ("Two quick questions"), photo/__tests__/PhotoScreen.test.tsx (the unknown upload message is now mapped). FinishProfile.test.tsx was edited and then restored, so it is unchanged in net.

## Runs
- `npx vitest run` over the 7 requested dirs: 36 files, 600 tests passed. In one full-dir run, the matrix test "stub x no organiser, returnTo round-trips" failed once under load; it passes 114/114 alone (a timing flake, not my change).
- tests/client/dancerApp*: 640 passed, after I escaped raw Unicode in two of my test files (the S8 guard).
- `tsc -p tsconfig.app.json --noEmit`: 0 errors in any owned or new file. 96 errors elsewhere already exist in this checkout (app/routes, calendarUtils `.at`, resizable, DancerDashboard and others), and none are in files I touched.
- eslint on the changed files: 1 error at EditScreen.tsx:95 ("Cannot access refs during render"), already there and not in my hunk. The rest are fast-refresh warnings.

## Not verified
- No browser walk at 390x844, and no real-device keyboard check of enterKeyHint/Enter.
- No build, so check:bundle-budget and check:first-load-requests were not run. The claim that the static import of contactLinks costs no request rests on GlobalHeader and BottomNav already importing it.
- The H6 page wording still contains the rating line until unowned item 1 lands.
- My new test files were written with LF line endings (the repo's source files use CRLF). Normalise them if check:integrity complains.

---

# Appendix A4 (sub-agent report)

# Agent A4 (agent D: account + legal pages, sharedCopy values)

Test files: `src/pages/__tests__/AccountSliceB.test.tsx` (T), `src/lib/__tests__/termsConsent.version.test.ts` (V).
Red run, before any fix: T = 33 failed / 11 passed (44); V = 4 failed (4). Green: T 48/48, V 4/4.

| ID | Status | Test (file::name) | Red | Green |
|---|---|---|---|---|
| M4 | fixed (page part). `?from=app` on /account/settings and /delete shows a "Back to Options" link to /app/options, and every link inside settings keeps the param. **unowned:** `src/modules/dancer-app/screens/options/OptionsScreen.tsx:160` (and optionsModel if it builds the href) must link to `withFromApp(ACCOUNT_SETTINGS_PATH, true)` from `@/lib/accountSettings` (= `/account/settings?from=app`). Until then the link never shows. The focused chrome is `src/components/AppChrome.tsx` (unowned). | T::M4 x3 (settings, delete, carries through) + 2 negatives | 3 failed | pass |
| L7 | fixed: `showGradientBg={false}` on settings (all views), deleted, restore | T::L7 x4 | 4 failed | pass |
| M16 | fixed: settings hidden state = `HIDDEN_STATE_LINE` + toggle = `SHOW_AGAIN_LABEL`; Privacy "hide ... or pause" changed to one state ("While it is {HIDDEN_STATE_WORD}, only you can see it"); DancerHome banner reads `HIDDEN_STATE_LINE` / `SHOW_AGAIN_LABEL` | T::M16 x3 | 3 failed | pass |
| M21 | fixed (page part): home section + button are "Delete account" and go straight to /account/settings/delete; the ownership step is removed and its old URL renders the delete view (title "Delete account", delete crumbs). **unowned:** `src/lib/breadcrumbs/siteIa.ts:67-68`: set `'accountSettings.delete'` `parent: 'accountSettings'` and delete (or leave unused) `'accountSettings.ownership'`, so the trail is Home > Your account > Account settings > Delete account with no "Account owner..." crumb to cut. | T::M21 x3 | 3 failed | pass |
| M26 | fixed: the expired card (and window-closed-during-restore) adds "Back to the calendar" (/) and "Sign out" (signOut, then /); a failed sign-out says so and stays | T::M26 x3 | 3 failed | pass |
| L21 | fixed: deleted page has a primary "Sign in to undo" link, `/auth?mode=signin&returnTo=%2Faccount%2Frestore`; restore now excludes itself from returnTo, so Continue never loops back to /account/restore | T::L21 x2 | 2 failed | pass |
| L19 | fixed: `autoCapitalize="characters"`; `canConfirmErase` trims, still case-sensitive | T::L19+M3 table (7 rows) + field test | 3 failed | pass |
| M3 | fixed (page part): `enterKeyHint="done"`; field sits in a `<form>`, so Enter/Done submits, and `erase()` refuses unless the word is right. Keyboard helper / focused chrome not touched (unowned, per task). | T::"capitalises on phones, says done, and submits on Enter" | failed | pass |
| L1 | fixed on my pages: new `src/components/account/EmailText.tsx` (`<wbr>` before "@", `[overflow-wrap:anywhere]`), used for the sign-out line, email line, pending-change copy, delete/deleted/restore contact address; no `break-all` left. **unowned:** `src/components/auth/MagicLinkConfirmation.tsx:177` (code step): use the same `EmailText` | T::L1 x4 screens, 49-char email seed | 4 failed | pass |
| L24 | fixed: one formatter `formatLongDate` in `src/lib/accountDeletionCopy.ts` (`formatDeletedOn` now uses it); LegalShell shows "Last updated 16 October 2026" | T::L24 x6 | 6 failed | pass |
| L27 | fixed: `termsConsent.ts` re-exports `TERMS_VERSION` from `legalVersions.ts`; the test mocks legalVersions to 2099-01-01 and shows acceptTerms records it and an old acceptance no longer counts | V x4 | 4 failed | pass |
| L13 | fixed: settings h1 = `ACCOUNT_SETTINGS_LABEL`; Privacy link text and DancerHome link/banner read it. **unowned:** `src/lib/breadcrumbs/siteIa.ts:66` label `'Settings'` should be `'Account settings'` (import ACCOUNT_SETTINGS_LABEL or match it) | T::L13 x4 | 2 failed | pass |
| M27 | owner action, not changed: send a test mail to `support@bachatacalendar.co.uk` (`src/lib/accountDeletionCopy.ts:10`, used by /privacy, /terms, delete, deleted, restore) and confirm it arrives before relying on it (GAPS.md G-D2 "No apex MX"). | none (cannot verify a mailbox) | n/a | n/a |
| Terms/privacy live | nothing to remove: grep finds no "not published / not live" text or disabled row in my files. A guard test stays so none comes back. | T::"none of the account or legal sources say not published / not live" | already green (no-op) | pass |

Old tests changed because the fix legitimately changed what they expect:
- `src/lib/__tests__/accountSettings.test.ts`: "DELETE " / " DELETE" are now accepted (L19).
- `src/pages/__tests__/AccountSettings.test.tsx`: `settings-ownership-link` / `ownership-delete-link` are now `settings-delete-link` pointing at /delete (M21); "DELETE " removed from the still-disabled list (L19); the no-permanence check is scoped to the delete section, because the visibility card truly says hiding is "not permanent".
- `src/pages/__tests__/LegalPages.test.tsx`: "Last updated" expects `formatLongDate(VERSION)` (L24).

## Decisions
- M4 uses `?from=app`, not document.referrer: the referrer stays empty after an in-app navigation, and a param can be tested and carried across views.
- "Back to Options" label: it names the tab the person came from (L13 renames the page, not the tab).
- M21: I removed the ownership step instead of renaming it. It added a tap and repeated the delete copy. Its URL still works (old links) and opens the delete view.
- The final red button stays "Delete my account": it is the first-person confirm on a page already titled "Delete account".
- Home delete line now says "Sign in within 30 days to undo it", the same promise as the delete, deleted and Privacy pages.
- L19: trim but stay case-sensitive. The field capitalises on phones, typing the capitals is the deliberate act, and the reason line already says "in capital letters".
- L21: the returnTo is /account/restore, as asked. The sign-in landing (accountRouting.signInLanding) already sends a deleted login to restore and would make Continue point back at restore, so restore now excludes itself (`sanitizeReturnTo(..., { exclude })`).
- L21: "Sign in to undo" is the primary button and "Back to the calendar" the outline one. Undo is the reason the page exists.
- L7: I left /privacy and /terms alone. They are reading pages and outside the audit's L7 scope (/auth, /account/*, /finish-profile).
- sharedCopy VALUE change: `HIDDEN_STATE_LINE` "dancer page" became "dancer profile", to match `SHOW_AGAIN_LABEL` ("Show my profile again") and the settings/Privacy wording. Every user imports the constant, so no test pins the old text.
- L24 formatter: a plain YYYY-MM-DD is formatted in UTC (the date as written); a timestamp is formatted in London time. A non-date version is shown raw rather than hidden.
- M26 sign-out uses plain `signOut()` (this device), the same as the settings Sign out button.

## Files changed
- src/pages/AccountSettings.tsx
- src/pages/AccountDeleted.tsx
- src/pages/AccountRestore.tsx
- src/pages/Privacy.tsx
- src/pages/legal/LegalShell.tsx
- src/components/account/DancerHome.tsx
- src/components/account/EmailText.tsx (new)
- src/lib/accountSettings.ts (trimmed compare; FROM_PARAM/FROM_APP/APP_OPTIONS_PATH/BACK_TO_OPTIONS_LABEL/isFromApp/withFromApp)
- src/lib/accountDeletionCopy.ts (formatLongDate)
- src/lib/termsConsent.ts
- src/modules/dancer-app/copy/sharedCopy.ts (HIDDEN_STATE_LINE value only)
- tests: src/pages/__tests__/AccountSliceB.test.tsx (new), src/lib/__tests__/termsConsent.version.test.ts (new), src/pages/__tests__/AccountSettings.test.tsx, src/pages/__tests__/LegalPages.test.tsx, src/lib/__tests__/accountSettings.test.ts

Not touched: Terms.tsx, Account.tsx, legalVersions.ts (nothing needed).

## Runs
- `npx vitest run src/pages src/lib/termsConsent src/lib/legalVersions src/components/account src/lib/__tests__`: 1394 passed, 1 failed, 2 skipped. The failure is `src/pages/__tests__/DancerFirstGate.matrix.test.tsx`, which comes and goes between runs (1 to 30 failures) while another agent edits FinishProfile.tsx / accountRouting copy (missing GATE_REASON text on /finish-profile). It is not in my files. Earlier runs also showed `profiles/__tests__/switcherSignOut.test.tsx` red; that is profiles/** (another agent), and it passes now.
- `npm run typecheck`: none of the 97 errors in the tree is in a file I touched (the errors are in VendorPortal, VenueEntity, Venues, venuePublicService and others).
- eslint on every file I touched: clean.

## Not verified
- No browser walk at 390x844, so the breadcrumb cut (needs the siteIa change), the Back-to-Options placement and the email wrapping were not seen on screen. jsdom checks the markup only (wbr + overflow-wrap class).
- Options does not pass `?from=app` yet (unowned), so M4 does nothing in the live flow until it does.
- Mailbox for support@bachatacalendar.co.uk (M27, owner action).

---

# Appendix INT (sub-agent report)

# Agent INT: Slice B integration report

Branch `claude/djf-dancer-app` at b5cec12, plus uncommitted edits. Nothing is committed. The `origin/main` worktree (ecc3432) has been removed.

## PART 1: Leftovers

| # | Item | Outcome | Test | Red | Green |
|---|---|---|---|---|---|
| a1 | `tests/e2e/dancer-app/onboarding.spec.ts:58` expected the removed `onboarding-consent` line | Now asserts the line is absent (`toHaveCount(0)`), with an audit M5 comment | onboarding.spec.ts "empty stub" | n/a (stale spec) | passed in `test:e2e` |
| a2 | onboarding.spec.ts:80 used `onboarding-take-photo` | Now uses `onboarding-add-photo`, the single button in steps.tsx | same spec "name + city only" | n/a | passed |
| a3 | `tests/e2e-build/helpers/journeyHarness.ts:353` used `onboarding-choose-photo` | Now uses `onboarding-add-photo` | build-smoke public-journeys | n/a | 62/62 build-smoke passed |
| a4 | More stale e2e assertions, found by a grep and then by running the suites | `tests/e2e/dancer-app/options.spec.ts`: expected Terms to be **disabled**. It is a live link now (H3), so the spec asserts the `/terms` and `/privacy` hrefs. `tests/e2e/dancer-app/home-nights.spec.ts`: expected a `tile-views` tile with "Coming soon". Those tiles were removed (L12), so the spec asserts there is no tile and no "Coming soon" text. Nights with zero rows shows `nights-empty`, so the spec expects that, not `nights-upcoming`. `tests/e2e-build/account-edges.build.spec.ts`: the switch sheet now has a confirm step, so `signOutFromSheet` clicks `profile-switcher-signout-confirm`. The admin-only heading is now "Set up your dancer profile". M77 used to rely on the old H10 bug (sign-out landing on /auth); B now signs in from the header link and reads its sides from the organiser-area switch sheet, still without a reload, and the spec now waits for `/account/o` | e2e and build-smoke | n/a | `test:e2e` 148 passed / 1 skipped. Build-smoke 62/62. account-edges run with `--repeat-each 3`: 24/24 |
| a5 | `tests/regression/today/*` snapshot suites (they pin today's UI) | 46 snapshot mismatches and 1 assertion, all from this branch's intended changes: Account settings label, delete view at the old ownership address (M21), "Set up your dancer profile", EmailText `<wbr>` splitting text nodes in the a11y tree, trimmed `' DELETE '` (L19). Test edits: the ownership case waits on `delete-confirm`, and `'DELETE '` is no longer in the disabled list (AccountSliceB pins that it arms the button). Snapshots updated with `-u`: 58 updated, which includes 12 obsolete ones | account / accountSettings / finishProfile `.today` | 46 snap + 1 assertion failed (these 3 files all pass on main) | 114/114 |
| b | One message-us builder | `optionsModel.ts` now re-exports `messageUsUrl = dancerMessageUsUrl` from `api/messageUs`, and `HELP_MESSAGE = PROFILE_HELP_MESSAGE`. The WhatsApp parse and its import are gone from optionsModel | `options/__tests__/oneMessageUsBuilder.test.ts` (3) | 1 failed (run against HEAD's optionsModel) | 3 passed |
| c1 | Whole-suite `npm run test:unit` | No failure left that this branch causes. The remaining failures are all environmental, and the same files fail on origin/main in the worktree: `eventViewCompat` / `latestEvents` / `occurrenceProgram` / `publicEventPageLineup` `.contract` (the local `VITE_SUPABASE_URL` is project srrpvux..., not prod: no rows, timeouts) and `integrityCouldNotRun` (TS-helper precondition under /tmp; one more case under CI=true) | - | branch 69 failed, main 15 failed for the same 5 env files | after fixes: only the 5 env files fail (18 tests) |
| c2 | S8 raw-Unicode check on noProfileGate / setupFixes tests | Already clean. `tests/client/dancerAppReviewFixes.test.ts` 111/111. A python scan finds no banned chars | - | - | 111 passed |
| c3 | `DancerFirstGate.matrix` flake | Ran 3 times alone: 114/114 each time. It also passed in both full runs. Not reproduced | - | - | 3/3 green |
| d | Bundle chunk ratchet | Fixed inside src. Details below | `options/__tests__/signOutOnDemand.test.tsx` (4) | 3 failed | 4 passed |

## Bundle outcome

All measurements use the perf-budget.yml env (`npm run build` with the placeholder `VITE_SUPABASE_*`, then `check:bundle-budget`).

- **Before:** dancer-app **60 chunks** (allowance 58, both edges pinned), **362.7 KB** (budget 361). origin/main: 58 chunks, 360.4 KB.
- **The real cause, from diffing the manifests:** `focusMode` is NOT a new request. It took over main's existing `upload-validation` chunk, which has the same importer set {dancer-app, FinishProfile}. Rollup names a chunk after its first module. The two genuinely new chunks were `sharedCopy` (157 B) and `signOutToHome`.
- **Fix 1, sharedCopy:** the 4 values now live in `src/lib/accountRouting.ts`. That file is a seam, already in the dancer-app first load, and already holds `ACCOUNT_SETTINGS_PATH`. `copy/sharedCopy.ts` now only re-exports them, so its exports and values are unchanged and dancer-app screens are untouched. The site pages (DancerHome, AccountSettings, FinishProfile, Privacy) import from `@/lib/accountRouting`. This also clears the 4 isolation-rule-(c) violations ("imports the dancer-app module and is not a seam").
- **Fix 2, signOutToHome:** the Options sign-out confirm is now `screens/options/SignOutConfirm.tsx`, loaded through `lazyWithRetry` when the sheet opens. The H10 hook lives there, and the sheet's Close is disabled while signing out, so the hook is never unmounted part-way. `SIGN_OUT_FAILED_COPY` moved with it; the OptionsScreen.test import was updated.
  - **Trade-off:** sign-out from Options costs 2 small on-demand requests. There are no first-load requests left for it.
  - **Rejected alternative:** putting the hook inside a module of the useMyDancerEdit chunk (PersonAvatar/avatarFallback) would add 0 requests, but would hide a sign-out hook in an avatar file.
- **After:** dancer-app **58 chunks = allowance [ok]**, **362.1 KB**. Every other route is unchanged (home 206.3, event 376.8, auth 292.3 ...). All chunk and puller ratchets are ok. `check:first-load-requests`: all 6 pins match. `check:chunk-cycles` is ok.
- **STILL RED: dancer-app bytes 362.1 > 361 KB.** The extra +1.7 KB over main is real Slice B feature code: dancer-app chunk +1.0 KB, PersonAvatar/avatarFallback in the useMyDancerEdit chunk +0.56, focusMode +0.12. No src-only change removes it without removing features. **Config needed (lead, `perf-budgets.json`):** `maxFirstLoadGzipKB` for "dancer-app (/app/*, lazy chunk via catchall)" from 361 to 363. Add a dated `//` note giving these numbers, following the file's convention.

## PART 2: CI jobs a pull_request to main runs

The live-DB gate run with `--event pull_request --base origin/main` says **RUN** (the diff touches DB-calling files). So CI runs the full `npm run test:unit` with secrets, and runs the db-contract-check `contract-check` job.

| workflow | job | command | exit | note |
|---|---|---|---|---|
| architecture-guard | guard | bin/check-integrity.sh | 0 | 1744 files, 0 issues (run via bash; CI chmods first) |
| architecture-guard | guard | check:legacy-tables / check:legacy-program-rpcs / lint:architecture | 0/0/0 | |
| architecture-guard | guard | AUDIT_STRICT=1 check:images | 0 | |
| architecture-guard | guard | check:image-widths:self-test, check:image-widths | 0/0 | |
| architecture-guard | guard | check:plan-hygiene:self-test | 0 | |
| architecture-guard | guard | check:workflow-artifact-policy:self-test, then the guard | 0/0 | |
| architecture-guard | guard | check:mojibake:self-test, mojibake git grep | 0/0 | |
| architecture-guard | guard | prove:entry-point:self-test, prove:entry-point | 0/0 | |
| typecheck | wallclock-brand | check:rpc-typing / check:wallclock-brand | 0/0 | |
| (no workflow) | - | npm run typecheck | 2 | **branch 96 errors, origin/main 96, identical sets after stripping line/col: 0 new** |
| unit-tests | unit (London) | node scripts/ci-live-db-gate.mjs | 0 | the PR diff says RUN |
| unit-tests | unit (London) | npm run test:unit | 1 | ENV only: 5 files / 18 tests (4 live `.contract` against a non-prod local project + integrityCouldNotRun). They fail on main too. 354/359 files pass |
| unit-tests | unit (London) | npm run test:unit:timing | 0 | |
| unit-tests | unit (New_York / Sydney) | vitest tz set | 0/0 | |
| unit-tests | dancer-area-isolation | --self-test | 0 | |
| unit-tests | dancer-area-isolation | npm run check:dancer-area-isolation | **1** | **26 rule-(a) violations remain** (was 30; I fixed the 4 rule-(c) ones). These are Slice B files outside src/modules/dancer-app that are not seams, or that are PROTECTED (DancerHome, FinishProfile, AccountSettings, lib/accountSettings, termsConsent, focusMode, EmailText, profiles/PersonAvatar + avatarFallback + signOutToHome, AccountDeleted/Restore, Privacy, LegalShell, accountDeletionCopy, plus their tests). **Unowned:** `scripts/dancer-area-isolation-allowlist.json` (orchestrator decision; scripts/ is off-limits to me). Either add these as seams or move them under the module. Full list: `/tmp/claude-0/-home-user-bachata-website/35c92d0a-ab63-523e-bc56-637b1d3153dc/scratchpad/ci/logs/unitrest-32.log` |
| e2e-smoke | e2e-smoke | npm run test:e2e (CI env) | 0 | after the spec fixes: 148 passed, 1 skipped. First run: 5 failed (stale specs) + 2 flaky (auth-magic-link-returnto:88, dancer-home:150 and :188 at different times; all passed on rerun, dev-server first-compile timing) |
| perf-budget | bundle-budget | 3 self-tests | 0/0/0 | |
| perf-budget | bundle-budget | npm run build (perf env) | 0 | |
| perf-budget | bundle-budget | check:bundle-budget | **1** | chunks fixed (58/58). **Bytes 362.1 > 361**: needs perf-budgets.json, see above |
| perf-budget | bundle-budget | check:first-load-requests / check:chunk-cycles | 0/0 | |
| perf-budget | lighthouse, doc-weight | check:lighthouse / check:doc-weight | - | not runnable locally: needs the Vercel preview deployment + VERCEL_AUTOMATION_BYPASS_SECRET |
| phone-qa | phone-qa | playwright phone config | 0 | 188 passed, 74 skipped |
| phone-qa | build-smoke | npm run build (fake env + preload) | 0 | |
| phone-qa | build-smoke | playwright build config | 0 | after the spec fixes: 62/62. First run: 4 failed (stale account-edges) |
| phone-qa-section | phone-qa-section | check-pr-phone-qa.mjs --self-test | 0 | main step not runnable: needs the PR body + PR file list (GitHub context). The PR touches UI, so the body needs a Phone QA section |
| real-data-verified | real-data-verified | check-pr-real-data-verified.mjs | - | not runnable: needs the PR body. The PR touches src/, so the body needs "Verified on real data" |
| workflow-lint | bom-check / masking-check / notification-check | inline BOM check, lint-workflow-masking, notification self-test + lint | 0/0/0/0 | BOM loop re-implemented in node (no shell loops) |
| db-contract-check | live-db-gate | gate --self-test, gate | 0/0 | RUN on this PR |
| db-contract-check | contract-check | check-migration-stamps.mjs | 0 | |
| db-contract-check | contract-check | the other ~50 live sweeps | - | not runnable: need the VITE_SUPABASE_* repo secrets (prod) |
| seo-check | preview | check:seo:self-test | 0 | `check:seo` on the preview not runnable (needs a preview URL) |
| og-image-check | preview | check:og:self-test | 0 | `check:og` not runnable (needs a live deploy) |
| synthetic-ssr-monitor | preview | synthetic:ssr | - | not runnable: needs the preview URL |
| types-drift | - | - | - | does not trigger: paths filter is `src/integrations/supabase/types.ts`, which is untouched |
| pr-mergeable-guard, ci-budget-guard, live-qa, prod-smoke, stale-wip-report | - | - | - | no pull_request trigger |
| dependabot-automerge, bot-automerge | - | - | - | does not apply: Dependabot / bot branches only |

## Files changed by me

**src:**
- src/lib/accountRouting.ts
- src/modules/dancer-app/copy/sharedCopy.ts
- src/components/account/DancerHome.tsx
- src/pages/AccountSettings.tsx
- src/pages/FinishProfile.tsx
- src/pages/Privacy.tsx
- src/modules/dancer-app/screens/options/OptionsScreen.tsx
- src/modules/dancer-app/screens/options/optionsModel.ts
- NEW src/modules/dancer-app/screens/options/SignOutConfirm.tsx

**tests:**
- NEW options/__tests__/oneMessageUsBuilder.test.ts
- NEW options/__tests__/signOutOnDemand.test.tsx
- options/__tests__/OptionsScreen.test.tsx (import path)
- tests/regression/today/accountSettings.today.test.tsx + 3 snapshot files
- tests/e2e/dancer-app/onboarding.spec.ts
- tests/e2e/dancer-app/options.spec.ts
- tests/e2e/dancer-app/home-nights.spec.ts
- tests/e2e-build/helpers/journeyHarness.ts
- tests/e2e-build/account-edges.build.spec.ts

## Working-tree noise for the lead (do not commit by accident)

- The e2e and build-smoke runs **rewrote about 333 tracked screenshot PNGs** under `docs/handover/**` and `docs/review-packs/**`. They are artefacts of the local runs. Discard them with `git checkout -- docs/` unless you want refreshed shots. I deleted the two untracked shot folders my runs created (docs/handover/dancer-rebuild-w2b, -w2e).
- The vitest runs left several `__snapshots__/*.snap` files modified for **line endings only** (`git diff --ignore-cr-at-eol` is empty for them except the 3 I updated; git normalizes them on add). They are: tests/regression/today auth / dancerPage / dancerRoute / directoryAttendance / eventRsvp / festivalHub / reminderBanner, and organiser editorOrder.matrix.

## Not verified

- The secret- and preview-dependent steps listed above. These are the live contract suites against prod, lighthouse, doc-weight, seo, og and synthetic-ssr on the preview, and the PR-body checks.
- The local `test:unit` contract failures are environmental. They match origin/main, but I could not run them against prod with CI's secrets.
- I did no new real-data shape survey or 390x844 manual walk. The changes are a refactor, lazy loading and test updates. The e2e and phone suites at 390x844 and 360x640 are green.
