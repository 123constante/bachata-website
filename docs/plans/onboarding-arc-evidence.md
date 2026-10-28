# Onboarding arc: read-only evidence (2026-10-28)

Companion to [`onboarding-arc.md`](onboarding-arc.md). Everything here was read, never written.
Prod = Supabase project `stsdtacfauprzrdebmzg`, SELECT only, counts only, no personal data.
Website = `123constante/bachata-website` main at `a281a3e` (the first code sweep ran on a checkout 15 commits behind; every row in E5 marked from it was re-checked on `a281a3e`). Admin repo source was NOT readable from
this cloud session: admin facts come from prod (`pg_proc`, `supabase_migrations.schema_migrations`)
and from the source plan (`briefs/onboarding-arc-source-plan.md`, branch `brief/p3-onboarding-arc-plan`).

## E1. Functions that matter (pg_proc, public schema)

| Function | Args -> result | Definer | search_path | prosrc md5 | len |
|---|---|---|---|---|---|
| `series_command_p5` | `p_envelope jsonb -> jsonb` | yes | public, pg_catalog | `3d04937509fec472c3b7b395acb188c3` | 584 |
| `occurrence_command_p5` | `p_envelope jsonb -> jsonb` | yes | public, pg_catalog | `3ca6173c9291be99e23f57902c6932c2` | 600 |
| `_require_complete_dancer_profile_v1` | `() -> void` | yes | public, pg_catalog | `5231706882675ef813ea8e37e41a6f07` | 1887 |
| `profile_complete_v1` | `p_person uuid -> boolean` | no (invoker) | `""` | `ea415a850ce04a11165c5de2e1063c37` | 554 |
| `check_organiser_profile_gate_v1` | `() -> jsonb` | no | public, pg_catalog | `43ddeeab614a201ad0d5c12df7b59faf` | 7018 |
| `save_my_dancer_profile_v1` | `p_payload jsonb -> jsonb` | yes | public, pg_catalog, pg_temp | `9e74002d65c26804e995f2b02d051799` | 8139 |
| `organiser_profile_update_p5_v1` | `p_organiser_id uuid, p_patch jsonb -> jsonb` | yes | public, pg_catalog | `0d994052ac9b49ac3e9c5a168edd9bdf` | 15320 |
| `submit_organiser_profile_v1` | `p_organiser_id uuid -> jsonb` | yes | public, pg_catalog | `c757e9865eab01f174973a107a15aed6` | 1680 |
| `tg_enforce_lifecycle_transition` | trigger | yes | public, auth, pg_catalog | `60ad253d5eb53184c9b81bfc6e50a13f` | 4235 |
| `redeem_organiser_invite_v1` | `p_token text -> jsonb` | yes | public, extensions, pg_catalog | `2bb799846fa8a139377702dc89b57ea1` | 11888 |
| `is_feature_enabled` | `p_key text -> boolean` | - | - | body: `COALESCE((SELECT enabled FROM app_feature_flags WHERE flag_key = p_key), false)` | - |

Not present yet (expected, nothing built): `organiser_onboarding_status_v1`, `_require_onboarding_complete_v1`,
`save_my_teacher_details_v1`, `save_my_dj_details_v1`, `save_onboarding_answers_v1`,
`complete_organiser_onboarding_v1`, `check_organiser_onboarding_gate_v1`.

### E1a. The two command RPCs are thin dispatchers

Both bodies are: read `command.kind`, check the prefix (`series.` / `occurrence.`), then
`RETURN public.apply_aggregate_write_p5(p_envelope)`, with `EXCEPTION WHEN OTHERS` that calls
`_command_audit_refusal_p5(...)` and re-raises. Consequence: a gate `PERFORM`ed at the top of the
`BEGIN` block is inside the handler, so every refusal is audited as a `failed` row for free.

### E1b. Other client-executable functions that reach `apply_aggregate_write_p5` (GAP in source plan)

