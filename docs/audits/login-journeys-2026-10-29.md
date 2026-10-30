# Login journeys audit - 2026-10-29

READ-ONLY audit of `origin/main` @ 2f81eec. No source, test, workflow, flag or database change. Live DB read with SELECT counts only (prod `stsdtacfauprzrdebmzg`). ASCII only.

## Summary for the owner (plain English)

1. Signing in works by e-mail code (8 digits) or the link in the e-mail. There is no password and no Google button in the code.
2. The "Sign in" button on the homepage header only shows when the flag `organiserSelfServe` is ON. The `/auth` page itself is always live, and other things link to it (the home banner "join", pages that need a login, the account area).
3. After sign-in a person goes to a chooser (`/account/continue`) or straight to their only side (dancer `/app` or organiser `/account/o`). Nobody is ever sent to the new P3 area (`/account/p3`) by sign-in: P3 can only be reached by typing the address or from inside P3.
4. The invite link (`/invite/<token>`) is the strongest journey. Every answer the server can give (used, expired, withdrawn, wrong e-mail, team full, rate limit, not linked) has its own screen with a next step.
5. Weak spot on the invite link: the "Open your organiser home" button after joining goes to `/account/o`, which bounces to the homepage when `organiserSelfServe` is OFF. Joining then looks like a dead end.
6. Weak spot on plain organiser sign-up with the flag OFF: the code sends them to `/create-organiser-profile`, a page that was retired and now shows "not found".
7. The new organiser onboarding (P3 `/account/p3/start`) is built but "Go live" is a stub: the server function `complete_organiser_onboarding_v1` exists and works, but the website never calls it, so Review shows Go live disabled.
8. Ambassador-city rule: the server sends a page for review only when the city has an ambassador. Today 0 of 319 cities do, so every page would go straight live. The website has no UI that has ever been run against the "review" outcome in prod.
9. Real numbers: 49 organiser pages, all live; 40 have no owner (claimable), 9 have an owner. 10 invites: 2 open, 4 used, 3 expired, 1 withdrawn. 42 accounts; 2 have no dancer profile.
10. Fix first: the two dead ends above (5, 6), wire go-live, and make sign-in land somewhere sensible when P3 is on.

## Flags involved (src/lib/featureFlags.ts)

| Flag | Where | Effect | Prod value |
|---|---|---|---|
| `organiserSelfServe` (VITE_ENABLE_ORGANISER_SELF_SERVE) | featureFlags.ts:64 | OFF: `/account`, `/account/o/*`, `/account/dancer` redirect to `/`; header has no Sign in and no account icon; sign-in with no returnTo lands on `/` | Not verified (Vercel env, not readable here) |
| `organiserP3` (VITE_ENABLE_ORGANISER_P3) | featureFlags.ts:67 | Route `/account/p3/*` exists only if ON and `organiserSelfServe` ON (AnimatedRoutes.tsx:264); OFF = catchall NotFound | Not verified |
| `organiserTicketing` | featureFlags.ts:71 | `/account/tickets/*` only if ON and self-serve ON (AnimatedRoutes.tsx:268) | Not verified |
| DB `app_feature_flags.organiser_onboarding_gate` | live DB | OFF now (updated 2026-10-29 00:33 UTC). When ON, organiser event writes need onboarding complete (admins exempt). Website has no reference to it (grep empty) | enabled = false |

Note: the 3 website flags are Vercel env values; this audit could not read them. Every flag-dependent claim below is stated for both values.

## Journey 1 - SIGN IN from the homepage

