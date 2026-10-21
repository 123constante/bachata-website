# ER-AD1 (admin repo `123constante/bachata-admin`): server pieces for the organiser rebuild

OUTSIDE the cards (needs migrations). OPUS author. Branch `claude/er-ad1-admin`, BASE = `claude/people-release-b-admin` (admin PR #902; migrations 20261129530000-20261129660000 and the function bodies you must port onto are there). Nothing is merged or applied: the owner applies at the end. Read `docs/organiser-rebuild/briefs/ER-COMMON.md` hard limits (Supabase READ-ONLY, plain git, no gh api) and `ER-INTERFACE.md` (the names you implement). Admin CI bills: push ONCE (plus a PARTIAL push); the orchestrator adds the `run-ci` label.

## Reserved migration versions (do not pick others)
- 20261129680000 `payment_methods` owner upsert + create keys; re-pin the allowlist guard md5s; code validation.
- 20261129690000 `owner_create_venue_draft_v1`, `owner_similar_venues_v1`.
- 20261129700000 festival artists storage + set/get (check existing structures FIRST; new table only if none fits; record the choice).
- 20261129710000 `series_organiser_invites` table + invite/cancel/respond/leave/remove/list RPCs + permission model (extend the existing SeriesOrganisers storage and `series.set_organisers`; do not replace them).
- 20261129720000 `series_go_live_check_v1` extended (new blocker codes in ER-INTERFACE.md section 2).

## Binding collision rules (PLAN.md COLLISION RULES)
Port onto the #902 BODIES, never main's older bodies, for any of: `_organiser_create_allowed_v1`, `_person_is_organiser_v1`, `get_public_person_organisers_v1`, `save_my_organiser_profile_v1`, `admin_save/get/search_person_v1`, `_dancer_whatsapp_eligible_v1`, `_my_dancer_edit_shape_v1`, `_stub_retire_blocker_v1`, `admin_dashboard_people_health_v1`. NEVER read `person_roles.role = 'organising'` (guard `check_person_organiser_derived_v1` reds it). Organiser = owner/manager seat (`entity_members`) or active public team row.

## Tests (the repo's SQL/db test pattern, plus the contract guards)
co-organiser edit allowed; co-organiser end / stop repeating / delete draft / cancel one-off / remove organiser refused; non-member refused; invite to an already-linked page refused; invite by a non-organiser refused; accept by the wrong team refused; leave by the owner refused; version conflict refused; duplicate venue (exact name+postcode) returns the existing one; venue draft is `draft`, not public; unknown payment code refused; every blocker code of the go-live check with a fixture; festival artists replace-list round trip; every new function has `search_path` set and no anon execute. Run the red-first proof for each refusal.

## Do not
No prod write. No change to the admin editor screens (card ER-C13 does those). No `person_roles 'organising'`.

## Handover (`docs/organiser-rebuild/er/handover/ER-AD1.md`)
Final signatures as built (vs ER-INTERFACE.md), storage choice for festival artists, the order to apply, rollback notes, what was proven locally and what needs the live database.