`prosrc ILIKE '%apply_aggregate_write_p5%'`, with `has_function_privilege('authenticated', ...)`:

| Function | authenticated can execute |
|---|---|
| `series_command_p5`, `occurrence_command_p5` | yes |
| `organiser_save_event_v1(p_event_id uuid, p_payload jsonb)` | yes |
| `organiser_save_festival_v1(p_event_id uuid, p_payload jsonb)` | yes |
| `organiser_set_occurrence_programme_v1(p_occurrence_id uuid, p_expected_version int, p_sessions jsonb)` | yes |
| `organiser_undo_last_change_v1(p_series_id uuid)` | yes |
| `organiser_get_occurrence_programme_v1` (read) | yes |
| `admin_bulk_occurrence_command_p5`, `admin_collapse_series_to_one_off_p5`, `admin_link_event_to_organiser_v1`, `admin_set_series_lifecycle_v1`, `admin_unlink_event_from_organiser_v1`, `admin_unpublish_event_v1` | yes (admin-checked inside) |
| `apply_aggregate_write_p5`, `_cmd_*_p5` | no (internal) |

So gating only the two wrappers leaves four organiser write doors open. `pg_stat_user_functions`
returned no rows (function tracking off), so call volume per door is UNVERIFIED.

### E1c. Command kinds in use (regexp over `%p5%` bodies)

series: `add_date, apply_forward_from, cancel_one_off, collapse_to_one_off, duplicate, end_run,
remove_date, set_group_chat, set_lifecycle, set_organisers, set_program, set_recurrence,
set_session_forward, skip_date, stop_repeating, unskip_date, upsert`.
occurrence: `bulk_cancel, bulk_shift, cancel, move_date, set_override, set_time`.

### E1d. Lifecycle trigger (changed since the source plan was written)

Migrations that touched `tg_enforce_lifecycle_transition` most recently: `20270306040000
ambassador_a0a_moderation_v1`, `20270306080000 ambassador_a0b_review_gate_v1`. Current organiser
arms for a non-admin: owner/manager `draft->pending_review`, `draft->archived`, `rejected->draft|pending_review`,
`live->paused|archived`, `paused->live|archived`; ambassador `pending_review->live|rejected` (never on
a target they are party to). `pending_review` now REQUIRES a city (`city_required_for_review`).
There is NO organiser `draft->live` arm for owners (series have one: `_owner_series_go_live_ready_p5`).
Admin / service: any transition (`_self_serve_is_admin()`).

Last migrations naming these bodies: `apply_aggregate_write_p5` in `20261028194224
p3_a2_r1_owner_repeat_rules_v1` (TODAY, P3); `save_my_dancer_profile_v1` in `20260721030000`.
No migration in the ledger re-creates `series_command_p5` / `occurrence_command_p5` by
`CREATE ... FUNCTION` text match (the source plan cites 20261109260000 / 20261109390000; not
re-matched here, the regexp may miss `CREATE OR REPLACE` with different spacing: UNVERIFIED).

