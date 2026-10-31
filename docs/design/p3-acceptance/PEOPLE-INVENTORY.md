# P3 acceptance: people inventory (round 3, derived from the data)

Step 1 of `docs/briefs/p3-acceptance-contract-r3.md`. The question: what happens when a person who is ALREADY in the system (listed by an admin, imported, a dancer / teacher / DJ / organiser / team row, or already holding an account) comes to join? This file lists every way a person or profile exists in prod (section 1) and every code path that can touch such a row at join time (section 2). Journeys J-i1.. in [CONTRACT.md](CONTRACT.md) are built from these two lists, not from memory of the code.

Read-only survey of prod project `stsdtacfauprzrdebmzg`, 2026-10-30, counts only (no names, no emails). Code at main 472ecde.

## 1. Where a person or profile lives (prod counts)

"Account link" = the column that ties the row to an `auth.users` id. "Email" = a non-blank email stored on the row.

| table | rows | with account link | with email | hidden / archived / merged | created by | notes |
|---|---|---|---|---|---|---|
| `auth.users` | 44 | - | 44 | 0 deleted, 2 banned-until set, 5 email unconfirmed | sign-up | provider `email` only for all 44; 0 users with 2+ identities; 0 duplicate emails (case-insensitive) |
| `person` (the identity row) | 203 | 8 (`auth_user_id` = `claimed_by` on all 8) | 7 (`contact_email`) | 19 archived, 2 merged (`merged_into_id`), 0 inactive | all 203 `created_by` null (admin / import / backfill) | 139 have no surname; 11 exact name collisions (first + surname); 1 email used on 2 rows |
| `dancer_profiles` (persona) | 197 | 8 (`claimed_by`) | 7 | 19 archived / inactive; 0 of them claimed | `profile_source`: admin_create, auto_stub, phase3a_videographer_backfill, null | every row has `person_id`; 20 have an Instagram handle, 0 duplicates by Instagram |
| `person_roles` | 309 (on 195 persons) | via person | - | 32 inactive | backfill | roles: dancing, teaching, djing, performing, filming; **organising: 0** |
| roles per person (active) | 0 roles: 19, 1: 104, **2: 48, 3: 24** | | | | | **23 persons are teacher + DJ + dancer**; 25 teacher + DJ |
| `teacher_role_details` | 21 (21 persons) | via person | - | - | backfill (`legacy_teacher_id`) | |
| `dj_role_details` | 24 (24 persons) | via person | - | - | backfill (`legacy_dj_id`) | legacy `djs` table: 0 rows |
| teacher/DJ persons with NO account | **132** | 0 | **3 of all teacher/DJ persons carry an email** | | | most listed people cannot be matched by email |
| `person_account_links`, `person_profiles` | **0, 0** | | | | | tables exist, unused: there is no multi-account link |
| `person_merge_decisions` / `person_merge_log` | 4 / 0 | | | | admin | decisions: dj/dancer, teacher/dj, teacher/dancer, dancer/dancer, all `merge`; 0 merges logged |
| `profile_claims` (teacher / DJ / dancer claim queue) | 5 | 5 (`user_id`) | 5 | - | public claim form | all 5 `teacher:pending`, oldest **323 days**; their `profile_id` matches **no** `person` and **no** `dancer_profiles` row (orphaned, points at the legacy teacher id); 1 user has 2 claims; 2 of 5 claim emails equal the claimer's account email |
| `dancer_invites` | 0 | | | | | table exists, unused |
| `dancer_area_access` | 1 | 0 | 1 | | admin | email allow-list row with no user yet |
| `member_profiles` | 161 | 0 by `auth_user_id`; 42 share their id with an auth user | - | - | backfill | the team-member identity |
| `organiser_profiles` (pages) | 49 | 10 (`claimed_by`) | 5 (`contact_email`) | 0 (all `live`) | admin_create, self_serve | 0 unclaimed pages whose contact email equals an account email |
| `organiser_claim_emails` | **0** | | | | | G-17 |
| `organiser_team_members` | 114 | 66 `member_profile_id` equal an auth user id | - | 52 inactive | admin | `member_profile_id` also equals a `dancer_profiles` / `person` id on all 114; **49 active rows point at a person with no account** |
| `entity_members` (P3 page roles) | 63 | 63 | - | - | grant RPCs | `organiser:owner`, `organiser:manager`; **10 users here have no `person` row** |
| `organiser_invites` | 11 | 4 used | 4 | 2 open, 4 used, 4 expired, 1 revoked | owner / admin | `bound_via` self or null; 1 tied to a `person_profile_id`; 0 used by an account whose email differs from the invite email |
| `organiser_invite_queue`, `organiser_invite_requests`, `organiser_claim_reviews`, `signup_access_requests`, `series_organiser_invites`, `organiser_self_start_v1_meta` | **0 each** | | | | | paths exist, no prod data: seed-only |
| `account_erase_requests` | 0 | | | | | hidden / restore states are seed-only |
| `videographers` / `vendors` | 2 / 2 | 0 / 0 | 0 / 0 | 0 | admin_create | no claim path known; listed, never joinable |
| `venues` | 68 | `user_id` on all 68 but only 3 distinct users | 6 | `publish_state`: draft, dancer_ready, published | admin | venue contact is not a person row; `user_id` is the admin who created it |
| `guest_dancer_profiles`, `vendor_team_members`, `djs` | 0 each | | | | | dead tables |

