# Bristol ambassador audit (2026-10-29)

Read-only audit. No code, no migration, no prod write. Ticket `dt_12ce4e13f0e8`,
brief `docs/briefs/bristol-ambassador-audit.md` on `brief/bristol-ambassador-audit`.

## Evidence sources and their limits

- **Live DB** (prod `stsdtacfauprzrdebmzg`, SELECT only): function bodies via
  `pg_get_functiondef` / `prosrc`, constraints via `pg_constraint` / `pg_indexes`,
  policies via `pg_policies`, and counts. Line numbers quoted as `fn:N` are lines of
  the function's live `prosrc` (split on newline, 1-based), not migration-file lines.
- **Website repo** (this repo, `main` at `2f81eec`): file:line as usual.
- **NOT read: the admin repo** (`bachata-admin-11april`). `add_repo` returned
  "you don't have access" for this session, so I could not cite migration files or
  read the A0a/A0b vitest/pgTAP files. The live functions are the deployed truth;
  the tests below are the two DB self-check functions, which are the contract.
  **Not verified:** that the admin repo's migration text matches the live bodies.

---

## 1. What already exists

### The role

- `entity_members.member_role` CHECK allows `owner|manager|contributor|ambassador`
  (`entity_members_member_role_check`), and `entity_members_ambassador_city_only`
  = `member_role <> 'ambassador' OR entity_type = 'city'`. Unique key is
  `(entity_type, entity_id, user_id, member_role)`.
- **No "one city per ambassador" rule.** Nothing stops one user holding
  `ambassador` on two cities (unique key includes `entity_id`). Gap.
- Granted only by `admin_add_entity_member_v1` (admin path: `:64` via
  `_entity_member_write_p5`; `:17-18` raises `ambassador_only_on_city`). Listed by
  `admin_list_ambassadors_v1` (admin only, `:3-4`).
- Helper `_is_city_ambassador(city, user)` = `_is_entity_member('city', city, user, ['ambassador'])`.

### Review gate (A0b)

- `_city_requires_review_p5(city)` = **"the city has at least one ambassador"**. That
  single fact switches review on for a city; there is no separate flag.
- Pages: `create_organiser_profile_v1:84-87` creates `pending_review` in an
  ambassador city (admin exempt), else `live`. `complete_organiser_onboarding_v1:39-42`
  same rule. `submit_organiser_profile_v1:32-38` is the explicit submit.