| # | Step | Route | Component file:line | Error / empty / expired behaviour | Flag-dependent? |
|---|---|---|---|---|---|
| 1 | Click Sign in in the header | any page | GlobalHeader.tsx:63-72 (`showSignIn`), 214-221 | Hidden while auth is resolving or failed (so a signed-in reader never sees it), hidden on auth pages, hidden if the current path is not a safe returnTo | YES: needs `organiserSelfServe` |
| 2 | Link built | `/auth?mode=signin&returnTo=<here>` | lib/authRouting.ts:36 `buildSignInHref` | Unsafe returnTo (off-site, `//`, backslash, `/auth*`) dropped (authRouting.ts:9-30) | no |
| 3 | Auth page, sign-in tab | `/auth` | AnimatedRoutes.tsx:276, pages/Auth.tsx:110-141 (state), 531-560 (tabs), 612-660 (sign-in form) | Default `mode` is SIGNUP when absent (Auth.tsx:116). Already-signed-in visitor is redirected on to returnTo (Auth.tsx:136-141) | landing default is flag-dependent (Auth.tsx:115) |
| 4 | Enter e-mail, send code | same | Auth.tsx:262-330 (`signInWithOtp`, `shouldCreateUser:false` on sign-in) | No account: `otp_disabled` -> notice "No account for this email yet. Create one to continue." (auth-otp-routing.ts, OTP_NO_ACCOUNT_NOTICE) and a switch to sign-up; rate limit (429) -> "Wait a minute" copy | no |
| 5a | Type the 8-digit code | same | Auth.tsx:375-382 then `/auth/callback?mode=..&returnTo=..` | Wrong/expired code stays on the boxes with 3-try limit (auth-otp-routing.ts OTP_LIFETIME_SECONDS) ; resend cooldown 60s | no |
| 5b | OR click the e-mail link | `/auth/callback` | AnimatedRoutes.tsx:277, pages/AuthCallback.tsx:114-435 | Timeout -> `/auth?mode=signin&callbackError=timeout` (AuthCallback.tsx:158-161, 179-182); expired/invalid link -> same with `expired`/`invalid`; copy in auth-otp-routing.ts `callbackErrorCopy`. Unknown reason shows nothing | no |
| 6 | Callback decides landing | `/auth/callback` | AuthCallback.tsx:204-211 (deleted account -> `/account/restore`), 288-320 | Order: restore page for a deleted account; explicit returnTo (if `shouldHonorReturnTo`); stashed `auth_pending_return_to`; claim landing (organisers claimed at sign-in); else `landingPathAfterAuth` | YES (see 7) |
| 7 | Default landing | `/account/continue` (self-serve ON) or `/` (OFF) | lib/auth-otp-routing.ts `landingPathAfterAuth`, `SIGNED_IN_LANDING_PATH` | OFF + legacy role organiser -> `/create-organiser-profile` = NOT FOUND (see GAP F2) | YES |
| 8 | "Continue as" chooser | `/account/continue` | AnimatedRoutes.tsx:216 (not flag-gated), ContinueAs page | Goes straight to the only side, else shows a chooser. With self-serve OFF the route still exists but its targets (`/account`, `/account/o`) bounce home | partly |
| 9a | Dancer side | `/app/*` (`/app/welcome` for a first-time dancer), or `/account/dancer` | AnimatedRoutes.tsx:288, `/finish-profile` AnimatedRoutes.tsx:282 | Profile incomplete -> `/finish-profile` first (dancer-first rule) | `/account/dancer` needs self-serve |
| 9b | Organiser side (R1) | `/account/o` | AnimatedRoutes.tsx:250; `accountHome` in lib/accountRouting.ts:92 | Organiser count > 0 or an open access request -> organiser; else dancer; failed read -> dancer home that links to organiser | needs self-serve |
| 9c | Organiser side (P3) | `/account/p3` | AnimatedRoutes.tsx:264, p3/shell/P3Routes.tsx | NOTHING in sign-in or accountRouting points here. `grep organiserP3` shows only AnimatedRoutes + featureFlags. | needs P3 + self-serve |
| 10 | Not signed in on a guarded page | any guarded route | components/auth/AuthGuard.tsx:41-44 | Redirects to `buildSignInHref(path+search)` (hash dropped); no loop (comment at :28) | no |

Who links to `/auth` today (answer to the brief): GlobalHeader Sign in (flag-gated), AuthPromptModal.tsx:37 (any "log in to do X" prompt), HomeAnnounceBanner (`/auth?mode=signup&userType=dancer`, lib/homeAnnounceBanner.ts:8), AuthGuard, attendanceAuth.ts:60, ProfileEntryRouter.tsx:72, teamPickerModel.ts:218 (e-mail text). So `/auth` is NOT unlinked in code; with `organiserSelfServe` OFF the only missing link is the header button. A person arriving with no returnTo and no mode sees the SIGN-UP tab ("Join the community"), not sign-in.

Sign-in methods in code: e-mail code and e-mail link only (`signInWithOtp`, `verifyOtp`). No password, no Google/OAuth button, apart from a dev-only bypass (Auth.tsx:664-667).

## Journey 2 - INVITE LINK CLAIM

RPCs (live bodies read): `organiser_invite_preview_v1(p_token)` (anon), `redeem_organiser_invite_v1(p_token)` (signed in), plus `bind_organiser_invite_email_v1`, `request_new_invite_v1`. Callers: admin-organisers/adminApi.ts (`previewOrganiserInvite`, `redeemOrganiserInvite`), join/joinApi.ts:17,81.

Preview result: `{}` (bad token shape or unknown -> screen "invalid"), else `status` open|used|revoked|expired, `organiser_name`, `inviter_first_name`, `email_hint`, optional `self_bound`, `person`, `prefill`.

