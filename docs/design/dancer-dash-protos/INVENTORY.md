# Dancer dashboard prototypes: INVENTORY (written before any drawing)

Brief: `docs/briefs/dancer-dash-protos.md` on `brief/dancer-dash-protos` (queue-website#1533, child of #1531). Docs / design only.
Method: rows come from the earlier dancer inventory (`docs/design/dancer-dashboard/INVENTORY-polish.md`); every cited file was
re-opened on main @ 6ae6be6 on 2026-11-12 (nextStep.ts:17-31, SwitcherGate.tsx:8-15, optionsModel.ts:74-109, types.ts:17-49,
claimMyDancerProfile.ts:28-35, accountRouting.ts:350-354). Rows not re-opened line by line (screens/*, AccountSettings, PublicDancerPageV2) carry
the earlier line numbers and may have drifted by a few lines.
Admin-app source: NOT readable (repo outside this session's scope), see G-6.
Status: **D** = drawn on the home screen or its sheets, **R** = reached in one tap (Nights / Me / Options / My page), **X** = removed by the contract
(views tiles, charts, enquiries, saves, weekly summary), **G** = GAP.

## 1. Profile fields (the server shape `MyDancerEdit`, `src/modules/dancer-app/api/types.ts:23-62`; edit controls `screens/edit/EditScreen.tsx`)

| # | Item | Source file:line | Status |
|---|---|---|---|
| 1 | display_name ("Display name", shown on page) | types.ts:26, EditScreen.tsx:279 | R |
| 2 | first_name (required, replace-only) | types.ts:27, EditScreen.tsx:283 | D (checklist) |
| 3 | surname (optional) | types.ts:28, EditScreen.tsx:287 | R |
| 4 | hide_surname_publicly switch | types.ts:29, EditScreen.tsx:72-90,290 | R |
| 5 | based_city_id / city_name | types.ts:30-31, EditScreen.tsx:292 | D (checklist) |
| 6 | dance_role (Leader / Follower / Both) | types.ts:32, nextStep.ts:76, EditScreen.tsx:309 | D (checklist) |
| 7 | nationality | types.ts:33, EditScreen.tsx:318 | R |
| 8 | languages | types.ts:34, EditScreen.tsx:322 | R |
| 9 | bio (280 max, no links) | types.ts:35, EditScreen.tsx:363 | D (checklist) |
| 10 | instagram | types.ts:36, EditScreen.tsx:378 | D (checklist, with 9) |
| 11 | facebook | types.ts:37, EditScreen.tsx:381 | R |
| 12 | website_url | types.ts:38, EditScreen.tsx:384 | R |
| 13 | whatsapp (only for people with another role) | types.ts:40, EditScreen.tsx:390 | R |
| 14 | show_whatsapp_publicly (disabled without a number) | types.ts:41, EditScreen.tsx:394-417 | R |
| 15 | show_going_photo ("Show my photo when I'm going") | types.ts:46, edit/GoingPhotoSwitch.tsx, EditScreen.tsx:427 | R |
| 16 | avatar_url (photo; Add / Change photo) | types.ts:47, EditScreen.tsx:390-398, screens/photo/PhotoScreen.tsx:240 | D (checklist + avatar) |
| 17 | dance_started_year (bands) | types.ts:48, nextStep.ts:86-107, EditScreen.tsx:328 | D (checklist) |
| 18 | favorite_styles | types.ts:49, EditScreen.tsx:341 | D (checklist) |
| 19 | favorite_songs | types.ts:50, EditScreen.tsx:355 | R |
| 20 | achievements | types.ts:51, EditScreen.tsx:359 | R |

## 2. Profile states and server facts

| # | Item | Source | Status |
|---|---|---|---|
| 21 | strength.pct (0-100; 70 = complete) | types.ts:20, MeScreen.tsx:55, HomeScreen.tsx:79-88 | D (as steps done / total, no ring) |
| 22 | strength.next_step / missing, priority order | types.ts:17, nextStep.ts:21-54 | D |
| 23 | complete (= profile_complete_v1; needs first name, city, role, photo) | types.ts:59, nextStep.ts:18 | D (hides checklist) |
| 24 | is_active (paused) | types.ts:55, MeScreen.tsx:27-37, HomeScreen.tsx:111 | D (banner, only when paused) |
| 25 | linked_from_admin ("We have linked your profile" notice) | types.ts:58, HomeScreen.tsx:120-139 | D (one-line note) |
| 26 | other_roles (teaching, djing, organising) | types.ts:53, options/optionsModel.ts:104-105 | R |
| 27 | erase_requested_at (always null in 1a) | types.ts:57 | G-1 |
| 28 | Unclaimed match / claim (`claim_my_dancer_profile_v1`: linked, already_linked, no_match, ambiguous, email_unproven, not_applicable) | src/lib/claimMyDancerProfile.ts:24-34 | D (new "Claim your page" button, see G-2) |
| 29 | no_profile error state ("We can't find a dancer profile") | HomeScreen.tsx:185-197 | D (as the unclaimed shape's fallback) |

## 3. Current Website dancer app screens (`src/modules/dancer-app/screens`)

| # | Item | Source | Status |
|---|---|---|---|
| 30 | Home: greeting + avatar + name | HomeScreen.tsx:103-109 | D |
| 31 | Home: hero night (going) | HomeScreen.tsx:141-147 | R (Nights) |
| 32 | Home: rate-a-level nudge | HomeScreen.tsx:149, home/RateNudge.tsx | R |
| 33 | Home: Profile strength ring row | HomeScreen.tsx:153-161 | D (replaced by checklist card) |
| 34 | Home: Upcoming nights going tile | HomeScreen.tsx:162-168 | D (3-item list, item "Upcoming nights") |
| 35 | Home: views-this-week tile ("People who looked at your page") | numbers: NumbersTiles.tsx:28-32, numbersModel.ts:43 | X |
| 36 | Home: stats strip Going / Nights been to / Levels rated | NumbersTiles.tsx:33-47, numbersModel.ts:100-104 | D (only "Nights attended") |
| 37 | Home: partner tile | home/PartnerTile.tsx | R (G-3) |
| 38 | Home: lineup people | home/LineupPeople.tsx | R (G-3) |
| 39 | Me: avatar, name, role / city line | MeScreen.tsx:40-50 | D |
| 40 | Me: strength bar + next-step line + main button | MeScreen.tsx:52-69 | D |
| 41 | Me: Edit my profile / My page / See my public page (disabled when hidden, with reason) | MeScreen.tsx:71-87 | D (one item) + R |
| 42 | Edit: Save disabled with a visible reason, untouched sends nothing | EditScreen.tsx:434-446, README "Saves are diff-first" | D (rule kept in every option) |
| 43 | Photo screen (camera, library, crop) | PhotoScreen.tsx:283-330 | R |
| 44 | Nights: upcoming and past lists, going state | nights/NightsScreen.tsx:112-160 | R |
| 45 | Onboarding: first name + display name | onboarding/steps.tsx:54-57 | D (new account path) |
| 46 | Onboarding: city, role | steps.tsx:75,102 | D |
| 47 | Onboarding: years, styles (skippable) | onboarding/optional.tsx:9-53 | D |
| 48 | Options rows: Share, My page, Feedback, Install, Help, Your areas, I run events, Terms, Privacy, Sign out | options/optionsModel.ts:93-109 | R |
| 49 | My page: how it looks, page views card, View / Share my page | page/PageScreen.tsx:62-129 | R (views card = X) |
| 50 | Bottom tabs Home / Nights / Me / Options | shell/routes.ts:44-49 | D (kept, 4 tabs) |

## 4. Account settings and old site screens

| # | Item | Source | Status |
|---|---|---|---|
| 51 | Sign out / sign out all devices | pages/AccountSettings.tsx:120,172 | R (Options) |
| 52 | Email address | AccountSettings.tsx:224 | R |
| 53 | Hide your dancer profile | AccountSettings.tsx:298 | R |
| 54 | Your data / Delete account | AccountSettings.tsx:356,360 | R |
| 55 | Legacy EditProfile (city, nationality, sections) | pages/EditProfile.tsx:436-712 | G-4 |
| 56 | Legacy FinishProfile ("Set up your dancer profile" / "Finish your profile") | pages/FinishProfile.tsx:290 | D (this is the copy D1 reuses) |

## 5. Public dancer page (`src/modules/dancer-app/public-page/PublicDancerPageV2.tsx`)

| # | Item | Source | Status |
|---|---|---|---|
| 57 | Portrait: photo, name, role / city line | PublicDancerPageV2.tsx:226-240 | D (preview thumbnail) |
| 58 | Facts row (dancing, level, style), languages | :242-247 | R |
| 59 | Contact links (Instagram, Facebook, website, WhatsApp), empty line | :266-288 | R |
| 60 | Going next list | :173-191 | R |
| 61 | Achievements | :292 | R |
| 62 | Share / copy link | :100-115 | R |

## 6. Profile switch (top right) &mdash; new for this round

| # | Item | Source file:line | Status |
|---|---|---|---|
| 63 | Switch button shows ONLY for a person with 2+ sides (D129) | src/modules/dancer-app/shell/SwitcherGate.tsx:8-15 | D (pill drawn only in the multi-profile frames; single-profile frames show a plain avatar button) |
| 64 | Sheet title "Switch profile" / "Your account" (one side), Close button 44x44 | src/components/account/profiles/ProfileSwitcher.tsx:100-105 | D |
| 65 | Loading line "Loading your profiles&hellip;" and failed line "We could not load your profiles. Close this and try again in a moment." | ProfileSwitcher.tsx:107-116 | R (existing switch sheet, unchanged, not drawn) |
| 66 | Side rows: avatar + title (`sideTitle`) + kind ("Dancer" / "Organiser") + check on the current side | ProfileSwitcher.tsx:118-134, SideAvatar.tsx:6-10 | D |
| 67 | Side kinds are ONLY dancer and organiser | src/lib/accountRouting.ts:352-354 | R (existing switch sheet, unchanged, not drawn) |
| 68 | Teacher / DJ areas + "Your areas" link, loaded with the open sheet | ProfileSwitcher.tsx:17,29,136-140 (`SwitcherAreas`) | R (existing switch sheet, unchanged, not drawn) |
| 69 | Account settings row | ProfileSwitcher.tsx:142-145, accountRouting.ts:72 | D |
| 70 | Sign out with a confirm step ("Sign out?" / "Yes, sign out") | ProfileSwitcher.tsx:146-175 | D |
| 71 | "Run events? Become an organiser" + beta note (the only add-a-side path today) | optionsModel.ts:76-78,104-105 | R (existing switch sheet, unchanged, not drawn) |
| 72 | Hint "You can switch later by tapping your picture, top right." | ContinueAsPage.tsx:28 | R (existing switch sheet, unchanged, not drawn) |

## GAPs

- **G-1** `erase_requested_at` is always null in release 1a (types.ts:57): nothing to show.
- **G-2** Claim is AUTOMATIC at sign-in (claimMyDancerProfile.ts:8, no click, no args). The drawn "Claim your page" / "This is not me" buttons need an owner call and a server contract; today the closest working action is "message us".
- **G-3** Partner tile, lineup people, rate-a-level nudge (#32, #37, #38): not in the contract; one tap away on Nights.
- **G-4** Legacy EditProfile (#55) is superseded by `/app/me/edit`; not drawn.
- **G-6** Admin app dancer-profile screens not inventoried from code (repo not attached here). Substitute: the website server shape `MyDancerEdit` and the prior prod column survey.
- **G-7** DJ is not a profile side (`ProfileSide` is dancer | organiser, accountRouting.ts:350-352). Prototypes show a single Dancer role and the "Account" button (D129: Switch only with 2+ sides), so no DJ side is drawn.
- **G-9 (new)** "Share my page" is drawn DISABLED with a reason until the 4 required steps are done. TODAY the code disables Share only for a hidden profile (optionsModel.ts:70-95, HIDDEN_SHARE_REASON). The incomplete-profile rule is a design proposal, owner call needed.
- **G-10 (new)** "Nights attended" is drawn as a count only when above 0. Definition (going on a past night) is unconfirmed (dash-survey.report.md); prod has 1 linked dancer with any attendance.
- **G-11 (new)** The dashboard-level loading and error states (#74, #75) are not specified by the contract; drawn with an actionable line each.

## Prod shape survey (from existing records, not re-run this session)

From `docs/design/dancer-dashboard/INVENTORY-polish.md` and `docs/briefs/dash-survey.report.md` (read-only, counts only, 2026-11-12): 183 dancer profiles, 169 unclaimed, 14 claimed (0 without photo or city). 7 attendance rows (5 going, 2 interested). So **unclaimed** is the dominant real shape, **complete + nothing planned** the dominant claimed shape; **new** and **partial** exist for fresh sign-ups. Not re-queried this session.

## States added for these prototypes

| # | Item | Source | Status |
|---|---|---|---|
| 73 | Nothing planned / empty plans (what to do: Find events this week) | design (contract: every empty state says what to do) | D |
| 74 | Dashboard loading state with "check your connection" line | design | D |
| 75 | Dashboard error state with Try again and Message us | design | D |
| 76 | Unclaimed shape: match card, Claim, Not me | G-2 | D |
| 77 | Partial shape: 3 of 4 required steps (photo missing) | nextStep.ts:18-29 | D |

## COVERAGE COUNT

Tally of the Status column (`grep '^| [0-9]'`, 77 rows): **D 39, R 35, X 1, G 2** (39 + 35 + 1 + 2 = 77). **Covered (D + R) = 74 / 77**; uncovered with reason: #27 (G-1 always null), #35 (X views tile removed by contract), #55 (G-4 superseded page) (recount command in the PR body). Rows 64-72 (switch sheet) are R: the existing sheet is reached from the top-right button and is not redrawn.
