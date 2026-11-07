# New-dancer journey UX audit (2026-10-16)

Read-only audit of `123constante/bachata-website` main at `ecc3432`. No product code was changed.

> Owner: "Why am I having to do this? I am a beginner and you should be the professional that is creating the entire design."

The owner found four of these by hand. They are marked **OWNER-FOUND** below (H1-H4). Every one of the four reproduced.

## 1. Header

**Scope.** The path a new dancer takes from first visit to a working dancer page, then on to managing and leaving the account. It runs: signed-out home and event page, the RSVP sign-in prompt, sign-up (role, details, email), the code step, the terms card, the post-sign-up landing, setup (`/app/welcome` cards and the photo screen), the dancer app (Home, Nights, Me, Edit, Options, the header avatar and switcher), account settings, delete, deleted, restore, and the legal pages. The route list is in section 5.

**Method.** This report merges two inputs.
- **Walk.** A browser walk of a production build (`npm run build` with the phone-qa fake env: fake Supabase origin, `SEARCH_V5` off). It was served by `scripts/_serve-build.mjs` with the fake-Supabase preload. Auth, RPCs and edge functions were faked per scenario through `page.route`.
  - Sizes: 390x844 and 360x640.
  - Seeds follow the prod survey and stress past it: no profile, empty stub, half-finished, full with a 29+20-char name, a 49-char email and 15 nights, zero nights, a broken photo URL, a hidden profile, deletion pending, expired and archived, and a sole-owner delete blocker.
  - Keyboard was simulated two ways. **Resize**: the viewport set to 470 px high at 390 and 370 px at 360. **Overlay**: the layout viewport stays the same and the keyboard covers the bottom 374 px (390) or 270 px (360), as on iOS Safari and current Chrome Android. A drawn band shows it in the `*-keyboard-overlay-*` shots.
  - The walk also measured tap sizes, covered controls and disabled reasons, and ran axe.
- **Static.** A code read with file:line evidence.
  - Several static line numbers did not match `ecc3432`: `optionsModel.ts`, `SideAvatar.tsx`, `notes.tsx`, `AccountRestore.tsx`, `LegalShell.tsx`, and where `Auth.tsx` renders `fieldErrors.send`. These were checked against the source, and the line numbers in this report are the corrected ones.

**Prod shape survey** (read-only, counts only):

| Shape | Count |
|---|---|
| Auth users | 23 (13 in the last 30 days) |
| No dancer profile | 18 |
| Zero saved nights | 20 |
| Most nights for one user | 3 |
| Longest email | 37 chars |
| Longest dancer name | 23 chars |
| Non-ASCII name | 1 |
| Claimed profile with no surname | 1 |
| Profile with no dance role | 1 |

The walk seeds go past every maximum here: a 49-char email, a 49-char name and 15 nights.

**In flight.** A keyboard fix is on branch `claude/site-keyboard-safe` (2 WIP commits: a shared `src/lib/keyboard/keyboardSafe.ts` and `useKeyboardInset.ts`, "not mounted yet"). Every keyboard result below is from today's main.

**Counts (final table, after dedup):** blocker **0**, high **12**, medium **29**, low **27**, total **68**.
- 23 rows merge a walk finding with a static finding.
- The inputs had 38 findings (walk) and 51 (static).
- The walk's RSVP tap-size finding was split into two rows (event RSVP block, sign-in prompt), because they are separate components.

## 2. Findings

Columns:
- **Src**: `walk+static`, `walk`, or `static, not observed`.
- **Size**: 390 = 390x844, 360 = 360x640.
- **Chk**: checklist number. 1 Keyboard, 2 Distraction, 3 Disabled/hidden, 4 Empty states, 5 Text/links real, 6 Contrast, 7 Tap targets, 8 Copy, 9 Dead ends, 10 Sideways scroll/wrap.

**Classes:**
- **Keyboard class**: H1, H12, M1, M2, M3. Each is one form of "the thing you need is under the keyboard". One shared fix (the in-flight `keyboardSafe` helper, plus `enterKeyHint` and submit-on-Enter) should cover them all.
- **Chrome class**: H2, H5, M4. These are task screens that show full navigation.
- **Avatar class**: H4, H11, M29, L10. These come from `SideAvatar` not using the dancer avatar that Home and Me already use.
- **Legal-links class**: H3, H8, M5, M6, M7.

### High