### What the data says (the cases the journeys must cover)

- D1. **Most listed people have no email.** 132 teacher/DJ persons have no account, and only 3 teacher/DJ persons (7 persons overall) carry an email. Auto-matching by email can reach at most a handful; the rest need a name/claim path. (GAP G-28.)
- D2. **One email in prod already matches an unlinked person** (1 of 2 person emails that equal an account email). That person signed up and was never linked: the live case for J-i1.
- D3. **Multi-role is the norm for teachers and DJs.** 72 persons have 2+ active roles; 23 are teacher + DJ + dancer. One person row carries all roles, so the join must produce ONE account and one You area (R2).
- D4. **Two identity systems, joined by shared ids.** Team rows point at `member_profiles` / `person` / `dancer_profiles` by the same id; P3 roles live in `entity_members` (by auth user). 49 active team rows belong to people with no account, and 10 P3 role holders have no person row.
- D5. **The claim queue is stuck.** 5 pending teacher claims, up to 323 days old, point at ids that no longer exist after the person/persona backfill. Nobody can approve them. (G-30.)
- D6. **Duplicates exist and merge is admin-only.** 11 name collisions, 1 shared email, 139 first-name-only persons, 4 merge decisions recorded, 2 persons already merged.
- D7. **No account has two sign-in methods.** All 44 accounts are email-only, one identity each, no duplicate emails. "Signs in with another method" only arises if Google/Apple sign-in is added; today it means OTP code vs magic link on the same account.
- D8. **Many paths have zero prod rows** (claim emails, invite queue, access requests, claim reviews, series co-organiser invites, erase requests). Their journeys need seeds; prod gives no evidence they work.

## 2. Entry paths that can touch an existing person row

Code at main 472ecde. SQL bodies live in the admin repo, so server-side matching rules below come from client comments and the outcome codes the client handles; each is marked (server, unread) where that matters. Ids E19-E26 are added to [INVENTORY.md](INVENTORY.md) section B so the Coverage table counts them.