Redeem result codes (live body) and the screen each gets (joinModel.ts:220-242, JoinPage.tsx:223-236, JoinScreens.tsx):

| Server answer | Screen | Next action on screen | OK? |
|---|---|---|---|
| exception `authentication_required` | signs out, back to e-mail step (JoinPage.tsx:235) | enter e-mail | ok |
| `sign_in_required` / `unconfirmed_account` | same as above (`sign_in`) | enter e-mail | `unconfirmed_account` copy ("confirm from the message we sent") is never shown: it is mapped to sign-in, which signs the person OUT. See GAP L3 |
| `email_unproven` | StopScreen "Sign in with a code to continue" JoinScreens.tsx:~215 | button "Sign out and get a code" | ok |
| `email_mismatch` (+ hint) | WrongAccountScreen JoinScreens.tsx:174 | "Sign out and continue", home link | ok |
| `profile_incomplete` (error or reason) | refetch completion -> "About you" step (AboutStep.tsx) | fill name/city/role/photo, then join | ok |
| `rate_limited` | StopScreen "Too many tries" | Try again, home | ok (copy says wait an hour, button retries at once) |
| `used` / `expired` / `revoked` / `invalid` | DeadScreen JoinScreens.tsx:187 | "Ask <inviter> for a new one" (`request_new_invite_v1`) for used/revoked/expired/email_mismatch, home link | ok |
| `team_full` | `refused` -> StopScreen refused -> REDEEM_COPY.team_full (inviteModel.ts:213) | home link only, text says ask the owner | ok but no button to contact (GAP L2) |
| `not_linked` | StopScreen "We couldn't join your profiles automatically" | "Try a different email" (signs out), invite stays open | ok |
| `ok:true` `redeemed` / `already_member` | DoneScreen JoinScreens.tsx:164 | "Open your organiser home" -> `ORG_PATHS.home` = `/account/o` | GAP F1 |
| anything else | `refused` with REDEEM_FALLBACK "Something went wrong" | home link only (no retry for an unknown reason) | minor |

Journey table:

| # | Step | Route | Component file:line | Error / empty / expired | Flag-dependent? |
|---|---|---|---|---|---|
| 1 | Open link | `/invite/:token` (also `/invite`, no token) | AnimatedRoutes.tsx:273-274, InviteRedeemPage.tsx:20-34 | Token not 64 hex chars -> "invalid" without calling the server; lookup fails -> "unreachable" screen with Try again; token hidden from Referer, removed from the address bar once finished (joinApi.ts:102) | no (route is NOT behind any flag) |
| 2 | Checking | same | JoinPage.tsx step `checking` | spinner while preview/auth/profile load | no |
| 3 | Dead link | same | DeadScreen | see table above | no |
| 4 | Signed out: enter e-mail | same | JoinScreens EmailStep, JoinPage.tsx:299-308 | bad e-mail shape/non-ASCII -> inline error; blocked provider (403) -> blocked-domain screen with WhatsApp help; send fails -> network stop | no |
| 5 | Code step | `?step=code&email=` | JoinPage.tsx:309-318 | wrong code stays on boxes; link in the e-mail returns via `/auth/callback?returnTo=/invite/<token>` (joinApi.ts:38-50) and the callback keeps `/invite` as a task returnTo (auth-otp-routing.ts TASK_PATHS) | no |
| 6 | Signed in, wrong e-mail | same | WrongAccountScreen | button signs out and stays on the invite (never a hop to /auth) | no |
| 7 | Signed in, no / incomplete dancer profile | same | AboutStep (`about`), NoProfileScreen (`no_profile`) | no_profile -> WhatsApp help + home only (account with no dancer row; 2 such accounts in prod) | no |
| 8 | Consent tap "Join <page>" | same | JoinStepScreen | all codes above | no |
| 9 | Organiser already has a page | same | server `already_member` | same Done screen (idempotent) | no |
| 10 | Done | same | DoneScreen -> `/account/o` | with self-serve OFF the button lands on `/` | YES (GAP F1) |

Comment/code mismatch: `ORG_PATHS.welcome` (organiser/shell/paths.ts, "Where an accepted invite lands") is never used by the join page. P3 has `youWelcome` too. Done screen goes to the plain home.

## Journey 3 - NEW ORGANISER SIGN-UP

