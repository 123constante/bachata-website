# ARC: compulsory organiser onboarding (production plan)

Status: PLAN, nothing built by this document. Lane: CAREFUL. Written 2026-10-28 from the approved
source plan (`briefs/onboarding-arc-source-plan.md`, branch `brief/p3-onboarding-arc-plan`).
Evidence (queries, counts, file:line): [`onboarding-arc-evidence.md`](onboarding-arc-evidence.md), cited as E1..E7.
The source plan's Confirmed decisions and D1-D8 are binding; where reality disagrees, section 10 asks.

## SUMMARY (read this on the phone)

1. Outcome: every team member answers the compulsory questions once; until then they can look at everything but cannot create or edit events. Finishing unlocks events and puts a new organiser live.
2. The rule lives on the server, in one place, and is switched by one flag (`organiser_onboarding_gate`, OFF until the screens ship).
3. Reality changed since the source plan: "Do you teach / DJ?" answers and teach/DJ saves ALREADY exist (`account_role_intent`, `save_my_role_v1`). No new answers table is needed.
4. The gate must cover SIX write doors, not two: `organiser_save_event_v1`, `organiser_save_festival_v1`, `organiser_set_occurrence_programme_v1`, `organiser_undo_last_change_v1` also write events (E1b).
5. Day one if switched on today: all 10 non-admin team members locked (6 on dancer fields, the rest on unanswered teach/DJ). Hence a grace period before ON.
6. Slices: S1 schema + write paths, S2 status read + gate (OFF) + guard, S3 done (nationality #1113, languages #1117), S4 admin editor (in flight), S5 = screen spec (Appendix A), S6 live on completion, S7 switch ON, S8 ticketing reads the same signal.
7. Order: S1 -> S2 (admin, careful) in parallel with W4b build 2 (screens, P3) -> S6 -> grace -> S7 -> S8.
8. Ships first: S1 (one admin migration: `levels_taught`, private sign-in email, audit table, three small RPCs).
9. Hand-off: complete + live -> first event (W4b create wizard) -> Get paid (Stripe, W-T). One signal for all: `organiser_onboarding_status_v1()`.
10. Owner must decide: Q1 grace length, Q2 organiser go-live in cities with an ambassador, Q3 does selling tickets need finished details, Q4 do cancels count as "edit".
11. Not decided here and not reopened: who, which fields, step order, About recommended only, answer wins, nationality list, out-of-scope list.
12. Owner's only manual step: one 5-step phone check before S7 (section 6.1).

---

## 1. Outcome, non-goals, success measures

**Outcome.** A person who runs an organiser page (owner or manager) has, before they can create or edit events:
a complete dancer persona (first name, city, dance role, photo, nationality, languages, Instagram), an answered
"Do you teach?" (if yes: styles, years, levels), an answered "Do you DJ?" (if yes: genres), and, for the
organiser they are acting for: logo, one link, city, one of five categories, and contact confirmed.
About is recommended, never blocking.

**Non-goals** (from the source plan, binding): marketing permission, terms step, new admin override, new
notification, photo review, legal name, team step, longer invite expiry, name lock, event-types field, new
public switches, a per-person exemption list.

**Success measures (all readable from prod by SELECT):**

| Measure | Query source | Target |
|---|---|---|
| Non-admin team members complete | `organiser_onboarding_status_v1` logic over `entity_members` | 10 of 10 before S7; 100% after |
| Day-one lock-outs at S7 | same, at switch time | 0 people who were not told (banner seen) |
| Refusals by the gate | `_command_audit_refusal_p5` rows with `onboarding_incomplete` (failed rows) | trending to 0 within 14 days of S7 |
| Time from invite redeem to complete | `organiser_invites.used_at` vs `organiser_onboarding_progress.completed_at` (S1) | median under 1 day |
| Time from complete to first event | `completed_at` vs first series created by that organiser | baseline, reported, no target yet |
| Support-visible failures | Sentry events tagged `onboarding` + refusal rows | 0 unknown error codes |

**Definition of done per slice** is in the slice table (section 8, column "Exit evidence"). The arc is done
when S7 is ON, the shape survey shows 10 of 10 (or every remaining non-complete person is named to the owner),
and the next arc's brief can read section 9 without asking.

## 2. Verified current state

Full evidence E1-E7. Each source-plan claim:

| # | Claim | Status | Evidence / correction |
|---|---|---|---|
| 1 | Dancer gate template `_require_complete_dancer_profile_v1`, `profile_incomplete` DETAIL missing[] | VERIFIED | E1, body read; admin exempt; definer, not client-executable |
| 2 | Guard `check_organiser_profile_gate_v1` exists | VERIFIED | E1 (invoker, 7018 chars) |
| 3 | Website `DancerProfileGate`, `dancerGate()`, `/finish-profile` asks only missing | VERIFIED | E6; organiser area uses `AccountGated`, same fact |
| 4 | Event writes go through the two command RPCs | CHANGED | Website: yes. Server: 4 more client-callable doors reach `apply_aggregate_write_p5` (E1b) |
| 5 | Old-area routes `events/new`, `events/:id/dates/:occ` | CHANGED | now redirects; real routes `new/*`, `change/*`, `add/*`, `cancel/*` (E6). Irrelevant to the gate (server-side) |
| 6 | P3 has equivalent create/edit routes | CHANGED | P3 has no create or edit route yet; it links out to R1 (E6) |
| 7 | Teacher/DJ storage exists; only READ RPCs | CHANGED | write RPC `save_my_role_v1(p_role, p_patch)` exists; answers in `account_role_intent` via `set_my_role_declined_v1` (E5) |
| 8 | `organiser_profiles` has logo, bio, links, city, contact, switches, lifecycle | VERIFIED | E3 survey used them |
| 9 | Lifecycle: owner draft->pending_review only; review by ambassador/admin | CHANGED | ambassador A0a/A0b (2027-03-06 stamps) rewrote the trigger: `pending_review` needs a city; ambassador cannot approve their own (E1d) |
| 10 | No `levels_taught` | VERIFIED | E1 columns |
| 11 | Need a new answers table | CHANGED | not needed: `account_role_intent.roles/declined` (E5) |
| 12 | Category free text on Website | CHANGED | already a five-value pick list (`fieldRules.ts:323`) |
| 13 | `save_my_dancer_profile_v1` saves nationality, languages, Instagram? | CHANGED | v1: nationality + Instagram, NO languages. v2 (diff-only) saves languages; dancer-app editor uses v2 (E5) |
| 14 | No Website teach/DJ editor | CHANGED | areas editor uses `save_my_role_v1` (`areas/shared/areaApi.ts`); R1 has `RoleQuestionScreen` |
| 15 | Admin person editor lacks nationality/role/languages/IG | UNVERIFIED | admin source not readable; S4 PRs #1101/#1103 are ADMIN numbers (Website #1101/#1103 are unrelated docs PRs) |
| 16 | Sign-in email on 3 of 176 dancer rows | VERIFIED in shape | 11 of 12 team members lack it (E3) |
| 17 | 12 people on teams, 7 of 12 locked | CHANGED | 12 people (2 admins). Locked if ON today: 10 of 10 non-admins (6 dancer part, others teach/DJ unanswered) (E3) |
| 18 | 48 live, 3 archived | CHANGED | 49 live, 0 archived (test orgs deleted today) |
| 19 | Category on 47 of 48 | VERIFIED (47 of 49) | E3 |
| 20 | Nationality list S3a, languages S3b merged | VERIFIED | #1113, #1117 on main (E6) |
| 21 | Gate-OFF flag "decide at S2" (D7) | RESOLVED | existing `app_feature_flags` + `is_feature_enabled()` + `admin_set_feature_flag_v1`; precedent `dancer_area_open` (E2) |
| 22 | Last migrations on the two command RPCs 20261109260000 / 20261109390000; no collisions | PARTLY | `apply_aggregate_write_p5` changed TODAY by P3 (`20261028194224`); the trigger by ambassador arc. Re-check at each slice start |
| 23 | Ledger head / #1096 fix | CHANGED | ledger shows `20270306120000 og_bake_bypass_header_v1`, not the planned rename. Admin orchestrator to confirm #1096 state |
| 24 | Admin #1106 = Stripe Accounts v2 | UNVERIFIED | Website #1106 = W-T fix 3 (merged). Admin #1106 not readable |

**Shape survey (E3) and who hits the lock on day one:**

| Shape | People | Gate result if ON today |
|---|---|---|
| Admin (exempt) | 2 | never locked |
| Non-admin, dancer part incomplete (incl. 1 with no persona) | 6 | locked |
| Non-admin, dancer part complete, teach or DJ unanswered | 3 or 4 | locked |
| Non-admin, everything answered | 0 or 1 | open |
| Roles in use | owner, manager (no contributor rows) | managers gated like owners (decision "Who") |
| Organisers reached by non-admins | 6, all live, all pass the organiser part | organiser part locks nobody |
| Organisers in draft / pending / rejected | 0 | "Live on completion" changes nothing existing |

## 3. Journeys as a state machine

**Facts used by every journey** (computed, never stored as "done"): `P` = person part complete,
`T` = teach answered (and if yes, styles + years + levels), `D` = DJ answered (and if yes, genres),
`O(org)` = organiser part complete for that organiser, `C(org)` = contact confirmed for that organiser.
`complete(user, org) = P and T and D and O(org) and C(org)`. Admin: always open.
Because completion is computed from data, a later compulsory question is simply a new missing item: only
it is asked (decision "New compulsory question later").

**Entries x start states:**

| Entry | Lands on | Then |
|---|---|---|
| A1 invite link, signed out | `/invite/:token` -> sign in -> Join (4 dancer questions inline, as today) -> redeem -> owner | Done screen -> organiser Home with banner "Finish your details to create and edit events" + Continue |
| A2 invite link, signed in | same, sign-in skipped | same |
| Signed-in claim / "Ask to join" (accepted) | owner (claim) or manager (request accepted) | same banner on first visit |
| Self-start / new page (`create_organiser_profile_v1`, `organiser_start_v1`) | owner of a DRAFT organiser | banner; finishing runs `complete_organiser_onboarding_v1` (S6) -> live |
| Admin-created organiser, admin adds a member | member row | same banner; admin themselves never gated |

| Start state | Steps shown | Event create/edit |
|---|---|---|
| No persona | all dancer steps, teach, DJ, organiser, contact, About (optional) | locked |
| Partial persona | only missing dancer fields, then unanswered parts | locked |
| Complete persona, teach/DJ unanswered | teach question, DJ question, organiser/contact if missing | locked |
| Everything complete | none; banner hidden | open |
| Owner vs manager | identical steps (decision "Who"); organiser and contact steps are editable by both, since `organiser_profile_update_p5_v1` already allows owner/manager | locked until complete |
| Contributor (no rows today) | identical steps | contributors cannot write events anyway; status still shown |
| Draft organiser | all steps; last step "Go live" | locked; on complete -> live (S6, Q2) |
| Live organiser | all steps | locked until complete |
| Paused / archived organiser | steps viewable | archived: event writes already refused; paused: same as live |
| Admin | no banner, no gate | open |

**State transitions** (per user, per organiser):
`NOT_STARTED -> IN_PROGRESS` (first saved answer) `-> COMPLETE` (missing[] empty) `-> INCOMPLETE_AGAIN`
(a new compulsory item added, or an admin clears a field) `-> COMPLETE`. Each step saves on Continue; leaving
mid-step loses only the unsaved screen. Another phone reads the same server status and resumes at the first
missing item. Two phones at once: every write RPC is idempotent and last-write-wins per field, with the old value
audited (section 4.5).

**Answer wins:** the step shows the held value pre-filled; if the person changes it, the new value is saved and
the old one is written to `onboarding_audit` (S1). Held data never overrides a typed answer.

## 4. Data model and contracts (admin repo migrations; Website only calls)

### 4.1 S1 schema and write paths (one migration, M1)

| Object | Change |
|---|---|
| `teacher_role_details.levels_taught text[]` | new, nullable; CHECK every element in `('Beginner','Improver','Intermediate','Advanced')` (D1) |
| `organiser_onboarding_progress(user_id uuid, organiser_id uuid, contact_confirmed_at timestamptz, completed_at timestamptz, about_skipped_at timestamptz, updated_at)` PK (user_id, organiser_id) | new; RLS on, no direct grants; written only by definer RPCs; `completed_at` = first time complete (metrics only, never read by the gate) |
| `onboarding_audit(id bigserial, user_id, organiser_id null, field text, old_value jsonb, new_value jsonb, source text, at timestamptz)` | new; RLS on, no grants; admin read RPC later if wanted (not in scope) |
| NO new answers table | use `account_role_intent` (E5): "Yes" = role in `roles` and NOT in `declined`; "No" = in `declined`; unanswered = neither |

Write RPCs (all `SECURITY DEFINER`, `SET search_path = public, pg_catalog`, `REVOKE ALL FROM public, anon`,
`GRANT EXECUTE TO authenticated`, act on `auth.uid()` only, audit changed fields, return `{ok, changed}`):

| RPC | Purpose | Errors |
|---|---|---|
| reuse `save_my_dancer_profile_v2(p_payload jsonb)` | first name, city, role, photo, nationality, languages, Instagram | existing codes; S1 adds audit rows for changed keys (body replace, md5 pin) |
| reuse `set_my_role_declined_v1(p_role, p_declined)` and `set_my_role_intent_v1` | "Do you teach / DJ?" | existing |
| reuse `save_my_role_v1(p_role, p_patch)` + allow `levels_taught` key | styles, years, levels; private lessons and where (optional); genres | existing + `invalid_levels` |
| new `confirm_organiser_contact_v1(p_organiser_id uuid, p_phone text default null)` | one-tap confirm (and optional phone set via `organiser_profile_update_p5_v1` internals); stamps `contact_confirmed_at` | `authentication_required`, `not_found` (also for "not a member": no existence oracle), `invalid_phone` |
| new `save_my_signin_email_v1()` | copies `auth.users.email` to the caller's PRIVATE `dancer_profiles.email` if empty or different; audited; never public | `authentication_required`, `no_persona` |
| new `skip_organiser_about_v1(p_organiser_id)` | records the optional About step was seen | `not_found` |
| reuse `organiser_profile_update_p5_v1` | logo, link, city, category, About | existing; category value validated to the five on the Website only (admin keeps 8) |

### 4.2 S2 single source of truth (M2)

`_onboarding_missing_v1(p_user uuid, p_organiser_id uuid) RETURNS text[]` (definer, not client-executable,
STABLE). THE definition. Missing codes, stable strings, order = step order:
`first_name, city, dance_role, photo, nationality, languages, instagram, teach_answer, teach_styles,
teach_years, teach_levels, dj_answer, dj_genres, org_logo, org_link, org_city, org_category, contact_confirm`.
No persona -> all seven dancer codes. Admin is NOT handled here (the callers decide).

`organiser_onboarding_status_v1(p_organiser_id uuid DEFAULT NULL) RETURNS jsonb` (definer, authenticated):

```json
{ "v": 1, "gate_on": false, "is_admin": false,
  "person": { "complete": false, "missing": ["nationality","teach_answer"] },
  "organisers": [ { "id": "uuid", "name": "Salsa Latina", "role": "owner", "lifecycle": "draft",
                    "complete": false, "missing": ["contact_confirm"],
                    "about": { "done": false, "skipped": false } } ],
  "complete": false }
```
`p_organiser_id` null = every organiser the caller is a member of; a non-member id returns `organisers: []`
(same as unknown: no oracle). `complete` = all listed organisers complete (or none listed and person complete).
The Website gate, banner, P3 screens, admin and the next arcs all read THIS. `my_profile_progress_v1` stays for
R1 Go-live until R1 is retired; no new caller may use it for onboarding.

### 4.3 S2 server gate (M3, OFF)

`_require_onboarding_complete_v1(p_organiser_ids uuid[]) RETURNS void` (definer, not client-executable):
returns quietly when `NOT is_feature_enabled('organiser_onboarding_gate')`, when `is_admin()`, or when
`_onboarding_missing_v1(auth.uid(), o)` is empty for at least one organiser in `p_organiser_ids` the caller
is a member of (acting for any one finished organiser is enough). Otherwise raises
`ERRCODE 'P0001', MESSAGE 'onboarding_incomplete', DETAIL {"missing":[...],"organiser_id":"..."}, HINT 'Finish your details'`.
No session: `authentication_required`.

Target organisers: new helper `_command_target_organisers_p5(p_envelope jsonb) RETURNS uuid[]`: for a
`series.upsert` without an id, the envelope's `organiser_ids`; otherwise the target series' `organiser_ids`
(occurrence -> its series). Read-only.

Call sites (first statement inside `BEGIN`, so a refusal is audited as a failed row, E1a):
`series_command_p5`, `occurrence_command_p5`, `organiser_save_event_v1`, `organiser_save_festival_v1`,
`organiser_set_occurrence_programme_v1`, `organiser_undo_last_change_v1`. Admin RPCs untouched.
NOT inside `apply_aggregate_write_p5` (P3 changed it today; admin and system paths share it).

Which command kinds are "edit" (Q4): recommended = ALL kinds, including cancel/skip, so the rule is one line
and impossible to route around. Alternative in Q4.

Guard `check_organiser_onboarding_gate_v1()` (invoker, JSON report, modelled on `check_organiser_profile_gate_v1`):
(a) each of the six bodies contains exactly one `PERFORM public._require_onboarding_complete_v1(` before any other
statement; (b) discovery net: every function executable by `authenticated` whose body reaches
`apply_aggregate_write_p5` or writes `event_series_p5` / occurrences is either in the six, admin-checked, or in an
explicit allow-list; (c) the flag row exists; (d) helper is definer, pinned search_path, not executable by
anon/authenticated. Wired into `guards.json` / `check-anon-guard-batch.mjs` and a Website
`scripts/check-*.mjs` step in `db-contract-check.yml`.

### 4.4 S6 live on completion (M4)

`complete_organiser_onboarding_v1(p_organiser_id uuid) RETURNS jsonb` (definer, authenticated): if caller is
OWNER (D4: owner-only), `_onboarding_missing_v1` is empty, and lifecycle is `draft` or `rejected`, it sets
`live` under the transaction-local marker `app.onboarding_go_live = <id>`, writes an audit row, returns
`{ok, lifecycle}`. Idempotent: already live returns `{ok, changed:false}`. Trigger allowance (new arm in
`tg_enforce_lifecycle_transition`, body replace with md5 pin):
`v_kind='organiser' AND v_old IN ('draft','rejected') AND v_new='live' AND v_is_owner AND current_setting('app.onboarding_go_live', true) = NEW.id::text`.
A direct table update carries no marker and is refused as before (same pattern as Lever 2 `end_run`).
Ambassador cities: see Q2.

### 4.5 Security, privacy, audit, concurrency

- No existence oracle: every per-organiser RPC answers `not_found` for "no such id" and "not your organiser".
- Public data: everything entered is public through today's switches; the sign-in email goes ONLY to
  `dancer_profiles.email`, which no public read exposes (S1 self-verify asserts the public dancer reads omit it).
- Audit: every changed field -> `onboarding_audit` (old, new, source). Refusals -> existing
  `_command_audit_refusal_p5` failed rows.
- Idempotency: saves return `changed:false` when nothing differs; the Website sends nothing for an untouched step.
- Concurrency: row locks `FOR UPDATE` on the person/role rows (pattern already in `set_my_role_declined_v1`);
  last write wins per field, both writes audited.
- Rate limits: none new; writes are per-user and idempotent. (A spam guard is not warranted for 12 people.)

## 5. Rollout and safety

**Flag.** `app_feature_flags('organiser_onboarding_gate', false, ...)`, inserted by S2's migration. ON = one call to
the existing `admin_set_feature_flag_v1('organiser_onboarding_gate', true)` (audited, reversible in one call).
The Website reads `gate_on` from the status RPC, never a build flag, so ON/OFF needs no deploy.

**Staged lock-out of the 10 non-admin members:**

| Stage | When | What people see |
|---|---|---|
| 0 | S1+S2 applied, flag OFF | nothing changes |
| 1 | W4b screens merged | banner "Finish your details to create and edit events" + Continue on Home and Events; editing still works |
| 2 | grace (Q1, recommended 14 days) | banner adds "From <weekday> <date> you will need these to create or edit events" |
| 3 | S7: flag ON | create/edit routes show the onboarding screens first; server refuses with `onboarding_incomplete` |

Exemption: admins only (`is_admin()`). Who can unlock a person: an admin, by filling the missing data in the
admin person editor (S4) or by switching the flag OFF. No per-person override (out of scope, binding).

**Rollback per slice:** S1: additive (column, two tables, three RPCs) -> drop-forward migration if needed, no data
loss. S2: flag OFF is instant; body revert = re-create the six bodies from the pinned pre-S2 text. S6: revert the
trigger arm (organisers already live stay live; an admin can pause one). S7: flag OFF. S8: flag OFF also disables
it (it calls the same helper).

**Data later becomes invalid** (admin clears a logo, a new question is added): the person becomes incomplete
again, the banner returns, the server refuses the next event write with the new missing item only. Events
already published are untouched. A live organiser is NOT pushed back to draft.

**Collision procedure for the six gated bodies** (also changed by event-truth, P3, ambassador arcs):
1. Before writing the migration, the worker reads prod `md5(prosrc)` of each body and records it in the brief.
2. The migration re-creates each body from prod text plus ONE `PERFORM` line; its self-verify block (rolled back)
   strips that line and asserts the md5 equals the recorded pin; on mismatch it RAISEs and nothing applies.
3. One migration at a time touches these bodies: the orchestrator holds a named lock
   (`.claude/arc-state.json` key `p5_command_bodies_lock`, value = branch + slice) and checks admin open PRs for
   any migration naming these functions before dispatch and again before apply.
4. Any later migration by another arc that replaces one of the six must keep the gate line; the guard (4.3 a)
   makes CI red if it does not.

## 6. Test strategy

| Layer | Tests |
|---|---|
| DB self-verify (in each migration, rolled back) | each RPC: signature, definer, search_path, grants (anon none), `not_found` for non-member, idempotent second call `changed:false`, audit row written; gate: flag OFF passes, ON + incomplete raises with exact missing[], ON + complete passes, admin passes, one finished organiser of two is enough; the six bodies hash back to pins minus the gate line |
| Mutants (guard) | remove the gate line from one body -> guard red; move it after another statement -> red; add a new authenticated function calling `apply_aggregate_write_p5` without the gate -> red; drop the flag row -> red; grant the helper to authenticated -> red |
| Replay | `check:replay` on the admin repo for every migration |
| Website unit (table-driven matrix) | one shared `onboardingModel` mapping missing codes -> step, label, screen; matrix: every screen (banner, each step, gate screen, Home card) x every shape (no persona, partial, complete; teach yes/no/unanswered; DJ yes/no/unanswered; draft/live/paused/archived; owner/manager/contributor; admin; gate on/off; status read failed). Untouched save sends nothing; every empty state says what to do; every disabled control says why; `onboarding_incomplete` maps to the onboarding screen, never a raw error |
| Screen walks | 390x844 on prod-shaped data (a seeded preview user per shape): invite -> sign in -> each step -> locked event -> finish -> create event; half-filled persona; manager; admin |
| CI jobs affected | admin: contract-check, replay, guards batch; Website: `unit-tests.yml`, `e2e-smoke.yml` (add the walk spec by name, owner call on the `organiserP3` skip, #1118 S3), `db-contract-check.yml` (new step), `phone-qa.yml`, `perf-budget.yml` (`/app` has 0.3 KB headroom: the screens must be a lazy chunk) |

### 6.1 Owner phone check (once, before S7)
1. Open the invite link on your phone with a test account; sign in.
2. Answer each step; close the browser half-way; reopen on another device: it continues where you stopped.
3. Before the last step, tap "Add an event": you see the onboarding screen, not the event form.
4. Finish: the banner is gone and "Add an event" opens the form.
5. Your own admin account never sees the banner.

## 7. Reconciliation with P3 PR #1118 and W4b

- #1118 (W4b build 1) owns Welcome / Add a page and the dancer 4-field tap gate `profileGate.ts`. This arc does
  not change it. W4b build 2 EXTENDS that module: `tapGate` gains an `onboarding` kind fed by
  `organiser_onboarding_status_v1`, with the same admin rule (`withAdmin`). One mapping, not two.
- Open #1118 notes carried into W4b build 2: N2/N3 (confirmation line on refresh / refetch), N4 ("come back to
  Welcome" copy wrong on Add a page) and S3 (walk spec skipped in CI while `organiserP3` is off: owner call).
- P3 has no create/edit route yet. Until it does, the CLIENT gate goes on the R1 entry points that P3 links to
  (`new/*`, `change/*`, `add/*`, `cancel/*`, `cover/*`, `events/:seriesId/*`) as one wrapper, and the SERVER gate
  is what actually protects both areas. When the W4b create wizard lands, it reads the same status.
- The W4b create wizard "waits for the event-truth PR" (P3 brief). The onboarding screens do not wait for it.

## 8. Slice table

Rules: careful lane for DB; Design Gate for anything visible; one live worker per branch; max 2 workers;
reviewer model differs from builder; migrations applied by the orchestrator only after replay proof + independent
review; stop on any new red.

| Slice | Repo / lane | Builder model / effort | Reviewer | Depends on | Branch | Size | Migration | Exit evidence |
|---|---|---|---|---|---|---|---|---|
| S1 schema + write paths | admin / careful | Opus / xhigh | Fable | admin contract-check green (#1096 state) | `claude/onboarding-s1-schema` | ~400 lines SQL | `M1 onboarding_s1_schema_v1` (version = next free at dispatch) | self-verify green; replay; prod read-after: column, 2 tables, RPC grants; audit row on a rolled-back test |
| S2 status + gate OFF + guard | admin + Website guard step / careful | Opus / xhigh (keystone: ultra review) | Fable | S1 applied; md5 pins of six bodies recorded; lock held | `claude/onboarding-s2-gate` | ~600 SQL + ~150 JS | `M2 onboarding_status_v1`, `M3 onboarding_gate_off_v1` | guard green + 5 mutants red; flag row OFF; status RPC answers for the 12 prod shapes (counts only) |
| S3 nationality + languages | Website | done | done | - | merged #1113, #1117 | - | none | merged; FinishProfile gains nationality/languages/Instagram in W4b build 2 (they are onboarding steps) |
| S4 admin person editor | admin UI / normal + Design Gate | (in flight) | program lead | - | admin #1101 / #1103 | - | none | merged; admin can fix every onboarding field |
| S5 screen spec | this doc, Appendix A | - | Fable read | - | this branch | - | none | owner-approved via W4b Design Gate stage 2 |
| W4b build 2 onboarding screens (P3 arc) | Website / careful UI + Design Gate | Opus / high | Fable | S2 merged (reads status RPC); #1118 merged | P3's branch, named by P3 | ~1,200 lines incl. tests | none | matrix green; 390x844 walk; perf budget; banner live, gate OFF |
| S6 live on completion | admin / careful | Opus / xhigh | Fable | S2; Q2 answered; ambassador arc idle on the trigger | `claude/onboarding-s6-golive` | ~200 SQL | `M4 organiser_go_live_on_onboarding_v1` | self-verify: owner + complete + draft -> live; manager refused; direct UPDATE refused; ambassador-city rule per Q2 |
| S7 switch ON | ops / careful | orchestrator | owner phone check | W4b build 2 merged; S6; grace ended (Q1); shape survey shows who is still incomplete | none | one call | none (flag) | flag true; refusal rows watched 48 h; rollback = one call |
| S8 ticketing reads the signal | admin + Website / careful | Opus / high | Fable | S2; Q3 = yes | `claude/onboarding-s8-tickets` | ~120 SQL + small UI | `M5 ticket_gate_onboarding_v1` | `ticket_type_upsert_v1` / `ticket_type_set_status_v1` call the helper; Get paid prompt waits for complete |

Order: S1 -> S2 -> (W4b build 2 and S6 in parallel, max 2 workers) -> grace -> S7 -> S8. S4 runs whenever free.

## 9. Hand-off to the next step (exit contract)

**What comes next (confirmed with evidence, E7):** (a) the first event, through P3's create wizard (W4b, not yet
briefed; today P3 links out to R1 `new/*`); (b) Get paid: Stripe Connect onboarding (`stripe-connect-onboard`
edge fn; `organiser_stripe_accounts.charges_enabled`) and the W-T ticket screens already merged in P3
(#1079, #1106 Website). Ticket types need a LIVE series, so ticketing follows the first event naturally.

**The exit contract other arcs may assume:**

| Signal | Shape | Stable from |
|---|---|---|
| `organiser_onboarding_status_v1(p_organiser_id)` | section 4.2, `v:1`; new fields only added, never renamed | S2 |
| `onboarding_incomplete` error | DETAIL `{missing[], organiser_id}` | S2 |
| Flag `organiser_onboarding_gate` | `app_feature_flags` | S2 |
| `organiser_onboarding_progress.completed_at` | first completion time, metrics | S1 |
| Missing codes list | section 4.2, append-only | S2 |

**Ordering of the two "finish your details" walls:** onboarding first, Get paid second, never together. The P3
Get paid prompt (`p3/tickets/model.ts:117-121`) gains one condition: `status.complete === true`. While onboarding is
incomplete only the onboarding banner shows. Name clash: the Stripe refusal `organiser_not_onboarded`
(`tickets/ticketModel.ts:402`) means "Stripe not set up"; the copy must say "Connect payments", never "onboarding".

**Should ticket sales require onboarding complete (Q3)?** Recommended YES via S8, because a live series created
before S7 could otherwise sell tickets from an unfinished account. It costs one `PERFORM` in two ticket RPCs.

**What the next arc's brief can assume:** a member who can create events is complete (when the flag is ON) and is
acting for a live organiser; contact is confirmed; the sign-in email is on the private dancer record; teaching and
DJ answers exist. It must NOT assume Stripe is connected or that a contributor can write.

**If the next step is something else:** the evidence points to the create wizard as the real blocker (P3 has no
create route), so W4b's create wizard, not ticketing, is the next arc's first slice.

## 10. Risks, owner questions, out of scope

| Risk | Mitigation |
|---|---|
| Day one locks all 10 members | grace + banner (stage 2); S7 only after the shape survey names who is left |
| Another arc replaces a gated body and drops the line | guard (4.3 a) + md5 pin procedure (section 5) |
| A new write door appears | guard discovery net (4.3 b) |
| Live on completion skips human review | owner accepted (D4); ambassador cities per Q2 |
| `/app` bundle at 0.3 KB headroom | screens as a lazy chunk; perf budget in the walk |
| Teach styles: D5 names admin's 14, Website stores free text | W4b uses the 14 as chips plus the held free-text values shown as already ticked; no data rewrite |

**Owner questions (click format, recommendation first):**

- **Q1 Grace before the lock:** (a) 14 days after the screens ship, banner names the date (recommended); (b) 7 days; (c) switch on as soon as the screens ship.
- **Q2 A new organiser in a city that has an ambassador:** (a) goes to review (pending_review) on finishing, like events there do (recommended: matches the ambassador rule built today); (b) goes live anyway (D4 as written); (c) no ambassador city exists yet, decide later.
- **Q3 Selling tickets needs finished details:** (a) yes, same rule (recommended); (b) no, only events are locked.
- **Q4 Does "edit events" include cancelling or skipping a date:** (a) yes, every change (recommended: simplest, no loophole); (b) no, a person who has not finished can still cancel a date.

Out of scope (binding): see section 1 non-goals. Also out: rewriting `my_profile_progress_v1`, deleting R1
onboarding, admin UI for the audit table.

## RUN STATE (orchestrator updates this)

| Item | State 2026-10-28 |
|---|---|
| Plan | written (this doc, PR #1120), awaiting Fable read and owner answers Q1-Q4 |
| S1, S2, S6, S7, S8 | not started |
| S3 | merged (#1113, #1117) |
| S4 | admin #1101/#1103 open (not verifiable from here) |
| W4b build 1 | #1118 open, CI green, review PASS with notes |
| p5 command bodies lock | free |
| Flag `organiser_onboarding_gate` | does not exist yet |

## Next-session prompt (paste as is)

```
ARC: compulsory organiser onboarding. Read docs/plans/onboarding-arc.md (whole) and
docs/plans/onboarding-arc-evidence.md in 123constante/bachata-website (branch claude/p3-onboarding-arc-plan
or main once merged). You are the ORCHESTRATOR; cloud workers build (one per branch, max 2). Lane CAREFUL.
1. Ask the owner Q1-Q4 (section 10) as one batch of click questions; record answers in RUN STATE.
2. Re-run the E3 shape survey (counts only) and the E1 md5 reads; note any change.
3. Confirm admin contract-check is green (the #1096 / ledger state, E1d); if red, S1 waits.
4. Write the S1 brief (section 4.1, 8) to a brief/ branch; dispatch S1 (Opus, xhigh) in the admin repo.
5. After S1 is applied: take the p5 command bodies lock, record the six md5 pins, dispatch S2.
6. Hand Appendix A to the P3 orchestrator for W4b build 2 (Design Gate stage 1 brief + stage 2 mockups).
Never merge without the standing merge rule; never write prod data; stop on any new red.
```

---

## Appendix A. S5 screen specification for P3 W4b build 2

British English, HTML entities in JSX (`&mdash;`, `&rsquo;`), full weekday names, every tap target at least 44 px
in explicit px (html is ~13.5 px on phones), compact density, P3 look and primitives (`SheetView`, `Field`,
`PrimaryButton`, `GhostButton`, `EmptyState`, `ErrorState`). One question group per screen; progress line
"Step 3 of 7" counts only the steps this person must see. Continue saves; Back never loses saved answers.
Every screen pre-fills held values and lets the person change them.

**A0. Banner** (Home and Events, while `!complete`): "Finish your details to create and edit events." Button
"Continue" (44 px). Grace stage adds: "From Monday 16 November you&rsquo;ll need them." Hidden for admins and when complete.

**A1. Gate screen** (any create/edit entry, or an `onboarding_incomplete` refusal): title "A few details first";
body "We ask everyone who runs a page. It takes about five minutes and you only do it once."; list of the missing
groups; "Continue" + "Not now" (back to where they came from).

**A2. You** (dancer part). Fields: first name (text), city (search, existing `citySearch`), dance role (Leader /
Follower / Both, 3 buttons), photo (`AvatarUpload`), nationality (existing picker, full ISO + four home nations),
languages (existing tick list `LanguagePicker`, chosen at top), Instagram (handle, `@` optional, validated as today).
Only missing fields shown first; a "Show all" link reveals the rest. Error: "Couldn&rsquo;t save. Check your connection and try again." Disabled Continue reason: "Add your nationality to continue."

**A3. Do you teach?** Two 44 px buttons "Yes, I teach" / "No". If yes: styles (chips from the 14 teaching styles,
held values pre-ticked), years teaching (number 0-60), levels taught (Beginner, Improver, Intermediate, Advanced;
at least one). Optional, collapsed under "More (optional)": private lessons yes/no, where you teach (text).
Copy: "This shows on your teacher page." Answer "No" is saved and can be changed later from You.

**A4. Do you DJ?** "Yes, I DJ" / "No". If yes: genres (tags; at least one). Copy: "This shows on your DJ page."

**A5. Your page: <organiser name>** (one screen per organiser the person is completing; usually one). Logo
(upload), one link (website, Instagram or Facebook; at least one), city, Category (five options, one tap).
Name shown, editable as today (link "Change name" to the existing field). A manager sees the same screen.

**A6. Contact for <organiser name>.** Phone pre-filled: "Is this the best number? 07&hellip;" with "Yes, that&rsquo;s right"
(one tap) or "Change". Missing phone: phone field. Existing public switches unchanged. Contact email shown read-only:
"Email: set by the Bachata Calendar team" or the held value; never asked.

**A7. About <organiser name>** (recommended, skippable): one text box; starter sentence from
`starterSentence(category, city, styles)` (never invents a fact; omits what is missing), "Use this" / "Skip for now".

**A8. Done.** Draft organiser: "You&rsquo;re live" (after S6) or "Sent for review" (Q2 a, ambassador city). Live organiser:
"All done. You can create and edit events now." Button "Add an event". Home "Page completion" card gains an About row.

**States for every screen:** loading (skeleton, no layout jump); read failed ("We couldn&rsquo;t load your details. Try again." +
Retry); offline save (keep input, show the error, Continue stays enabled); admin (never routed here); status says
complete (screen not shown; deep link goes to Done).