- Events: `_cmd_series_set_lifecycle_p5:55-68` rewrites a non-admin go-live of a
  draft/rejected series to `pending_review` when `_series_requires_review_p5` is true;
  `tg_enforce_lifecycle_transition:36-43` refuses a direct draft/rejected → live there.
  The series' review city is `COALESCE(default_city_id, venue's city, the organisers'
  single shared city)` (`_series_review_city_p5`).
- `tg_review_city_move_p5`: moving a live/paused page or series INTO an ambassador city
  re-holds it (and sets a self-serve page `is_active=false` until approval).
- `tg_enforce_lifecycle_transition:15-17`: nothing enters `pending_review` without a city.

### Moderation (A0a)

- `admin_approve_entity_v1(type, id, reason)` → `_moderate_entity(..., 'live', 'approve')`.
- `admin_reject_entity_v1(type, id, reason)` → `reason_required` if blank, then
  `_moderate_entity(..., 'rejected', 'reject')`.
- `_moderate_entity`: non-admin must be ambassador of the target's city, else
  `not_authorised` (no existence leak); **no self-approval** via
  `_actor_is_party_to_target_p5` (owner/manager/contributor, creator, claimer, or
  whoever submitted it); target must be `pending_review`; writes
  `entity_decision_audit`. Admin bypasses city and self-approval checks.
- `admin_list_pending_review_v1`: admin sees all; an ambassador sees only rows where
  `_is_city_ambassador(q.city_id, actor)`; submitter email is admin-only. Ordered by
  `updated_at` (as `submitted_at`).
- Rejected → owner can go back to draft or pending_review
  (`tg_enforce_lifecycle_transition:62`), i.e. fix and resubmit already works.
- Website copy exists for the states: `src/modules/organiser/shared/eventState.ts:28`
  (`'In review'`), `:30` (`'Changes needed'`); `src/modules/organiser/shared/organiserStatus.ts:6-7`
  treats a page in `pending_review`/`rejected` "like a paused page: ask the team".
- **Tests:** `check_ambassador_moderation_v1()` and `check_ambassador_review_gate_v1()`
  exist live (self-checks over `_moderate_entity` and the gate). Neither is run by this
  repo's `db-contract-check.yml` (grep: no hit) — presumably from admin CI; not verified.

### Decisions vs what exists

| Owner decision | Status | Evidence |
|---|---|---|
| Organisers join freely; page + events held | **Done** (only once the city has an ambassador) | `_city_requires_review_p5`, create/complete/`_cmd_series_set_lifecycle_p5:55-68` |
| Ambassador approves/rejects own city, pages AND events | **Done** | `_moderate_entity`, `admin_list_pending_review_v1` |
| Owner/admin overrides everything | **Done** | admin bypass in `_moderate_entity`, `admin_set_*_lifecycle_v1` |
| Ambassador's own events skip review | **Missing — today the opposite** | Ambassador's own series goes `pending_review` and self-approval is forbidden, so only the admin can release it |
| Rejection reason from a short list | **Missing** | free text, only non-blank enforced (`admin_reject_entity_v1`) |
| Organiser can fix and resubmit | **Done** | `tg_enforce_lifecycle_transition:62` |
| Removal/suspension owner-only | **Partly** | ambassador can only move `pending_review → live/rejected`; pause/archive arms are owner(entity)/admin. Not verified: whether an ambassador can reject an already-live item (no — `_moderate_entity` requires `pending_review`) |
| 3-day escalation to owner | **Missing** | no function mentions escalat*; 16 cron jobs exist, none for this (not inspected individually) |
| Permanent personal invite link | **Missing** | see §2 |
| Tracker (invited/joined/set city) | **Missing** | no `invited_by` on organiser_profiles/person; only `series_organiser_invites.invited_by` |
| Badge "<City> ambassador" | **Missing** | no public/get_* function references `ambassador` |
| One city per ambassador | **Missing** | no constraint |
| City inactive until owner activates | **Done as data**, but see §3 | `cities.is_active` default false |

---

## 2. Invite plumbing

`organiser_invites` (live columns): `organiser_id NOT NULL, token_hash (sha256, unique),
issued_by, issued_at, expires_at, used_at, used_by, revoked_at, revoked_by, email,
prefill_first_name, prefill_city_id, bound_via, person_profile_id`.

- **It is a claim-this-page invite**, not a join link: `organiser_id` is NOT NULL,
  single use (`used_at`), one live link per page
  (`organiser_invites_one_open_uidx ON (organiser_id) WHERE used_at IS NULL AND revoked_at IS NULL`).
- Expiry: `admin_issue_organiser_invite_v1:59` `now() + interval '7 days'`;
  CHECK `expires_at > issued_at`; open-check `now() < expires_at` in
  `redeem_organiser_invite_v1:44`, `_join_bound_invite_v1:35`, `organiser_invite_preview_v1:18,25`.
- Admin-only gate: `admin_issue_organiser_invite_v1:11` (`_self_serve_is_admin()`).
- `prefill_city_id`: validated only for existence (`:26`, no `is_active`), stored, and
  handed back as a **prefill** (`redeem_organiser_invite_v1:45`,
  `_join_bound_invite_v1:62`, `organiser_invite_preview_v1:33`) — the client decides
  whether to use it; nothing writes it to the joiner's page.
- Rate limits and audit on redeem (`organiser_invite_redeem_attempts`, `:92`, `:118`, `:182`).

**Smallest change for a revocable permanent per-ambassador link** — do NOT stretch
`organiser_invites` (would need `organiser_id` nullable, multi-use, no expiry: three
invariants every existing reader relies on). Instead, a new small table + 4 RPCs,
admin repo:

```
ambassador_links(id, ambassador_member_id -> entity_members.id, city_id, token_hash unique,
                 created_at, disabled_at, disabled_by)
  unique (ambassador_member_id) where disabled_at is null    -- one live link