| ID | Severity | Screen | State | Size | Chk | What is wrong | Measured evidence | Screenshot | Suggested fix |
|---|---|---|---|---|---|---|---|---|---|
| H1 | high | **OWNER-FOUND #1 (search results behind keyboard)**: city picker on sign-up step 2, setup city card, Edit city | keyboard open | both (worse at 360) | 1 | City search results open under the keyboard, and in one model the search box itself scrolls away. City is required, so this blocks sign-up and setup. walk+static | Overlay: 2 of 20 rows visible at 390, 0 of 20 at 360 (rows start y=344, keyboard top y=470/370). Resize: the list flips up and the input goes to top -94 px. Sign-up at 360: 4 of 10 rows. `src/components/ui/city-picker.tsx:223-246` is a Radix Popover (`:238`) with the input inside and a `max-h-[300px]` list, and nothing reads visualViewport. It is used at `Auth.tsx:747`, `onboarding/steps.tsx:236` and `edit/EditScreen.tsx:207` | onboarding-city-keyboard-overlay-390x844.png, onboarding-city-keyboard-overlay-360x640.png, signup-step2-city-keyboard-overlay-390x844.png | On phones open the picker as a full-screen sheet: input at the top, list below, sized to `visualViewport.height`. |
| H2 | high | **OWNER-FOUND #2**: `/auth` (all steps), code step, terms card, sign-in | any | both | 2 | Full site navigation stays on screen during sign-up. walk+static | 4 links away on each sign-up step, 6 on the code step. Header plus section row take 106 of the 370 px left above the keyboard at 360. `src/components/AppChrome.tsx:48-51,81-86` suppresses the chrome only for `/app/*`. `Auth.tsx:462` uses GlobalLayout | signup-step1-role-390x844.png, signup-step3-email-keyboard-360x640.png, code-waiting-390x844.png, signin-email-390x844.png | Add a "focused chrome" list in AppChrome (logo + one "Continue browsing" exit) for `/auth*` and `/auth/callback`. |
| H3 | high | **OWNER-FOUND #3**: `/app/options` "Terms and privacy policy" row | every shape | both | 3, 5 | The row is disabled, and its reason is false. walk+static | The row reads "The terms and privacy pages are not published on the site yet.", but `/terms` and `/privacy` return 200 and render. `src/modules/dancer-app/screens/options/optionsModel.ts:72` (`TERMS_REASON`) and `:94`. The routes are in `AnimatedRoutes.tsx:214-215` | app-options-full-longname-15nights-390x844.png, privacy-signed-out-390x844.png, terms-signed-out-390x844.png | Make it two links (`/terms`, `/privacy`) and delete `TERMS_REASON`. |
| H4 | high | **OWNER-FOUND #4**: dancer-app header avatar and switcher sheet | no photo | both | 4, 6 | The no-photo avatar is a near-black disc on a near-black header. walk says high and static says medium; it stays high because at the measured contrast the circle cannot be seen at all, and it is on every `/app` screen. walk+static | Placeholder `rgb(33,33,33)` (`bg-muted`) on header `#1C0D22` measures **1.16:1**; in the sheet it sits on `#000`. `src/components/account/profiles/SideAvatar.tsx:18-24` (`bg-muted text-foreground` at `:21`) | onboarding-name-390x844.png, incomplete-home-half-finished-390x844.png | Reuse the Me/Home Avatar (`screens/me/ui.tsx`: `--da-surface-2` with initial or person glyph) so there is one avatar component. |
| H5 | high | Setup `/app/welcome` and `/app/me/photo?return=/app/welcome` | incomplete profile | both | 2 | Required setup runs inside the full dancer app: tabs, "Events" and the logo are all live, and one tap abandons setup. walk rated medium and static high; it stays high because the photo step "cannot be skipped" yet a tap leaves it. walk+static | 6 links away on the name card, 8 on the photo card. Tapping Home, Nights, Me or Options opens those screens. The Me tab is highlighted on the photo screen. `shell/DancerAppRoutes.tsx:198-205` and `shell/DancerAppShell.tsx:39-81` | onboarding-photo-card-390x844.png, photo-crop-390x844.png | Render welcome and the setup photo screen in a minimal frame (logo + progress, no tabs, no Events). |
| H6 | high | `/finish-profile?returnTo=...` | account with no dancer profile | both | 8, 9 | A new account lands on a dead end that talks about rating parties. walk | The page says "Your account has no dancer profile yet, so you can't rate parties. Message us..."; the only actions are WhatsApp, a grey Continue and Account settings. 18 of 23 prod users have no profile. `src/lib/profileCompletion.ts:86` | after-signup-landing-390x844.png | Route a profile-less account to `/app/welcome` (create the stub), or at least word the page for a new sign-up. |
| H7 | high | Code step | resend refused (429) | both | 9, 3, 8 | "Resend code" fails silently, and the 30 s cooldown is shorter than Supabase's default 60 s per-address send interval. walk+static | The 429 left no new text on screen; the button reset and the box stayed locked. `MagicLinkConfirmation.tsx:29` sets `COOLDOWN = 30` and `:154-166` always restarts the countdown. The error goes to `fieldErrors.send` (`Auth.tsx:316-320`), which is rendered only in the form branch (`Auth.tsx:438`) and never in the code-step branch (`:406-428`) | code-resend-refused-390x844.png | Have `onResend` return its outcome, show it under the code box ("Wait a minute, then resend"), and set COOLDOWN to 60. |
| H8 | high | Terms accept card on sign-in | account with no acceptance | 390 (same path at 360) | 5, 9 | Tapping Terms or Privacy on the card leaves the page; Back then shows a code box for a code already spent. walk | Back lands on `/auth?mode=signin` showing "Check your email" with an 8-digit box while the header shows the person signed in; `cardStillThere: false`. `src/components/auth/ConsentLine.tsx:8-14`, `Auth.tsx:349-353,392` | terms-card-shown-390x844.png, terms-card-after-back-390x844.png | Open legal pages in a sheet or new tab, and persist `needsAccept` (or `forgetCodeStep()` before the card). |
| H9 | high | `/auth` form and code step | signed out, no returnTo | n/a-static | 9, 5 | "Continue browsing" sends a signed-out visitor to a guarded page, which bounces them to Sign in. static, not observed | `Auth.tsx:88` sets `returnTo` to `SIGNED_IN_LANDING_PATH` = `/account/continue` (`auth-otp-routing.ts:89`) when organiser self-serve is on. "Continue browsing" (`Auth.tsx:421,858`) goes there, `ContinueAsPage.tsx:60` wraps it in AuthGuard, and AuthGuard redirects to `/auth?mode=signin` | none | "Continue browsing" goes to `explicitReturnTo` or the city page, never the signed-in landing. |
| H10 | high | `/app/options` sign-out sheet | "Yes, sign out" | both | 9 | Signing out lands on the sign-in form, not the site. walk | The trail ends at `/auth?mode=signin&returnTo=%2Fapp%2Foptions` ("Welcome back"). AuthGuard redirects before `navigate('/')` runs. `OptionsScreen.tsx:96-106`, `ProfileSwitcher.tsx:46-57` | options-after-signout-390x844.png | Navigate to `/` first, then sign out (or mark the sign-out as intended for AuthGuard). |
| H11 | high | Dancer-app header and switcher | photo URL fails to load | both | 4 | A broken photo URL shows the browser's broken-image icon. walk | `side-avatar-img` has no `onError`; the glyph shows at 32 px (header) and 36 px (sheet). Home and Me fall back to the initial for the same profile. 2 prod rows are on a legacy host. `SideAvatar.tsx:15-16` | switcher-sheet-complete-no-photo-shown-390x844.png | Same `onError` fallback as the Me Avatar (solved by the H4 merge). |
| H12 | high | Organiser onboarding search (`/account/o`, reached from Options "Become an organiser") | keyboard open | n/a-static | 1 | Search results render below the field with no keyboard handling. The static read takes this as the owner's search bug; the walk took the city picker (H1). Both are kept. static, not observed | `src/modules/organiser/home/onboarding/OnboardingView.tsx:104` SearchField, with the results card below; no scrollIntoView or visualViewport use in the file. The header search passed in the walk (4 of 4 results above the keyboard; the fake returns at most 4) | home-search-keyboard-overlay-390x844.png (header search, passed; for contrast) | Use the in-flight `keyboardSafe` helper here too: pin the field at the top and scroll the results into view. |

