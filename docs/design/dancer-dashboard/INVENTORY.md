# Dancer dashboard: INVENTORY (written before any drawing)

Brief: `docs/briefs/profile-dash-dancer-designs.md` (admin #1533, parent #1531). Design only.
Read 2026-11-12 from `origin/main` @ cdbf2c4 plus a read-only prod count survey.

Status codes used in the last column: **D** = on the dashboard first screen, **R** = reached in one tap (Edit / Me / Options / Page),
**X** = deliberately removed by the brief (no page-view tiles, charts, enquiries, saves, weekly summary), **G** = GAP (explained below).

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

## GAPs

- **G-1** `erase_requested_at` is always null in release 1a (types.ts:57): nothing to show.
- **G-2** The claim is AUTOMATIC today (claimMyDancerProfile.ts:5, "owner decision: AUTOMATIC, no click"). The brief wants a "Claim your page" button on an unclaimed match. Designed as a button for the case the automatic claim did not fire (`ambiguous`, `email_unproven`) or the owner changes the decision; **needs an owner call and a server contract for a click-claim**.
- **G-3** Partner tile and lineup people are not specified in the brief; kept one tap away (Home is not the place for them in a calm first screen).
- **G-4** The legacy EditProfile page is superseded by `/app/me/edit`; not drawn.
- **G-5** The brief names `mockup-organiser-area/dashboard/profile.html`; **that file is not in the repo or any remote branch**. Option A adapts the shipped organiser/dancer-app card language (`Card`, `LinkRow`, `da-*` tokens) instead.
- **G-6** **Admin app dancer-profile fields were NOT inventoried**: `bachata-admin-11april` is not attached to this session. Substituted a read-only column list of `public.dancer_profiles` on prod. Columns the dancer cannot edit and the dashboard does not show: gallery_urls, cover_url, slug, email, phone, show_contact_publicly, meta_data, profile_source, created_by, person_entity_id, person_id, instagram_normalized, archived_at, claimed_by. `description` is the legacy bio (EditScreen does not write it).

## Prod shape survey (read-only, counts only, 2026-11-12, `dancer_profiles`, not archived)

183 profiles: 169 unclaimed (35 of those hold an email), 14 claimed (11 complete, 3 incomplete), 0 paused, 0 claimed stubs.
A brand-new stub only exists between sign-up and the first save, so D1 is drawn from the code shape (strength 0%, next_step first_name), not a row.

## COVERAGE COUNT

**62 inventory items. Shown on the dashboard first screen (D): 29. One tap away (R): 30. Removed by the brief (X): 1 (#35 views tile; #36 keeps only Nights attended, #49 views card stays out of the dashboard). GAP with no design (G): 2 (#27, #55).**
29 + 30 + 1 + 2 = 62. Inventory items shown / total = 29 / 62 on screen, 59 / 62 reachable. GAPs explained: G-1 to G-6 above (G-2, G-5 and G-6 are not items: they are a design decision, a missing file and a missing repo).