| id | path | what it matches on | what it writes / calls | outcomes the client handles | file:line |
|---|---|---|---|---|---|
| E19 | **Dancer persona claim at every sign-in** (link and typed code) | the ONE live, unlinked admin-made `dancer_profiles` row whose `email` equals the account's proven email (server, unread) | `claim_my_dancer_profile_v1` | `linked`, `already_linked`, `no_match`, `ambiguous`, `email_unproven`, `not_applicable`; error or 4 s timeout -> `unavailable` | `src/lib/claimMyDancerProfile.ts:8-49`; `src/pages/AuthCallback.tsx:197`; `src/components/auth/AuthStepper.tsx:151` |
| E20 | **"Already listed?" step** | nothing: no search by email, name or Instagram | nothing; WhatsApp link "Ask us to link your profile" + Continue | shown only when Teacher or DJ was ticked AND E19 said `no_match`; not after `linked`, `ambiguous`, `unavailable`; **no yes / no / not sure answer exists** | `src/lib/auth-otp-routing.ts:316-325`; `src/pages/AuthCallback.tsx:238, 477-499` |
| E21 | **Typed-code sign-in (AuthStepper)** vs emailed link (AuthCallback) | same claims as the link path | E19 then E22 | **no deletion/restore check and no E20 step** on this path; the link path has both | `src/components/auth/AuthStepper.tsx:145-204` vs `src/pages/AuthCallback.tsx:186-417` |
| E22 | **Organiser page auto-claim at sign-in** | pages an admin recorded this email against (`organiser_claim_emails`, 0 rows) or an invite (`via: claim_email / invite`) (server, unread) | `claim_my_organisers_v1` | a page already claimed returns an empty list, which the client cannot tell from "nothing to claim"; undo is a WhatsApp "Not you? Tell us" link | `src/lib/claimMyOrganisers.ts:6-18, 83-107`; `AuthCallback.tsx:218` |
| E10 (r1) | Organiser claim from the public page | page's private contact email = proven mailbox | `organiser_claim_hints_v1`, `claim_organiser_v1`; on mismatch `request_organiser_access_v1` | `already_claimed` treated as stale; hints `email_differs` / `no_email` | `src/modules/organiser/shared/components/PublicClaimCard.tsx:72, 237, 295-341` |
| E23 | **Teacher / DJ / dancer claim queue** (`profile_claims`) | admin reads claim name / email / phone by hand | a `profile_claims` row; no client writer found on main and **no public claim path for dancer, teacher, DJ, videographer or venue profiles** | 5 prod rows, all pending, orphaned ids (D5) | no `src/` caller (agent sweep); table only |
| E11 (r1) | Team invite accept `/invite/:token` | invite email must equal the signed-in email (`email_mismatch` -> wrong-account screen) | `bind_organiser_invite_email_v1`, `redeem_organiser_invite_v1` | `wrong_account`, `email_unproven`, `not_linked` (person-bound invite whose E19 said `no_match` / `ambiguous`: no seat), used / expired / revoked / invalid | `src/modules/admin-organisers/join/joinModel.ts:219-240`; `JoinPage.tsx:157-169, 210-221, 254` |
| E24 | **Owner adds a team member** | by email (`organiser_team_set_member_v1`), by name over confirmed accounts only (`organiser_team_search_people_v1`), or by profile id | team row / `entity_members` | a listed person with no account cannot be found by the name search | `src/modules/organiser/shared/teamRpcApi.ts:23-50` |
| E25 | **Admin duplicate check and join** | admin compares two people | `check_invitee_duplicates_v1`, `admin_join_duplicate_people_v1` (dry run + real), `admin_dismiss_invitee_duplicate_v1`, `admin_search_people_v1` | admin only; **no merge handling at sign-in**; `merged_into` only in generated types | `src/modules/admin-organisers/duplicates/duplicatesApi.ts:20-48`; `invitePersonApi.ts:47` |
| E26 | **Deleted account signs in** | `my_account_deletion_status_v1` | restore screen, `my_account_restore_v1` (may answer `admin_archived`) | runs AFTER the dancer claim (E19) and BEFORE the organiser claim (E22), link path only (E21) | `src/lib/accountDeletion.ts:47-91`; `AuthCallback.tsx:197-218` |
| - | Vendor auto-claim | vendor leader / team dancer id | `claim_vendor_profile_for_current_user` | 2 vendors, 0 linked | `src/hooks/useUserIds.tsx:154` |
| - | Sign-up stub | DB trigger on new `auth.users` creates the account's own row; `_my_dancer_profile_id_v1` prefers the linked admin profile | trigger (server) | blank fields filled from sign-up via `save_my_dancer_profile_v1` only where empty | `src/lib/myPersona.ts:12-18`; `AuthCallback.tsx:323-390` |
| - | Sign-in refuses unknown email | `shouldCreateUser:false` -> `otp_disabled`; sign-up can be refused by an allow-list hook | - | - | `src/lib/auth-otp-routing.ts:54-76` |

### What the code says

- C1. **Matching is by exact proven email only.** No path matches on name, Instagram or phone. With D1 (3 of the teacher/DJ persons carry an email), almost every listed teacher or DJ falls through to E20, which is a WhatsApp message to an admin.
- C2. **There is no account linking.** Email OTP is the only method; no OAuth, no `linkIdentity`. A person who signs up with a second email gets a second account with its own stub (D7: no such pair in prod today, but nothing prevents it). `person_account_links` is empty.
- C3. **"Already claimed" is silent** at sign-in (E22) and on the dancer claim it is `already_linked` with no copy for "someone else has your profile".
- C4. **Two sign-in paths do different things** (E21): only the link path checks deletion and shows "Already listed?".
- C5. **The persona claim runs before the deletion check** (E26), so a deleted account's sign-in can link a profile before it is told it is deleted.