| # | Step | Route | Component file:line | Error / empty / expired | Flag-dependent? |
|---|---|---|---|---|---|
| 1 | Open sign-up | `/auth?mode=signup[&userType=organiser][&returnTo=..]` (also the default with no mode) | Auth.tsx:116, 567-610 (3 steps: roles, name+city+dance role, e-mail) | dance role required, city required (ADD_CITY_MESSAGE help); allowlist/blocked refusal (403) -> SIGNUP_INVITE_ONLY copy "We can't create an account for this email yet ... Message us" | no |
| 2 | Choose roles (Dancer / Organiser / Teacher / DJ) | same | lib/auth-otp-routing.ts SIGNUP_ROLE_OPTIONS | Choosing Organiser grants nothing; stored with `set_my_role_intent_v1` once at callback (AuthCallback.tsx:~75) | no |
| 3 | Code or e-mail link | `/auth/callback` | AuthCallback.tsx | same as journey 1 steps 5-6. Terms accepted at callback (AuthCallback.tsx:242) | no |
| 4 | Landing | callback | `shouldHonorReturnTo` auth-otp-routing.ts:84-92, `landingPathAfterAuth` | Organiser sign-up with a plain browse returnTo -> `/account/o`; with a task returnTo (invite, claim, `/account`, `/app`) -> that. Self-serve OFF -> `/create-organiser-profile` (NOT FOUND, GAP F2) | YES |
| 5 | Dancer profile first | `/finish-profile?returnTo=/account/o` | AnimatedRoutes.tsx:282, DancerProfileGate | dancer-first rule (accountRouting.ts:~108) | self-serve |
| 6 | Organiser home with no page | `/account/o` | OrganiserArea / R1 OnboardingView (organiser/home/onboarding) | claim / request / create (R1 flow, golive/GoLiveFlow.tsx) | self-serve |
| 7 | P3 equivalent | `/account/p3` Home with zero pages -> `Navigate` to `/account/p3/you/add` | p3/screens/HomeScreen.tsx:56, P3Routes.tsx | Add a page: find / claim / ask to join / create (AddPageScreen, you/add) | P3 + self-serve |
| 8 | P3 onboarding | `/account/p3/start[?o=][&at=]` | P3Routes.tsx (OnboardingFlow), OnboardingFlow.tsx: page steps welcome, find, create-name, create-city, contact, contact-phone, whatsapp, cat, link, logo; person steps via PersonFlow (`you/details`); Review (:773+); Live (:832) | pageBlocked() explains each disabled Continue; no page yet on a detail step -> "You don't have a page yet. Find or create one first." (:194) | P3 + self-serve |
| 9 | Entry into /start | only from the Grace banner on P3 Home (GraceBanner.tsx:92) and the in-flow links | | A brand-new organiser is NOT routed to /start by sign-in; they land on Home -> `you/add`, and reach /start only after creating a page | P3 |
| 10 | Go live | Review step | OnboardingFlow.tsx:773-830; pageApi.ts:44-60 `GO_LIVE_NOT_DEPLOYED` stub (`deployed:false`) | Go live disabled with a reason; "You're live" (screen 22) is unreachable. Server `complete_organiser_onboarding_v1` (live body read): owner-only; `incomplete` + `missing[]`; `invalid_state`; draft/rejected -> `pending_review` if `_city_requires_review_p5(city)` else `live`; live/pending_review -> no-op ok | P3 |
| 11 | First screen after | `/account/p3` Home | HomeScreen | pages claimed at sign-in show ClaimNotice | P3 |

Arrival paths into onboarding:
- From an invite: invite -> join -> Done -> `/account/o` (R1 home). Not P3, whatever the P3 flag says.
- From plain sign-up: callback -> `/account/o` -> dancer profile gate -> R1 onboarding. Not P3.
- Into P3 only by typing `/account/p3` (or links inside P3).

Ambassador-city rule (send for review): enforced on the server only (`_city_requires_review_p5`). Prod today: 0 of 319 cities require review. The website go-live is a stub, so nothing in the browser has exercised either outcome (`review:true` -> "sent for review" copy exists in `reviewCopy`, not walked on prod data).

## Prod shapes (read-only counts, 2026-10-29)

| Shape | Count |
|---|---|
| Organiser pages by lifecycle | live 49 (no other state) |
| Live pages with an owner / without | 9 / 40 |
| Invites: open / used / expired / withdrawn | 2 / 4 / 3 / 1 |
| Invites bound to a person profile / page invites | 1 / 9 |
| Accounts with / without a dancer profile row | 40 / 2 |
| Accounts that own a page / do not | 12 / 30 |
| Cities requiring review of a new page | 0 of 319 |

Meaning: almost every real person who signs in is a dancer-only account (30 of 42), most pages are unowned claim targets (40), and the "draft / pending_review / rejected" states the P3 onboarding was designed for do not exist in prod yet. "Owner count (12) is larger than owner-page count (9)" because some people own several or non-live-state rows; not investigated.