Ledger head: `20270306120000 og_bake_bypass_header_v1` (the source plan's RUN STATE said the fix
was to rename it back to `20261028071502`; the ledger now shows the 2027 key. CHANGED, owner of
#1096 to confirm).

## E2. Flags and settings that already exist

| Table | Shape | Rows |
|---|---|---|
| `app_feature_flags` | `flag_key, enabled, description, updated_at, updated_by` | 2 (`FF_DB_SELF_SERVE_RLS=false`, `dancer_area_open=true`) |
| `feature_flags` | `flag_name, enabled, description, updated_at` | 2 (legacy) |
| `admin_app_settings` | `key, value jsonb, updated_at, updated_by` | 2 |
| `organiser_front_door_flags` | per-organiser `run_by_us` | 0 |

Readers/writers: `is_feature_enabled(p_key)`, `admin_set_feature_flag_v1`, `dancer_area_gate_v1`,
`_dancer_area_allowed_v1`, `admin_dancer_area_set_open_v1`, `check_dancer_area_contract_v1`.
`dancer_area_open` is the precedent for a server-checked, admin-switched gate. Decision D7 resolves to
`app_feature_flags.flag_key = 'organiser_onboarding_gate'`.

## E3. Shape survey (counts only)

Access is `entity_members` (`entity_type='organiser'`, `member_role` in use: `owner`, `manager`).
`organiser_team_members` (Leader/Member) is the PUBLIC team list, not access, and is not used by the gate.

| Shape | Count |
|---|---|
| Organisers by lifecycle | live 49, draft 0, pending_review 0, rejected 0, paused 0, archived 0 (the 3 ZZ test orgs were deleted today) |
| Live organisers with logo / link (web or IG) / city / category / About | 48 / 47 / 49 / 47 / 1 |
| Organisers with at least one `entity_members` row | 48 |
| Distinct people with an organiser membership | 12 (2 admins, 10 not) |
| Membership rows | 61 (one admin account holds 50) |
| Non-admin people: memberships each | exactly 1 |
| Non-admin people reach N distinct organisers | 6 (all live, all 6 pass the organiser part: logo, link, city, one of the five categories) |
| Of those 6 organisers, phone held | 5 |
| No dancer persona | 1 |
| Pass today's 4-field dancer rule | 10 of 12 |
| Pass the new 7-field dancer rule | 5 of 12 (4 of 10 non-admins) |
| Missing nationality / languages / Instagram | 6 / 5 / 6 of 12 |
| Private sign-in email not on dancer record | 11 of 12 |
| Have a `teacher_role_details` row / `dj_role_details` row | 2 / 3 of 12 |
| Teaches / DJs answered in `account_role_intent` (roles or declined), non-admins | 1 / 2 of 10 (4 of 10 have an intent row; 10 rows in the whole table) |
| `teacher_role_details` rows with styles AND years | 0 of 21 |
| `dj_role_details` rows with genres | 1 of 23 |
| Invites open / used | 2 / 4 |
| `organiser_stripe_accounts` rows / charges_enabled | 1 / 1 |

**Day-one lock if the gate were switched on today:** all 10 non-admin members, not "7 of 12".
6 fail the dancer part; of the other 4, at most 1 has answered both "Do you teach?" and "Do you DJ?".
Admins (2) are exempt. The organiser part locks nobody (6 of 6 complete).

## E4. Ticketing surface in prod (for the hand-off)

Table `organiser_stripe_accounts(organiser_id, stripe_account_id, charges_enabled, payouts_enabled,
details_submitted, ...)`, written only by `ticket_stripe_account_upsert_v1` (not client-executable;
webhook/service). Client-executable: `ticket_type_upsert_v1(p_payload)`, `ticket_type_set_status_v1(p_id,
p_status)` (body checks `charges_enabled` and `_ticket_can_manage_organiser_v1`), `ticket_sales_summary_v1`,
`ticket_types_public_v1`. Neither ticket write checks dancer or onboarding completeness today.

## E5. Teach / DJ storage and write paths that ALREADY exist (source plan gaps 2 and 5 are CHANGED)

| Object | What it is | Evidence |
|---|---|---|
| `account_role_intent(user_id uuid, roles text[], declined text[], updated_at)` | per-account answers: `roles` = sign-up multi-select (`dancer, organiser, teacher, dj`), `declined` = "No" to "Do you teach? / Do you DJ?" | columns via information_schema; 10 rows |
| `set_my_role_declined_v1(p_role text, p_declined boolean) -> jsonb` | definer, authenticated; `true` = No; idempotent (`changed:false`), row lock `FOR UPDATE`; no audit | prosrc, migration `20261129550000` (B-DB1) |
| `set_my_role_intent_v1(p_roles text[]) -> jsonb` | definer, authenticated; "organiser here grants NOTHING" | prosrc |
| `save_my_role_v1(p_role text, p_patch jsonb) -> jsonb` | definer, authenticated; writes `teacher_role_details` / `dj_role_details` (years_teaching, genres seen in body); no audit | prosrc regex |
| `my_role_details_v1(p_role)`, `my_roles_v1()`, `my_role_intent_v1()` | reads | pg_proc |
| `my_profile_progress_v1(p_organiser_id uuid) -> jsonb` | the R1 Go-live question list read (Website `golive/goLiveModel.ts`) | pg_proc; agent sweep |
| `save_my_dancer_profile_v2(p_payload jsonb)` | diff-only dancer save, handles `languages` (array); used by the dancer-app editor | prosrc regex; `src/modules/dancer-app/api/rpc.ts:182`, `api/types.ts:72` |
| `save_my_dancer_profile_v1(p_payload)` | older save, NO `languages`; used by `Dancer4Flow`, `join/AboutStep.tsx:64` | prosrc regex; `src/lib/saveMyDancerProfile.ts:238` |

Website callers: `src/modules/areas/shared/areaApi.ts:76,84,90` (`my_role_details_v1`, `save_my_role_v1`,
`set_my_role_declined_v1`), `src/modules/areas/home/rolesApi.ts:39,58,64`. R1 already has a
"Do you also teach or DJ?" screen: `src/modules/organiser/home/onboarding/golive/roleQuestion.ts`,
`RoleQuestionScreen.tsx`. Teaching styles and DJ genres are FREE TEXT lists today
(`areas/shared/fieldRegistry.ts:40,49`); no fixed list in this repo (D5 names admin's
`COMMON_TEACHING_STYLES`, 14 values, not readable here).

## E6. Website code facts (main `a281a3e`)

| Claim (source plan) | Status | Evidence |
|---|---|---|
| `dancerGate()`, `DancerProfileGate`, `/finish-profile` asks only missing | VERIFIED | `src/lib/accountRouting.ts:184`; `src/components/account/DancerProfileGate.tsx:27` (only mount `src/pages/Account.tsx:106`); `/account/o/*` uses its own `AccountGated` (`shell/OrganiserRoutes.tsx:76-95`, `src/lib/accountGate.ts:49`); `FinishProfile.tsx:185,203-241`; rule list `src/lib/profileCompletion.ts:22` |
| Event writes via `series_command_p5` / `occurrence_command_p5` in `selfServeApi.ts` | VERIFIED (Website side) | `selfServeApi.ts:282,288`; also `admin_bulk_occurrence_command_p5` (`flows/change/bulkApi.ts:13`). Server side has 4 more doors (E1b) |
| Old routes `events/new`, `events/:seriesId/dates/:occurrenceId` | CHANGED | now legacy redirects (`OrganiserRoutes.tsx:149-151`, `legacyPaths.ts:45`); create = `new/what`..`new/:seriesId/cover` -> `NewFlow` (`:121-126`); edit = `change/*`, `add/*`, `cancel/*`, `events/:seriesId/*`, `cover/:seriesId`, `go-live` |
| P3 equivalents under `src/modules/organiser/p3/` | CHANGED | `p3/shell/P3Routes.tsx:23-29`: home, events, events/:seriesId, events/:seriesId/dates, stats, you. No create or edit-event route; "Add an event" links to R1 (`p3/screens/HomeScreen.tsx:45`, `EventsScreen.tsx:27`) |
| R1 onboarding at `home/onboarding/` | VERIFIED | `OnboardingView`, `OrganiserSheet` (maps `profile_incomplete` :88), `SignOutLine`, `citySearch`, `claimStates`, `onboardingModel`, `dancer4/*`, `golive/*` |
| `contactModel.ts` / `ContactSheet` / `AvatarUpload` | VERIFIED | `edit-in-place/contactModel.ts:21`, `edit-in-place/ContactSheet.tsx`, `src/components/profile/AvatarUpload.tsx` |
| Category is free text on the Website | CHANGED | already a pick list of the five: `edit-in-place/fieldRules.ts:323` (`checkCategory` :325 keeps a stored legacy value) |
| `PROMPTED_FIELDS` / Page completion card | VERIFIED | `fieldRules.ts:77-81` (avatar_url, founded_year Essential; instagram Recommended; About never prompted, :76); `CompleteCard` `edit-in-place/parts.tsx:91-113` |
| Nationality full ISO + home nations (S3a #1113) | VERIFIED merged | `src/constants/countries.ts:17`; `src/constants/__tests__/countriesHomeNations.test.ts:8` |
| Languages on "the Website dancer form" (S3b #1117) | CHANGED target | built in the dancer-app editor (`dancer-app/screens/edit/LanguagePicker.tsx`, `languages.ts`, `EditScreen.tsx`), saved by `save_my_dancer_profile_v2` as an array. `src/pages/EditProfile.tsx` is NOT routed (self-service routes retired 2026-09-12, `AnimatedRoutes.tsx:197-199`). `FinishProfile` asks only the 4 gate fields |
| `organiser_profile_update_p5_v1` accepts category, logo, link, city | VERIFIED | Website `src/lib/organiserProfileUpdate.ts:79-100`; prod `c_allowed` includes `organisation_category`; `contact_email` refused for non-admins (`organiserProfileUpdate.ts:66`) |
| Invite redeem, then landing | VERIFIED | `/invite/:token` -> `admin-organisers/InviteRedeemPage.tsx` -> `join/JoinPage.tsx` (`bind_organiser_invite_email_v1`, `set_my_role_intent_v1`, `redeem_organiser_invite_v1`); Done screen links to `/account/o` (`JoinScreens.tsx:164-169`), no auto-navigate |
| A runtime flag the Website can read | NOT FOUND | only build-time `src/lib/featureFlags.ts` (`VITE_ENABLE_*`); the server flag must be read through the status RPC |
| `profile_incomplete` mapping | VERIFIED | `accountRouting.ts:201`; `selfServeErrors.ts:39`; `inviteModel.ts:201`; `joinModel.ts:224,238`. `onboarding_incomplete`: no occurrence |

## E7. P3 and ticketing (for the hand-off)

- PR #1118 (Website, open, head `claude/p3-w4b-onboarding` @ `b5a0b3a`, CI green): W4b build 1, Welcome /
  Add a page / claim states in the P3 look, tap gate `home/onboarding/profileGate.ts` over
  `ProfileGateContext` (dancer 4-field rule, admin exempt via `withAdmin`). Review `docs/review/pr-1118-r1.md`
  (PR #1119): S1, S2 resolved; S3 (walk spec skips in CI while `organiserP3` is off) recorded as an owner
  call; notes N2-N4 open (confirmation line returns on refresh; refetch drops it; "come back to Welcome"
  wrong on Add a page). No create wizard (out of scope; "waits for the event-truth PR").
- W4b has no slice row in `ARC-p3.md` (`origin/claude/p3-arc-plan`, PR #1059, rows W2b-W3 only).
- W-T ticketing in the P3 shell merged (#1079, fix 3 #1106 on the WEBSITE repo). Module
  `src/modules/organiser/p3/tickets/` (`TicketsEntry`, `TypeSheet`, `RefundSheet`, `GetPaid` at `you/get-paid`).
  Prompt rule `p3/tickets/model.ts:117-121` (owner/manager, a live event, Stripe `none|started`). Flags
  `organiserTicketing`, `publicTicketing` (`src/lib/featureFlags.ts:71,75`). Stripe onboarding = edge fn
  `stripe-connect-onboard` (doc of 2026-10-27: not deployed; today UNVERIFIED). Server refusal
  `organiser_not_onboarded` means STRIPE not onboarded (`tickets/ticketModel.ts:402`): a name clash to avoid.
- No `ARC-ticketing` document found anywhere; "admin #1106 Accounts v2" not verifiable (admin repo not
  readable; Website #1106 is W-T fix 3).
