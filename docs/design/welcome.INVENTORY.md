# INVENTORY: Welcome / find, claim or create your page (dancer, organiser, teacher, DJ)

Written 2026-11-09 by website-50 from a read-only sweep. Website = main at 893163504 (#1512). Admin refs are from local `origin/main` (d3051906 at writing; re-checked 2026-11-10 against fetched 6cf7726d, no named RPC changed). The admin working tree is 323 commits behind, so do not read it. No DB access made. Anything not traced is marked NOT FOUND or NOT VERIFIED.

## A. Website, signed-in app (paths from repo root)

| # | Screen / piece | file:line | States and exits |
|---|---|---|---|
| A1 | AddPageScreen (P3 `/account/p3/you/add`, title Welcome when no page, else Add a page) | src/modules/organiser/p3/you/AddPageScreen.tsx:19-57 | no user=null (30); loading (40); error + Retry (42-46); ready (48-57) |
| A2 | Route table | src/modules/organiser/p3/shell/P3Routes.tsx:107 | youAdd |
| A3 | P3 Home sends a login with no pages to `start` | src/modules/organiser/p3/screens/HomeScreen.tsx:62 | OnboardingFlow, not AddPageScreen |
| A4 | R1 mount `/account/o` | src/modules/organiser/home/index.tsx:131 | |
| A5 | Dancer home panel | src/components/account/OrganiserOnboardingPanel.tsx | |
| A6 | OnboardingView (find / claim / ask / create) | src/modules/organiser/home/onboarding/OnboardingView.tsx:131-256 | steps strip (first run), done banner, search (2+ chars, 250 ms), searching, error/offline Retry, no match -> create link, result rows by hint, Waiting card, Declined card, "Just here to dance?" link, dancer gate (56-64) |
| A7 | Hint to screen map | .../claimStates.ts:46-54 | yours=Go to Home; managed / email_differs / no_email / unknown=Ask to join; email_matches=Claim it |
| A8 | OrganiserSheet: gate, yours, claim, request, create | .../OrganiserSheet.tsx:106-278 | gate lists missing fields + Finish your profile; claim with EmailCodeProof; refusal next=request_access flips to request, next=finish_profile navigates; request note 500 chars |
| A9 | NewPageFlow (name then city) | src/modules/organiser/flows/newpage/NewPageFlow.tsx:17-258 | refusals: name_taken, cap, invite (CannotCreate), other |
| A10 | Create refusal copy / invite copy | .../newpage/cannotCreate.ts; src/modules/organiser/shared/selfServeErrors.ts:27 | |
| A11 | Declined / already-asked text | .../onboarding/onboardingModel.ts:35-77 | resend cooldown 30 s (45) |
| A12 | Profile gate | .../onboarding/profileGate.ts:18,31,41-43 | tap gate |
| A13 | Dancer4 flow (first name, city, role, photo) | .../onboarding/dancer4/Dancer4Flow.tsx:93-337; dancer4Model.ts:10-34; dancer4Api.ts:21 | Back/Next/Finish, disabled reason (260), save failed (255), finalising Try again, city not found -> city_requests write, prefill from invite |
| A14 | /finish-profile | src/pages/FinishProfile.tsx:120-260 | loading, error, done, no_profile, legacy form |
| A15 | golive flow | .../onboarding/golive/GoLiveFlow.tsx:233-289; goLiveModel.ts:101 | load error, stuck 8 s, bridge, question, roles, done |
| A16 | golive role question (teacher/DJ sidecar only) | .../golive/RoleQuestionScreen.tsx:22-73; roleQuestion.ts:34,92-103 | answerDoYou then save_my_role_v1; asked only with seriesId |
| A17 | P3 OnboardingFlow (welcome, find, create-name, create-city, contact, whatsapp, cat, link, logo, person, review, live, asked, elsewhere) | src/modules/organiser/p3/onboarding/OnboardingFlow.tsx:201-1095 | loading 201, failed 211, no page 237, NoDancerBody 250 |
| A18 | P3 ClaimSheet | OnboardingFlow.tsx:890-954 | asked, claim/ask/go home, refusals turn to Ask to join, reauth link |
| A19 | pageApi / pageModel / personModel | p3/onboarding/pageApi.ts:70-123; pageModel.ts:191-223; personModel.ts:11-31 | create_organiser_profile_v1, claim_organiser_v1, request_organiser_access_v1 |
| A20 | Add a profile card (slice 1c) | src/modules/organiser/switch/AddProfileCard.tsx:46-51; addProfileModel.ts:25-75; switch/index.tsx:124-132 | roles missing only; Not now + Undo (localStorage bc.addProfile.hidden.<userId>, 8 s); null while reads pending / error / none missing; pending organiser request counts as held |
| A21 | Add a profile targets | addProfileModel.ts:75 | organiser=/account/p3/you/add; dancer=/app/welcome; teacher=/account/t; DJ=/account/dj |
| A22 | Teacher/DJ add (NotAddedCard, DoYouSheet) | src/modules/areas/shared/RoleAreaPage.tsx:~74; src/modules/areas/home/DoYouSheet.tsx | Yes / Skip for now; answerDoYou; role on OWN dancer profile only |
| A23 | YouScreen rows | src/modules/organiser/p3/you/youRows.ts:56-68 | Add another page only when pages===1 |
| A24 | ClaimNotice | src/modules/organiser/home/ClaimNotice.tsx; home/index.tsx:166; HomeScreen.tsx | sessionStorage bc_org_claim_notice_v1; Not you? Tell us |
| A25 | Sign-in claim wiring | src/lib/claimMyOrganisers.ts:15-132; claimSignInLanding.tsx:17-28; src/pages/AuthCallback.tsx:197,218,238,477-496; src/lib/auth-otp-routing.ts:303-333; AuthStepper.tsx | claim 4 s timeout, failures = empty; Already listed? screen (WhatsApp only) for Teacher/DJ sign-up with no_match |
| A26 | Invite path /invite/:token | src/components/AnimatedRoutes.tsx:292; InviteRedeemPage, JoinPage, JoinScreens, joinApi.ts | roles written dancer + organiser |
| A27 | Suggest a teacher (not a claim) | src/components/ListingRequestForm.tsx:53 | submit_listing_request_v1 |

## B. Public pages

| # | Page | file:line | Claim card? |
|---|---|---|---|
| B1 | Organiser | src/pages/OrganiserProfile.tsx:1154 | YES (ManagedBadge + PublicClaimCard) |
| B2 | Teacher | src/pages/TeacherProfile.tsx:130 | NOT FOUND |
| B3 | DJ | src/pages/DJProfile.tsx:151 | NOT FOUND |
| B4 | Dancer | src/pages/DancerProfile.tsx, PublicProfile.tsx | NOT FOUND |
| B5 | PublicClaimCard states | src/modules/organiser/shared/components/PublicClaimCard.tsx:130-338 | hidden, signed out Sign in to claim, claim, request, EmailCodeProof, error, done, stale refusal, dancer-first gate |
| B6 | Claim-intent marker | .../shared/publicClaim.ts:67-79; PublicClaimCard.tsx:~120,192-196 | steps wait / drop / claim / prove; ?claim=1 survives sign-in via returnTo |

## C. Admin (origin/main refs)

Screens: AccessRequestsPanel (components/admin/moderation/AccessRequestsPanel.tsx:14,115; mounted ModerationQueueAdmin.tsx:273), AmbassadorsAdmin (:285), OrganiserStudio (Access tab 448), MergeReviewAdmin (467/488/538; App.tsx:2004), PersonView (archive 583; DancerInviteSection 980), lib/profileRemovalService.ts (DJ delete blocked by line-ups 175-201), lib/moderationRpc.ts. NOT FOUND: admin screen for organiser_interim_seats itself.

RPCs (migration file:line; grants):
| RPC | Defined | Grant |
|---|---|---|
| claim_organiser_v1 | 20261111100000_organiser_onboarding_requires_complete_dancer_profile_v1.sql:236 | authenticated, service_role |
| request_organiser_access_v1 | 20270315110000_organiser_interim_seats_v1.sql:320 (30-day declined_recently, request_already_open, 10 open cap) | authenticated, service_role |
| list_ / resolve_organiser_access_request_v1 | 20270320110000_...instagram_link_v1.sql:867 / 20270315110000_...:216 | authenticated, service_role |
| create_organiser_profile_v1 | 20270306080000_ambassador_a0b_review_gate_v1.sql:137 | authenticated, service_role |
| organiser_start_v1, organiser_lookalikes_v1 | 20270304070000:196, 20270304060000:115 | authenticated, service_role (DB only, Website never calls them) |
| organiser_claim_hints_v1 | 20261129450000_people_a_db2_auto_claim_v1.sql:139 | authenticated, service_role |
| claim_my_organisers_v1 | 20261203170000_bind_organiser_invite_email_v1.sql:351 | authenticated, service_role |
| claim_my_dancer_profile_v1(p_instagram) | 20270320110000_...:517 | authenticated, service_role (Website calls zero-arg form only, src/lib/claimMyDancerProfile.ts:27) |
| organiser_invite_preview_v1, bind_organiser_invite_email_v1 | 20261207420000:35, 20261203170000:160 | anon, authenticated, service_role |
| redeem_organiser_invite_v1 | 20270315110000:598 | authenticated, service_role |
| admin invite / revoke / list / claim email | 20261201220000:113, 20261110120000:250/280, 20261110020000:170 | authenticated, service_role |
| my_roles_v1, set_my_role_intent_v1, set_my_role_declined_v1, my_role_intent_v1, save_my_role_v1, my_role_details_v1 | 20261129790000:26; 20261129760000:424/463/403/327; 20270307000000:117 | authenticated |
| organiser_onboarding_status_v1, complete_organiser_onboarding_v1 | 20270308000000:178; 20270308010000:157 | authenticated |
| admin_link / unlink account to dancer profile | 20270320130000:100 | authenticated |
| person_merge_candidates_v1, admin_record_merge_decision_v1, check_my_profile_dedup_v1, admin_check_person_instagram_dedup_v1 | 20261109980000:1357/1286/946; baseline:6654 | authenticated (+service_role) |
| admin_archive / unarchive / delete person, admin_delete_dj_v1, admin_delete_organiser, admin_merge_person_entities_v1 | 20261122310000:197/282; baseline; 20261129450000:208 | authenticated, service_role |
| _organiser_create_allowed_v1 (the door) | 20261129860000:44 | service_role only |
| tg_organiser_self_serve_door_v1 | 20261129200000_organiser_door_v1.sql:78 | raises organiser_invite_required |

## D. Facts the contract depends on

- A teacher or DJ "page" is NOT a table: it is a role on the person's own dancer_profiles row (person_roles teaching/djing + teacher_role_details / dj_role_details). Public visibility needs an active person_roles row, name (first_name or display_name), avatar_url, based_city_id, not archived, is_active not false (get_public_teacher_detail_v1, latest body 20270101100000:77: first_name OR display_name, avatar_url, based_city_id; teacher list 20270215010000:109 adds active city; DJ detail 20261120200000:370-418 and list 20261129510000:42 need only active djing role, active, not archived).
- Creating yourself as teacher/DJ: save_my_role_v1 on your own persona (60/hour). Raises no_profile with no persona. There is NO create-another-person-page RPC and NO self-serve picker to claim an existing teacher/DJ profile. Existing-profile links are automatic at sign-in (claim_my_dancer_profile_v1: email, or one Instagram match) or admin-driven.
- Owner answers 2026-11-09 (via lead): a person can create a teacher/DJ page or claim one; a new teacher/DJ page goes LIVE AT ONCE; contactless pages: Ask to join only; one person may hold all four.
- Duplicates today: dancer_profiles unique on instagram_normalized, slug, one account per persona; NO unique on teacher/DJ/organiser name. Organiser name: create_organiser_profile_v1 raises organiser_name_taken (advisory lock) + organiser_lookalikes_v1 (Website unused). Admin: person_merge_candidates_v1 (email, Instagram, name_city), admin_merge_person_entities_v1.
- Rate limits: create organiser 3 per 24 h; access requests 10 open + 30-day re-ask; save_my_role 60/h; lookalikes 20/h; dancer invite 10/day. NOT FOUND on claim_organiser_v1, claim_my_organisers_v1, claim_my_dancer_profile_v1.
- Admin undo: remove member (admin_remove_entity_member_v1, remove_organiser_member_v1), delete organiser, archive/unarchive person (real undo), unlink account from dancer profile. Self-claim undo is only a WhatsApp "Tell us". NOT VERIFIED: admin removal of one self-created teacher/DJ role (admin_unlink_role_from_person_v1, PersonViewRoleTabs.tsx; UI not traced).
- Organiser creation is gated by the invite door, dancer-first profile check and the 3 per 24 h cap; a city with an ambassador makes new organiser pages pending_review (_city_requires_review_p5), London is instant.
- Dead ends found: sign-up Teacher/DJ with no_match shows only a WhatsApp "Ask us to link your profile"; public teacher/DJ/dancer pages have no claim card; interim seats have no admin screen.

## E. Coverage count

Website A: 27 rows. Public B: 6 rows. Admin C: 7 screens + 30 RPC rows. Facts D: 9 groups. Files cited: about 75. NOT FOUND items: 7 (listed above). NOT VERIFIED: 2 (admin per-role removal UI; admin refs not fetched).
Not yet inventoried: the live prod shape survey (counts), the per-screen copy strings, and the admin working-tree vs origin/main drift.

## F. Corrections after review r1 (2026-11-09)
- Organiser access requests have no table of their own: they are a view over `entity_decision_audit` (target_type organiser; action access_requested / access_granted / access_declined) via `_organiser_access_requests_p5()` (defined 20261108220000:82; 20270315110000 only reads it).
- DJ public rules have no name/photo gate today (see D). Duo acts with display_name only are valid teachers.
- Two "claim notices" exist: organiser `ClaimNotice.tsx` (sessionStorage bc_org_claim_notice_v1) + toast `claimSignInLanding.tsx:34`; dancer `src/modules/dancer-app/screens/onboarding/notes.tsx:17`. Both "Not you" links go to WhatsApp. Shared table found: only `CLAIM_COPY` (`claimStates.ts:46-54`), for claim hints.
- A public "Report a problem" WhatsApp link (`ReportProblemLink`, src/lib/contactLinks.tsx:46-62) exists on event (BentoPage.tsx:905) and organiser (OrganiserProfile.tsx:1376) pages only. CORRECTION 2026-11-10: `PUBLIC_LINK_REL` (`noopener nofollow ugc`) exists at src/lib/organiserLinkLabels.ts:71 and is used on organiser pages; teacher/DJ/dancer links lack it.
- `claim_my_dancer_profile_v1` with a handle auto-links one instagram_exact candidate after the email check (20270320110000:583-590); the Website sends zero args.
- `person_roles` has no origin/created_by column (baseline:53047-53055).
- Stub vs linked: the sign-up stub is not refused by the link; only an account already holding a different admin profile is (`already_linked`).