### Medium

| ID | Severity | Screen | State | Size | Chk | What is wrong | Measured evidence | Screenshot | Suggested fix |
|---|---|---|---|---|---|---|---|---|---|
| M1 | medium | Sign-up step 3 (email) | keyboard open | both (worse at 360) | 1 | "Email me a link" is under the keyboard. walk | 390: button 450-494, so its centre (472) is below the visible 470. 360: the button is wholly below 370. `Auth.tsx` email step about :760-790 | signup-step3-email-keyboard-390x844.png, signup-step3-email-keyboard-360x640.png | `enterKeyHint="send"` + submit on Enter, and scroll the button into view on focus. |
| M2 | medium | Setup name card | keyboard open | 360 | 1 | The field and Continue are both under the keyboard. walk | Field and Continue at 419-467, visible area ends at 370. `onboarding/steps.tsx:39-55` | onboarding-name-keyboard-360x640.png | `enterKeyHint="next"` + submit on Enter. |
| M3 | medium | `/account/settings/delete` | keyboard open | 360 | 1 | The red "Delete my account" button is under the keyboard. walk | Field at 298-342, button below 370; the site chrome takes 106 px. `AccountSettings.tsx:470-488` | settings-delete-keyboard-360x640.png | Focused chrome (M4) + `enterKeyHint="done"`. |
| M4 | medium | `/account/settings*`, `/account/restore`, `/account/deleted`, `/auth/callback` | any | both | 2 | Account and delete pages show the full site chrome and switch from the plum app to the black/orange site, with no way back to Options. walk+static | The delete page has 31 links away (10 in the first viewport, including a 20-link footer). `AccountSettings.tsx:497`, `AccountDeleted.tsx:13`, `AccountRestore.tsx:136` and `AuthCallback.tsx:333` use GlobalLayout | settings-delete-390x844.png, settings-home-viewport-390x844.png | Focused chrome for these paths, plus "Back to Options" when entered from `/app`. |
| M5 | medium | Setup first card | any | both | 5, 8 | The consent line is plain text and records nothing. Its code comment wrongly says the legal pages are not routes, and the person already accepted at sign-up. walk+static | Text: "By continuing you accept the Terms and Privacy policy." with no links. `onboarding/notes.tsx:24-30`. Acceptance is already recorded at `Auth.tsx:344-346` | onboarding-name-390x844.png | Delete the line (consent already recorded), or use `ConsentLine` opening in a sheet. |
| M6 | medium | Code step, terms card | any | both | 7 | Consent links are tiny and leave the page. walk rated medium and static low; it stays medium because the size was measured. walk+static | 30x12 and 67x12 px. `ConsentLine.tsx:8-14` uses inline `text-xs` with no padding | code-waiting-390x844.png | `inline-flex min-h-[44px]` on each link, opening without leaving the step. |
| M7 | medium | Sign-up email step, code step | sign-up | n/a-static | 8, 5 | Consent appears only after the account is created, and says "By continuing" where there is no continue button (the code auto-submits). static, not observed | No ConsentLine on the email step (`Auth.tsx:791-851`); `signInWithOtp({shouldCreateUser:true})` runs at `:275-279`; the line is only under the code box (`MagicLinkConfirmation.tsx:227`) | none | Put `ConsentLine` above "Email me a link", worded "By tapping Email me a link you agree to...". |
| M8 | medium | Setup "You're in" card | after required cards | both | 8 | "Boost to 100%" can only reach 90%, and "you're past the line" is jargon. walk+static | The two optional questions add 10% each (70 to 90); 100% also needs a bio and a link. `OnboardingScreen.tsx:132,139` | onboarding-in-card-390x844.png | Say "Two quick questions" and "Your profile is live". |
| M9 | medium | Setup photo card, then the photo screen | any | both | 8, 9 | "Take photo" and "Choose from my photos" go to the same page, which asks the same question again. "Take photo" never opens the camera. walk+static | Both link to `/app/me/photo?return=/app/welcome`. `onboarding/steps.tsx:111-119`, `PhotoScreen.tsx:254-261` | onboarding-photo-card-390x844.png, photo-pick-390x844.png | One "Add my photo" button, or file inputs on the card (`capture="user"` for Take photo). |
| M10 | medium | Event page RSVP block | signed out (and in) | both | 7 | RSVP buttons are under 44 px. walk+static | "I'm Going" 243x34, "Interested" 105x34, Share 31x31, "Dismiss hint" 12x12. `RsvpBlock.tsx:70-71` uses `h-10` (rem, about 34 px on phones) | event-signed-out-390x844.png | `min-h-[44px]` in px. |
| M11 | medium | Event sign-in prompt (and level-rating sheet) | signed out | both | 7 | The close button and the buttons are too small. walk+static | Close 14x14, Log In and Sign Up 37 px tall. `AuthPromptModal.tsx:55,65,72`; dialog close is a 16 px icon (`ui/dialog.tsx:45-46`) | event-signin-prompt-390x844.png | A 44 px close per dialog (do not touch `dialog.tsx`, per CLAUDE.md) and `min-h-[44px]` buttons. |
| M12 | medium | Event sign-in prompt vs `/auth` | signed out | both | 8 | Two vocabularies ("Log In/Sign Up" vs "Sign in/Create account"). "Let the organiser know you're going" contradicts `/privacy` ("Your nights are private to you"). walk+static | `AuthPromptModal.tsx:60,70`, `LevelRatingSignInSheet.tsx:46,55`, `RsvpBlock.tsx:181`; `/auth` at `Auth.tsx:495,507` | event-signin-prompt-390x844.png | One pair (Sign in / Create account) and copy that matches the privacy page. |
| M13 | medium | Event page hero | any | both | 6 | Event title contrast is 4.05:1. walk | White 18 px bold on `#e13a8a`; it was the only axe colour-contrast failure in the walk | event-signed-out-390x844.png | Darken the pink behind the title, or make the title at least 24 px. |
| M14 | medium | `/app/home` hero card | any | both | 6 | White text on the coral gradient start is about 2.5:1. The walk passed it only because axe skips gradient backgrounds. static, not observed by axe; confirmed by computing `#FFFFFF` on `#FF7A66` = 2.55:1 | `HomeScreen.tsx:110` gradient `var(--da-accent)` (`#FF7A66`, `dancer.css:18`) with `--da-on-gradient #FFFFFF` (`:25`) | app-home-new-nophoto-zero-nights-390x844.png | Darken the gradient start, or use `--da-on-accent` dark text. |
| M15 | medium | Sign-up step 2 (details) | last field filled | both | 8, 9 | The step jumps to email as soon as the third field is filled, before Continue is pressed. walk | `stillOnDetailsAfterLastField: false`. `Auth.tsx:147-148` | signup-step2-details-errors-390x844.png | Leave the step only on Continue. |
| M16 | medium | `/app/options` share row | hidden profile | both | 8 | The same state is called "paused / Unpause" in Options and "hidden / Show my profile again" everywhere else, and no "Unpause" control exists. walk+static | `optionsModel.ts:68`; `AccountSettings.tsx:305`; Home and Me say "hidden"; `Privacy.tsx:40` implies two features | app-options-hidden-profile-390x844.png | One word ("hidden") from one shared string. |
| M17 | medium | Sign-up step 2, setup city, Edit city and nationality | any | both | 8 | The city and nationality comboboxes have no accessible name. walk+static | axe `button-name`: `aria-labelledby` points at ids that do not exist; the City `<Label>` has no `htmlFor` (`Auth.tsx:745`). `city-picker.tsx:224-236` | none | Pass `aria-label` or a real `aria-labelledby` to CityPicker and the nationality picker. |
| M18 | medium | Sign-up email step | sign-up refused (403) | n/a-static | 5, 8 | A refused dancer is told sign-up is "limited to approved organisers", with a WhatsApp prefill "I'd like to list my events". static, not observed | `auth-otp-routing.ts:32-34`, shown via `Auth.tsx:312-313`; prefill in `contactLinks.tsx:22-26` | none | Neutral copy ("We can't create an account for this email right now. Message us.") and a neutral prefill. |
| M19 | medium | `/app/home` | all shapes | both | 3, 4, 8 | Two dead "Coming soon" tiles take about a quarter of the first screen, with different punctuation. walk rated low and static medium; it stays medium because this is prime first-screen space on a new dancer's home. walk+static | `HomeScreen.tsx:143-155` ("Coming soon" vs "Coming soon.") | app-home-new-nophoto-zero-nights-390x844.png | Remove both tiles until the features exist. |
| M20 | medium | `/app/home` "What's on this week" | no site city stored, or a different one | both (unverified with 2nd city) | 4, 5, 8 | Uses the site's active city, not the dancer's. A new person with no stored city sees a false "Nothing listed this week yet." walk rated low; static shows the false empty state, so medium. walk+static | `WhatsOn.tsx:18` `useActiveCitySlug()`; empty text at `:46` | none | Use `profile.based_city_id`'s slug; with no slug show "Pick a city", not "Nothing listed". |
| M21 | medium | `/account/settings`, `/account/settings/ownership` | any | both | 8, 10 | Delete is filed under "Account ownership" (the section, the button and the next page title), and the breadcrumb is cut to "Account owner...". walk rated low, static medium; medium because Options promises "delete your account: Account settings". walk+static | Breadcrumb scrollWidth 108 > clientWidth 100. `AccountSettings.tsx:334-338,493` | settings-ownership-390x844.png | Rename to "Delete account" and link straight to the delete view. |
| M22 | medium | `/app/me/photo` | upload failed | n/a-static | 8 | Any non-network upload error message is shown to the person word for word. static, not observed | `PhotoScreen.tsx:218` calls `uploadErrorMessage`; `upload-validation.ts:55` returns `message` if set | none | Map unknown causes to one plain sentence and log the raw text. |
| M23 | medium | `/app/welcome` | profile read failed | n/a-static | 9 | The setup load error is a dead end: there is no Try again and no way back. static, not observed | `OnboardingScreen.tsx:85-91` (`retry:false` at `:52`); compare `screens/me/ui.tsx:86-93` | none | Add Try again (refetch) and a back link. |
| M24 | medium | `/app/me` (incomplete), setup, `/event/:id` | profile under 70% | n/a-static | 8, 5 | "Going and Interested unlock at 70%" does not match the event page, which lets any signed-in user tap RSVP. static, not observed | `MeScreen.tsx:59`, `OnboardingScreen.tsx:135`; `useOccurrenceRsvp.ts:72` `canRsvp = Boolean(user?.id) && !user?.is_anonymous`; `rsvpErrorMessage` has no incomplete-profile case | none | Check the server rule, then drop the claim or show "Finish your profile to say Going" with a link. |
| M25 | medium | Signed-out home and event header | signed out | n/a-static | 8 | There is no "Create account" entry; a new dancer must tap "Sign in" and then switch tabs. static, not observed | `GlobalHeader.tsx:219` "Sign in" goes to `mode=signin` (`authRouting.ts:35-37`); no sign-up link in the home feed | home-signed-out-390x844.png | Label it "Sign in / Join", or add a "Create account" link. |
| M26 | medium | `/account/restore` | 30-day window closed | 390 | 9 | The page is a dead end: only two mailto buttons, while the person is still signed in. The walk marked restore as passing (true for restored and archived); the source shows the expired card has no other exit, so FAIL. static, confirmed in source | `AccountRestore.tsx:29-45` (DeletedCard), used at `:50,116` | restore-expired-390x844.png | Add "Back to the calendar" and "Sign out". |
| M27 | medium | `/privacy`, `/terms`, delete, deleted, restore | any | n/a-static | 5 | Every contact mailto goes to an address that may have no mailbox. static, not observed | `accountDeletionCopy.ts:10` `support@bachatacalendar.co.uk`; `docs/account-system/GAPS.md` G-D2 "No apex MX" | none | Owner sends a test mail to confirm the inbox before relying on it. |
| M28 | medium | Sign-up details, setup city card | city not in list | n/a-static | 9, 5 | A city that is not in the list blocks sign-up and setup ("City requests are temporarily unavailable."), with no other way on. static, not observed | City is required (`Auth.tsx:236`, `steps.tsx:240-243`); `city-picker.tsx:264` | none | Offer "Message us to add your city" as a link. |
| M29 | medium | Dancer-app header avatar | before the first name is saved, or name read failed | both | 4 | The avatar initial is "Y", taken from the placeholder "Your dancer profile". walk+static | Seen as "Y" on the setup name card. `SideAvatar.tsx:5` fallback; `useProfileSides.ts:47-53,67` | onboarding-name-390x844.png | With no name, show a person glyph (folds into the H4 fix). |