## GAPS

### FIX FIRST

- **F1. Invite Done button is a dead end when `organiserSelfServe` is OFF.** JoinScreens.tsx:169 links to `/account/o`; AnimatedRoutes.tsx:250 redirects it to `/`. The person just became an owner and lands on the homepage with no sign it worked. Fix: when the flag is off show a "You're on the team" end state with a plain next step, or link to the public organiser page.
- **F2. Legacy landing `/create-organiser-profile` is a 404.** `landingPathAfterAuth` (auth-otp-routing.ts, LEGACY_ROLE_ROUTES) and `ProfileEntryFlow.tsx:57`, `ProfileEntryRouter.tsx:16`, `GetListedHoloCta.tsx:5`, `VendorDashboard.tsx:44`, `OrganiserDashboard.tsx:94` still point at it; no route exists. Hits an organiser/videographer sign-up with the flag OFF, and the "Get listed" call-to-action wherever it is rendered. Fix: send to `/` or to the WhatsApp/get-listed page; remove dead links.
- **F3. Go live is not wired.** pageApi.ts:44 stub; `complete_organiser_onboarding_v1` is called nowhere in `src/`. P3 onboarding can never finish, and the Live screen is unreachable. Wire it and handle `incomplete`, `invalid_state`, `not_found` and `review:true`.
- **F4. Sign-in never leads to P3.** accountRouting.ts `accountHome` and `landingPathAfterAuth` only know `/account/o` and `/account/continue`. When `organiserP3` is turned on, organisers still sign in to the old area. Decide the switch (one place) before turning P3 on.
- **F5. Sign-in with the flag OFF has no visible entry.** Header Sign in needs `organiserSelfServe` (GlobalHeader.tsx:70). If the flag is OFF in prod, a returning organiser has no button on the homepage; they must know the URL. Confirm the Vercel value (not verified here).

### FIX LATER

- **L1. `/auth` with no `mode` shows SIGN-UP** (Auth.tsx:116). A person following a bare `/auth` link meant to sign in gets "Join the community". Tab is one tap away; a default of sign-in is safer for returning users.
- **L2. `team_full` has no way to contact anyone.** Copy says "ask the page owner ... or the Bachata Calendar team" but the screen only has a home link. Add the WhatsApp help link used on other stop screens.
- **L3. `unconfirmed_account` is never shown.** joinModel.ts:239 maps it to `sign_in`, which signs the person out, discarding the specific "confirm your account first" copy in REDEEM_COPY. Rare (e-mail-code sign-in confirms the address).
- **L4. Unknown redeem reason has no retry** (refused -> fallback "Something went wrong" with only a home link).
- **L5. `ORG_PATHS.welcome` ("where an accepted invite lands") is unused.** Done goes to plain home; the second-page welcome described in paths.ts never happens.
- **L6. `rate_limited` button retries immediately** although copy says wait an hour; it will just fail again.
- **L7. A brand-new P3 organiser reaches `/start` only by an extra hop** (Home -> you/add -> create -> start?). Consider routing a no-page organiser straight into the Welcome of `/start`.
- **L8. `/account/continue`, `/account/settings*`, `/account/deleted`, `/account/restore` are not flag-gated** (AnimatedRoutes.tsx:216-232) while `/account` is. With the flag OFF they still work, but ContinueAs points at gated targets.
- **L9. Ambassador-city review outcome is unproven in the browser** (0 cities require it today). Needs a walk before any city is given an ambassador.
- **L10. DB flag `organiser_onboarding_gate` is OFF and the website never reads it.** When it is switched ON, organisers with incomplete onboarding will have event writes refused; no website screen explains that refusal. Must be paired with F3.

## Not verified

- Production Vercel values of `organiserSelfServe`, `organiserP3`, `organiserTicketing` (not readable here). Every flag-dependent row is stated for both values.
- No browser walk at 390x844 was done (read-only audit, no running app). Copy and next-actions were judged from source.
- The `ContinueAs`, `Account`, `OrganiserArea`/R1 OnboardingView and `AddPageScreen` bodies were read only at the routing level, not line by line.
- `bind_organiser_invite_email_v1` and `request_new_invite_v1` live bodies were not read; their statuses are taken from `joinModel.ts`.
- The "12 vs 9" owner count difference was not investigated.

## Handover

Done: all three journeys mapped, RPC bodies read, prod shapes counted. Left: nothing required. Next: queue F1-F5 as separate PRs (F2 and F1 are small and flag-independent; F3 needs a design call on the `review:true` copy; F4 needs an owner decision on when P3 becomes the default).