organiser_profiles.invited_via_link_id uuid null -> ambassador_links.id  -- the tracker key
```

- `ambassador_link_get_or_create_v1()` (ambassador for own city, or admin for any):
  returns the live link; `ambassador_link_set_enabled_v1(link_id, bool)` (ambassador
  own / admin any) = the switch-off.
- `ambassador_link_preview_v1(token)` (anon): `{valid, city_name, ambassador_first_name}`.
- Joining: the organiser create path (`create_organiser_profile_v1` /
  `organiser_start_v1`) accepts an optional `p_link_token`; when valid it **forces**
  `city_id := link.city_id` and stamps `invited_via_link_id`. Server-side, so no
  picker is involved (this is also the §3 fix).
- "Invited" count for the tracker = link opens are not people; propose the tracker
  counts **previews** (`ambassador_link_views`, no PII, rate-limited) as "opened",
  pages with `invited_via_link_id` as "joined", and `city_id = link.city` as "set the
  city" (always true for link joins; becomes meaningful only if the organiser later
  moves city).

---

## 3. Joining by link into an inactive Bristol

Live: `Bristol is_active = false`; 1 of 319 cities active (London).

Filters on `cities.is_active` in live functions (full grep of `prosrc`):
`search_cities:13`, `is_valid_city_slug:6`, `get_public_teachers_list_v1:31`,
`search_public_v5/v6/v7` (city match + city-name list), and the analytics
`admin_search_queries_zero_with_city_v1`. Everything on the organiser path checks
**existence only**: `create_organiser_profile_v1:34`, `_series_go_live_check_p5:21`,
`admin_issue_organiser_invite_v1:26`; `organiser_start_v1:69` maps `city_not_found`.
`cities` RLS `Public read` is `qual = true`, so reading Bristol's name by id works anon.

Website: the organiser city search uses `search_cities`
(`src/modules/organiser/home/onboarding/citySearch.ts:16`,
`src/modules/organiser/edit-in-place/CitySheetBody.tsx:6`), as do the shared pickers
(`src/components/ui/city-picker.tsx:93`, `MobileCityPicker.tsx:74`,
`DesktopCityPicker.tsx:93`) — so Bristol cannot be TYPED by anyone. The dancer quick
chips deliberately skip the filter (`src/modules/organiser/home/onboarding/dancer4/dancer4Api.ts:5-6,36`).

**Smallest safe fix:** do not touch `search_cities` (it also feeds the public
pickers; widening it would leak inactive cities into public search). The link sets
the city server-side (§2), and the Website shows the city as a fixed chip read by id
from `cities`. Consequences to accept or design:

- An organiser who joined via link and later opens the city sheet cannot find
  Bristol to re-select it; the sheet must show the current city even when it is not in
  search results (check `CitySheetBody` — **not verified** how it renders a current
  city absent from results).
- An organiser page in an inactive city: existing shape (Paris, Turku, Buenos Aires
  each have 1 live organiser in an inactive city) — pages render; no RPC refused them.
  `/city/bristol` 404s via `is_valid_city_slug` until activation (intended).
- **Not verified:** event discovery/calendar RPCs for a series whose city is inactive
  (I grepped for `is_active` on cities only; a filter through a view or a different
  alias would be missed). Needs one targeted check before the Website slice.

---

## 4. Live data shapes (counts only)

| Fact | Count |
|---|---|
| ambassador rows in `entity_members` | **0** (0 users, 0 cities) |
| Bristol | exists, `is_active=false`; 0 dancers based there, 0 series |
| cities | 319 total, 1 active |
| organiser_profiles by lifecycle | live 49 (no pending/rejected) |
| organisers per city | London 46, Paris 1, Turku 1, Buenos Aires 1 (all but London inactive) |
| event_series_p5 by lifecycle | archived 653, live 69, ended 21, draft 13, paused 2; **0 pending_review / rejected** |
| organiser_invites | open 2, used 4, expired 3, revoked 1; 1 with `prefill_city_id` |
| entity_decision_audit | 705 rows; `approve` 6, `submitted` 4, `reject` 0 |

So the whole review machinery is **dormant**: it switches on the moment the first
ambassador row is written for a city. Granting a London ambassador today would hold
every London organiser's next go-live — Bristol-only rollout is safe because Bristol
has 0 organisers and 0 series.

---

## 5. Proposed slices

Lanes: careful = SQL / auth / gate; normal = UI on existing RPCs. Model per the
CLAUDE.md rule (SQL/guards → xhigh); the per-PR routing table
(`feedback_model_effort_matrix.md`) is in project memory, not readable from this
session, so the model column is a proposal.

| # | Repo | Slice | Lane | Model / effort | Design Gate |
|---|---|---|---|---|---|
| A1 | admin DB | One city per ambassador (partial unique on `entity_members(user_id) WHERE member_role='ambassador'`) + ambassador's own series/page skip review (in the gate: actor is ambassador of the review city → `live`; audit it as `auto_approved_ambassador`) | careful | Opus xhigh | no |
| A2 | admin DB | Reject reason list: `reason_code` CHECK list + optional note; `admin_reject_entity_v1` keeps text for back-compat | careful | Opus xhigh | **yes** (reason list copy) |
| A3 | admin DB | `ambassador_links` + 4 RPCs + `invited_via_link_id`; create path takes `p_link_token` and forces city | careful | Opus xhigh | no |
| A4 | admin DB | Tracker RPC `ambassador_tracker_v1` (ambassador own city / admin any; counts + names of joined pages, no emails) | careful | Opus xhigh | no |
| A5 | admin DB | 3-day escalation: pg_cron daily → owner notification row/email for `pending_review` older than 3 days (by entry-into-pending audit time, not `updated_at`) | careful | Opus xhigh | no |
| A6 | admin DB | Public badge: `ambassador_city_name` on public organiser/person reads, and `approved_by_ambassador` on event detail from the `approve` audit row | careful | Opus high | **yes** (badge) |
| W1 | Website | `/join/a/:token` landing (preview → sign-in → organiser start with locked city chip) | careful (auth path) | Opus high | **yes** |
| W2 | Website | Ambassador review screen (list + one-tap approve, reject with reason list) | normal | Sonnet high | **yes** (held state + reason list) |
| W3 | Website | Ambassador tracker + link card (copy/share, switch off) | normal | Sonnet high | **yes** (tracker) |
| W4 | Website | Organiser held state: "In review" / "Changes needed: <reason>" + resubmit on page and event | normal | Sonnet high | **yes** (held state) |
| W5 | Website | Badge on profile and on events next to approver name | normal | Sonnet medium | **yes** (badge) |
| W6 | Website | City sheet shows current inactive city (§3) | normal | Sonnet medium | no |

Order: A1 → A3 → W1 is the critical path to "first Bristol organiser joins". A2/W2/W4
before the first ambassador row is written (otherwise rejections carry free text the
UI cannot show). A5/A6/W5 can follow launch.

---

## 6. Risks and owner questions

Risks:
- **Activating review is a single row.** Writing any ambassador row flips the gate for
  that city with no flag; a mistaken London grant holds 46 organisers' next edits.
  Mitigation: A1 could add `cities.review_enabled` — but that is a new decision, so
  it is Q1 below.
- Self-approval ban vs own-events-skip must not open a hole: skip only when the
  actor is the ambassador AND the review city equals their city; an organiser page
  co-owned with an ambassador must still go to review (or to the owner). A1 needs a
  matrix test over co-owned series.
- `admin_list_pending_review_v1` orders and (later) escalates on `updated_at`; an
  edit to a held item resets the clock. Escalation must use the entry-into-pending
  audit time.

Questions (click options):

**Q1. What turns review on for Bristol?**
- (a) Appointing the ambassador does it (today's behaviour; simplest).
- (b) A separate owner switch per city, so you can appoint first and turn review on later.

**Q2. When an ambassador co-runs an event with another organiser, does it skip review?**
- (a) Yes — any event the ambassador is on goes live.
- (b) Only events where the ambassador is the sole organiser; co-run events go to you (owner).

**Q3. Who sees the "invited" count on the tracker?**
- (a) Count link opens as "invited" (anonymous, no names).
- (b) Show only "joined" and "set the city" (no open-tracking at all).

---

## Verified / Not verified

Verified (live DB reads + this repo): every function body, constraint, index and
policy quoted above; all counts in §4; Website file:line refs.

Not verified: admin repo migration files and the A0a/A0b test files (no access);
event discovery RPCs for inactive-city series beyond the `cities.is_active` grep;
how `CitySheetBody` renders a current city missing from search results; the 16 cron
jobs individually.