### Low

| ID | Severity | Screen | State | Size | Chk | What is wrong | Measured evidence | Screenshot | Suggested fix |
|---|---|---|---|---|---|---|---|---|---|
| L1 | low | Code step, delete, deleted | long email | both | 10 | A long email breaks mid-word. The static read listed `break-all` as fine; the walk measured the split, so it is kept. walk | "maria.fernanda.rodriguez.vill / anueva@..."; "support@...co.u / k". `MagicLinkConfirmation.tsx:177` | code-wrong-390x844.png, settings-delete-390x844.png | `overflow-wrap:anywhere`, or `<wbr>` before "@". |
| L2 | low | Dancer header logo | any | 360 | 10 | "Bachata Calendar" wraps onto 2 lines. walk | Measured at 360 | app-home-new-nophoto-zero-nights-360x640.png | `white-space:nowrap` and a smaller size under 375 px (`dancer.css:68`). |
| L3 | low | `/app/nights` | past nights | both | 8 | Past nights still read "Going" and "Interested". walk | Sat 10 Oct (past) shows "Going". `nightsModel.ts:57-67` | app-nights-full-longname-15nights-390x844.png | Past tense: "Went" and "Was interested". |
| L4 | low | `/app/home` rate nudge | last night 6 days ago | both | 8 | "Rate last night's event" names a night 6 days old. walk | Sat 10 Oct shown on 16 Oct. `RateNudge.tsx:25` | app-home-full-longname-15nights-390x844.png | "Rate Sat 10 Oct". |
| L5 | low | `/auth?mode=signup` | any | both | 8 | "3 easy steps" undercounts: the code, the photo and up to 2 optional cards come after. walk+static | `Auth.tsx:479,720` | signup-step1-role-390x844.png | "Three quick questions, then we email you a code". |
| L6 | low | Terms accept card | any | both | 8 | "We have updated how we ask. Please confirm to carry on." does not say what is being accepted. walk+static | `TermsAcceptCard.tsx:8` | terms-card-shown-390x844.png | "Please accept our Terms and Privacy Policy to carry on." |
| L7 | low | `/auth`, `/account/*`, `/finish-profile` | any | both | 6 | Decorative floating icons are drawn over form text. walk | `FloatingElements` sit at z-0 under translucent cards. `GlobalLayout.tsx:189` | settings-delete-keyboard-360x640.png, signup-step1-role-390x844.png | `showGradientBg={false}` on task pages. |
| L8 | low | Main-site header and home tabs | any | both | 7 | Header search and home tabs are under 44 px. walk | Search 145-207x31; tabs 88x24; map credits 22x22; breadcrumbs 17 px; footer links 14 px. `HeaderSearch.tsx:231` | home-signed-out-390x844.png | 44 px min-height in px. |
| L9 | low | `/app/options`, `/app` header | any | both | 2, 8 | "Become an organiser" is the first row for every dancer, and two pairs of controls go to the same place. walk+static | "Back to website" and "Browse all events" both go to `/` (`OptionsScreen.tsx:165-166`); logo and "Events" both go to `/` (`DancerAppShell.tsx:41,49`). `optionsModel.ts:36-38,88-92` | app-options-full-longname-15nights-390x844.png | Move organiser below Help; keep one control of each pair. |
| L10 | low | Switcher sheet | open | both | 6, 8 | The sheet is site-black (`#000`) inside the plum app. walk | `bg-background`. `ProfileSwitcher.tsx:70-76` | switcher-sheet-complete-no-photo-shown-390x844.png | `--da-surface` under `[data-profile=dancer]`. |
| L11 | low | Photo pick and crop | setup | both | 9 | No Back or "Not now" link to the setup card. walk | The only exits are "Choose a different photo" and the tabs. `PhotoScreen.tsx:249-262` | photo-pick-390x844.png | Back link to the `return=` target. |
| L12 | low | `/app/options` | teacher or DJ | n/a-static | 3 | "I teach" and "I DJ" rows are disabled with "coming soon". static, not observed | `optionsModel.ts:83-84` | none | Hide them until those areas exist. |
| L13 | low | Dancer area naming | any | n/a-static | 8 | One place has four names: "Options" tab, "Settings" page, "Account settings" links, "Your account" crumbs. static, not observed | `shell/routes.ts:133`, `AccountSettings.tsx:493`, `ProfileSwitcher.tsx:124`, `siteIa.ts:61,66` | none | Use "Account settings" everywhere. |
| L14 | low | Dancer area naming | any | n/a-static | 8 | Several verbs for browsing (Events, Browse what's on, Browse all events) and nouns for saved nights. static, not observed | `DancerAppShell.tsx:51`, `HomeScreen.tsx:127,148`, `WhatsOn.tsx:62`, `OptionsScreen.tsx:166` | none | One verb and one noun. |
| L15 | low | `/app/options` share | any | n/a-static | 8 | "Share my page" only copies the link; it never opens the native share sheet. static, not observed | `OptionsScreen.tsx:129` | none | Use `navigator.share` when available, else copy. |
| L16 | low | Setup first card | linked existing profile | n/a-static | 5, 8 | "Not you? Message us" uses the organiser WhatsApp prefill, and its href is undefined until a lazy import loads. static, not observed | `onboarding/notes.tsx:12,17-18` | none | `messageUsUrl("This profile is not me")`. |
| L17 | low | Setup role, Me | invalid role | n/a-static | 8 | The error says "Lead and Follow", but the chip says "Both". static, not observed | `api/errors.ts:30` | none | Say "Both". |
| L18 | low | `/account/continue` | signed in | n/a-static | 8 | "Switch any time from the picture at the top right", but site pages show a person icon there and no switcher. static, not observed | `ContinueAsPage.tsx:29` | none | "from your account button". |
| L19 | low | `/account/settings/delete` | typing DELETE | n/a-static | 7, 8 | The field uses `autoCapitalize="off"` but needs an exact "DELETE", with no trim. static, not observed | `AccountSettings.tsx:472`; `accountSettings.ts:18,20` | none | `autoCapitalize="characters"` and compare `trim()`. |
| L20 | low | Code step | 320 px wide | n/a-static | 10 | 8 slots of `w-9` plus gaps need about 294 px, but only about 240 px is left at 320. 360 passed in the walk. static, not observed | `MagicLinkConfirmation.tsx:206-219` (`w-9` at `:214`) | none | Shrink the slots below 360 px. |
| L21 | low | `/account/deleted` | just deleted | both | 9, 8 | The page says "Sign in within 30 days to undo", but the only button is "Back to the calendar". static, not observed | `AccountDeleted.tsx:18,29-34` | account-deleted-after-delete-390x844.png | Add a "Sign in to undo" button. |
| L22 | low | `/app/nights` | zero nights | n/a-static | 4, 8 | The empty text "You're not going to anything yet." ignores Interested. static, not observed | `NightsScreen.tsx:71` | app-nights-new-nophoto-zero-nights-390x844.png | "No nights saved yet." |
| L23 | low | Switcher vs Options and Settings | sign out | n/a-static | 8 | The switcher signs out with no confirm; the other two ask first. static, not observed | `ProfileSwitcher.tsx:49,126`; `OptionsScreen.tsx:183-188`; `AccountSettings.tsx:114-127` | none | The same behaviour in all three. |
| L24 | low | `/privacy`, `/terms` | any | n/a-static | 8 | "Last updated 2026-10-16" shows a raw ISO date. static, not observed | `LegalShell.tsx:16` | privacy-signed-out-390x844.png | "16 October 2026". |
| L25 | low | `/auth` role step | sign-up | n/a-static | 8 | "I'm also an organiser" replaces Dancer instead of adding to it. static, not observed | `Auth.tsx:665,682` | signup-step1-role-390x844.png | "I'm an organiser / teacher / ...". |
| L26 | low | Source hygiene | n/a | n/a-static | 8 | Raw Unicode ellipsis in JSX (the CLAUDE.md mojibake rule). static, not observed | `ProfileSwitcher.tsx:127`, `AuthCallback.tsx:338` | none | Use `&hellip;`. |
| L27 | low | Terms consent | version bump | n/a-static | 5 | `termsConsent.ts` keeps its own `TERMS_VERSION`; a bump in `legalVersions.ts` would not re-ask. static, not observed | `termsConsent.ts:6-10`; `legalVersions.ts:3` | none | Re-export from `legalVersions.ts`. |

## 3. Screen x checklist matrix

Key: P = PASS, F = FAIL (finding IDs), N = N-A, `-` = not walked (static only). "390/360" marks a cell that differs by size. Cells come from the walk, with FAILs added for static-confirmed defects.

| Screen | 1 Keyboard | 2 Distraction | 3 Disabled | 4 Empty | 5 Links | 6 Contrast | 7 Tap | 8 Copy | 9 Dead end | 10 Sideways |
|---|---|---|---|---|---|---|---|---|---|---|
| Home signed out (+ header search) | P (4/4 results visible) | N | N | P | P | P | F L8 | F M25 | P | P |
| Event signed out (+ sign-in prompt) | N | N | P | N | P | F M13 | F M10, M11 | F M12, M24 | P | P |
| Sign-up 1, role | N | F H2 | N | N | P | F L7 | P | F L5, L25 | P | P |
| Sign-up 2, details + city | P/F H1 | F H2 | P | N | F M28 | P | P | F M15, M17 | F M28 | P |
| Sign-up 3, email | F M1 (worse at 360) | F H2 | N | N | F M18 | P | P | F M7, M18 | F H9 | P |
| Code step (waiting, wrong, locked, resend) | P | F H2 | F H7 | N | F H8 | P | F M6 | F L1, M7 | F H7, H9 | P (360; 320 F L20) |
| Terms accept card | N | F H2 | P | N | F H8 | P | F M6 | F L6 | F H8 | P |
| Landing, no profile (`/finish-profile`) | N | P | N | F H6 | P | F L7 | P | F H6 | F H6 | P |
| Setup name / city / role | F H1; P/F M2 | F H5 | P | F H4, M29 | F M5, L16 | P | P | F M5, M17, L17 | F M23, M28 | P |
| Setup photo card + photo pick/crop/preview | N | F H5 | P | P | P | P | P (360: Next under tab bar until scrolled) | F M9, M22 | F L11 | P |
| Setup in / years / styles / nice | N | F H5 | P | N | P | P | P | F M8 | P | P |
| App Home (4 shapes) | N | P | F M19 | F H11, M19, M20 | F M20 | F M14 | P | F L4, M19 | P | P/F L2 |
| App Nights (15 / 0) | N | P | N | P | P | P | P | F L3, L22 | P | P |
| App Me (4 shapes) | N | P | P | P | ? (`/dancers/<id>` not verifiable) | P | P | F M24 | P | P |
| App Edit | F H1 (city, static) | P | P | P | P | P | P | F M17 | P | P |
| Options (+ install, sign-out, share) | N | F L9 | F H3, L12 | N | F H3 | P | P | F M16, L9, L13, L15 | F H10 | P |
| Header avatar / switcher sheet | N | P | N | F H4, H11, M29 | P | F H4, L10 | P | F L23 | P | P |
| `/account/continue` | - | - | - | - | - | - | - | F L18 (static) | - | - |
| `/account/settings` | P/F (360: reason line under keyboard) | F M4 | P | P | P | F L7 | F L8 | F M21, L13 | P | P |
| Ownership + delete | P/F M3 | F M4 | P | N | F M27 | F L7 | F L8, L19 | F M21, L1, L19 | P | F M21 (breadcrumb cut) |
| `/account/deleted` | N | F M4 | N | N | F M27 | P | P | F L21 | F L21 | P |
| `/account/restore` (restored, expired, archived) | N | F M4 | N | N | F M27 | P | P | P | F M26 (expired) | P |
| Sign-in (returning) | P | F H2 | N | N | P | P | P | P | P | P |
| `/privacy`, `/terms` | N | N | N | N | F M27 | P | P | F L24 | P | P |
| Organiser onboarding search (`/account/o`) | F H12 (static) | - | - | - | - | - | - | - | - | - |

Size differences (390 vs 360): H1, M1 and M3 are worse at 360. M2 fails only at 360. The settings email reason line is under the keyboard only at 360. L2 (logo wrap) appears only at 360. The photo-crop Next button sits under the tab bar at 360 until scrolled. No screen scrolled sideways at either size: `scrollWidth` equalled the device width everywhere, including the 49-char email and the 49-char name.

Matrix changes from the walk:
- Code step, column 3: changed to F H7, since a silent refusal hides the real state.
- Restore, column 9: changed to F M26 (expired).
- Home, column 6: changed to F M14.
- `/account/deleted` and `/account/restore`, column 2: changed to F M4, since they share M4's root (`GlobalLayout`).
- Static-only copy, link and dead-end FAILs were added where they apply.

## 4. Not verified

- **Real keyboard.** Both keyboard models are simulations. The 374 px and 270 px heights are typical, not measured on a device, and safe-area insets cannot be emulated in Chromium.
- **Real email delivery.** OTP send and verify were faked. Not checked: the code email itself, the Supabase per-address send interval (H7 assumes the 60 s default), whether `support@bachatacalendar.co.uk` receives mail (M27), and email-change confirmation mails.
- **Real upload to storage.** `storage-sign-upload` was faked, so the real upload, its error texts (M22) and a real camera were not exercised.
- **Search V5.** The build had `SEARCH_V5` off, so only the old header search was walked. It passed, with at most 4 fake results. If prod has V5 on, the owner's search complaint may be about that overlay. The organiser onboarding search (H12) was not walked either. Which screen the owner meant by "search results behind keyboard" is not settled: the walk says the city picker (H1), the static read says organiser search (H12).
- **Signup trigger.** Not known whether the prod signup trigger creates a dancer stub. The two outcomes are setup (walked) or the H6 dead end (walked). 18 of 23 prod users with no profile suggests H6 is common.
- **Dancer area gate.** The real `dancer_area_gate_v1` answer per user is unknown; the audit assumed open and allowed. If closed, users get the old `/account` dancer home, which was not walked.
- **Static-only behaviour.** Not walked: the sign-up refusal (M18), Continue browsing (H9), the setup load error (M23), RSVP with an incomplete profile (M24), a city not in the list (M28), the 320 px code slots (L20), and `/account/continue` (L18).
- **Return after RSVP sign-up.** Returning to the event after sign-up from the RSVP prompt, and keeping the RSVP intent, was not followed.
- **Other pages and features.** Not checked: the dancer's public page `/dancers/<id>` (the fake SSR 404s), event pages linked from Nights, Home and What's On (fake ids), native share and the clipboard (the clipboard was denied, so the manual copy field showed), and the export download file.
- **Second city.** What's On with a second city (M20 relies on static evidence).
- **Disabled-control contrast.** axe excludes disabled controls; Continue at 0.5-0.6 opacity was not measured. Gradient contrast is also skipped by axe (M14 was computed by hand).

## 5. In-scope routes (from static)

**Signed out:**
- `/` (redirects to the city home)
- `/city/london`, `/city/london/calendar`
- `/event/:id` (RSVP block, level-rating sheet)
- `/auth?mode=signup` (role, details, email steps) and `/auth?mode=signin`
- The code step: same URL after send; a reload within 10 min restores it
- `/auth/callback?mode=signup`
- `/privacy`, `/terms`, `/account/deleted`

**Signed in:**
- `/account/continue`
- `/account` (redirects)
- `/account/dancer` (redirects into `/app`)
- `/finish-profile` (redirects to `/app/welcome` when allowed)
- `/app` (redirects to `/app/home`)
- `/app/welcome` (cards: name, city, role, photo, years, styles, "in", "nice")
- `/app/me/photo?return=/app/welcome`
- `/app/home`
- `/app/nights`, `/app/nights?focus=<seriesId>`
- `/app/me`, `/app/me/edit`, `/app/me/photo`
- `/app/options` (install and sign-out sheets; share copies the link)
- `/account/settings`, `/account/settings/ownership`, `/account/settings/delete`
- `/account/restore` (and `?returnTo=`)
- `/account/o` (organiser onboarding, reached from Options)
- Public share target `/dancers/:profileId`

**Other surfaces:** the header avatar and switcher sheet (top-right of the `/app` shell, `ProfileSwitcher`).
