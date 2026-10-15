# Dancer Account Rebuild: PINNED INTERFACE (release 1a, PR A1 + PR B1a)

Status: pinned by the orchestrator on 2026-10-15 from the approved plan
(`briefs/dancer-rebuild-PLAN.md`, sections 4.2, 4.3, 5, 6). Every worker codes AGAINST this file.
A builder who finds a reason to deviate does NOT deviate silently: it keeps the pinned name/shape,
writes the reason under "INTERFACE deviations" in its handover, and the orchestrator decides.
The database wins over this file ONLY for an existing column's real name (verify read-only, record it).

Repos: admin = `123constante/bachata-admin` (private), Website = `123constante/bachata-website` (PUBLIC:
never commit a secret). Prod Supabase `stsdtacfauprzrdebmzg` (READ-ONLY for every worker). E2E Supabase
`srrpvuxldthwumzrngla` (writes allowed; it is the rehearsal database once A1 step 0 brings it to parity).

Migration versions reserved for PR A1 (never hand-pick, never renumber below these):
M1 `20261121060000`, M2 `20261121070000`, M3 `20261121080000`, M4 `20261121090000`.

## 1. Gate (M1)

Table `public.dancer_area_access`
- `id uuid pk default gen_random_uuid()`, `email text not null` (CHECK `email = lower(btrim(email))`, same
  shape CHECK as `signup_allowlist`), unique index on `lower(email)`, `added_by uuid references auth.users
  on delete set null`, `added_at timestamptz not null default now()`, `note text` (<= 500),
  `user_id uuid null references auth.users(id) on delete cascade` (stamped on the first allowed write by
  that user; never required).
- RLS enabled, NO policy for anon/authenticated, NO grant to anon/authenticated (revoke BY NAME, both
  roles; `REVOKE FROM PUBLIC` alone is a no-op here). Readable only by postgres/service_role and through
  the RPCs below.

Flag: `public.app_feature_flags` row with key `dancer_area_open` (boolean false by default; insert the
row if absent, `ON CONFLICT DO NOTHING`). Written only by `admin_dancer_area_set_open_v1`.

RPCs (all `SECURITY DEFINER`, owner postgres, `SET search_path = ''`; revoke EXECUTE from PUBLIC, anon,
authenticated BY NAME first, then grant exactly what each line says):
- `dancer_area_gate_v1() returns jsonb` -> `{"open": bool, "allowed": bool}`. GRANT anon, authenticated.
  `allowed` = `open` OR (caller signed in AND the caller's auth email, lowercased, is on
  `dancer_area_access`). Signed-out: `{open, allowed: open}`. Never returns the list, the email, or
  anything else.
- `_dancer_area_allowed_v1() returns boolean` internal (no client grant). Same rule as `allowed`.
- `_dancer_area_require_v1() returns void` internal: raises `area_closed` (ERRCODE 42501, MESSAGE
  'area_closed') when `_dancer_area_allowed_v1()` is false. EVERY new member-facing RPC below calls it
  first.
- Admin (each checks `public.is_admin()` first, raises 42501 'admin_only' otherwise; each writes one
  `entity_decision_audit` row the way `admin_signup_allowlist_add_v1` does):
  - `admin_dancer_area_access_add_v1(p_email text, p_note text default null) returns jsonb` ->
    `{"id", "email", "added_at", "note", "already_listed": bool}`; normalises lower(btrim). Idempotent.
  - `admin_dancer_area_access_remove_v1(p_email text) returns jsonb` -> `{"removed": bool}`.
  - `admin_dancer_area_access_list_v1() returns jsonb` -> `{"open": bool, "count": int, "rows": [{"id",
    "email", "added_at", "note", "user_id_linked": bool}]}` ordered by added_at desc.
  - `admin_dancer_area_set_open_v1(p_open boolean) returns jsonb` -> `{"open": bool, "changed": bool}`.
    On `changed`, calls `public._emit_cache_revalidation_v1(...)` with the dancer page tags the existing
    dancer-profile writers use (copy the exact call from `save_my_dancer_profile_v1`'s purge path).
  - GRANT authenticated on the four admin RPCs (the `is_admin()` check is the gate, as every other
    `admin_*` RPC in this repo does; copy the ACL block of `admin_signup_allowlist_add_v1`).
- Guard `check_dancer_area_contract_v1() returns jsonb` (anon-callable, read-only, SECURITY INVOKER,
  `healthy` key; executor `scripts/check-anon-guard-batch.mjs`, registered in `guards.json`): asserts
  RLS on, no client grants on the table, the flag row exists, the ACL of every RPC in this file, and
  that `dancer_area_gate_v1` is anon-callable.

Behaviour matrix (pinned, tested by both repos): closed + not listed = today's site, `allowed=false`;
closed + listed = `allowed=true`; open = `allowed=true` for everyone incl. signed-out.

## 2. Columns (M2)

`ALTER TABLE public.dancer_profiles ADD COLUMN IF NOT EXISTS bio text` (CHECK `bio IS NULL OR
char_length(bio) <= 280`) and `ADD COLUMN IF NOT EXISTS show_whatsapp_publicly boolean NOT NULL DEFAULT
true`. NO column grant to anon or authenticated (grants on this table are COLUMN-level; the
contact-lockdown guard must stay green: run it). Reads go through RPCs only.

## 3. Member RPCs (M3)

Error codes (raised with `RAISE EXCEPTION USING ERRCODE = '<code>', MESSAGE = '<name>'`; the Website maps
`error.message` -> copy):

| name | errcode | when |
|---|---|---|
| `area_closed` | 42501 | caller not allowed by the gate |
| `not_signed_in` | 42501 | no auth.uid() |
| `no_profile` | P0002 | `_my_dancer_profile_id_v1()` is null |
| `rate_limited` | 54000 | `_member_rate_check_v1` refused |
| `invalid_display_name` | 22023 | not 1..40 chars after trim, or contains `http`, `://`, `@`, control chars |
| `first_name_required` | 22023 | payload tries to clear `first_name` |
| `city_required` | 22023 | payload tries to clear `based_city_id` or names an unknown city |
| `photo_required` | 22023 | payload tries to clear `avatar_url` |
| `bio_too_long` | 22023 | > 280 chars |
| `bio_has_link` | 22023 | bio contains `http://`, `https://`, `www.` or a `.tld/` pattern |
| `invalid_handle` | 22023 | instagram/facebook value fails the existing normaliser's rules |
| `invalid_url` | 22023 | website_url not http(s) |
| `invalid_year` | 22023 | dance_started_year outside 1950..current year |
| `whatsapp_not_allowed` | 42501 | whatsapp or show_whatsapp_publicly sent by a person with no other profile type |
| `invalid_role` | 22023 | dance_role not in the existing CHECK set |

`my_dancer_edit_v1() returns jsonb` (GRANT authenticated; calls `_dancer_area_require_v1()`):
```
{
  "profile_id": uuid, "user_id": uuid,
  "display_name": text|null, "first_name": text|null, "surname": text|null,
  "hide_surname_publicly": bool,
  "based_city_id": uuid|null, "city_name": text|null,
  "dance_role": text|null,            // existing CHECK values of dancer_profiles.dance_role
  "nationality": text|null, "languages": text[] (never null; [] when none),
  "bio": text|null,
  "instagram": text|null, "facebook": text|null, "website_url": text|null,
  "whatsapp": text|null,              // ONLY when other_roles is non-empty, else null and never sent
  "show_whatsapp_publicly": bool,
  "avatar_url": text|null,
  "dance_started_year": int|null,
  "favorite_styles": text[], "favorite_songs": text[], "achievements": text[],   // [] when none
  "other_roles": text[],              // active person_roles other than 'dancing', e.g. ["teaching","djing"]
  "is_active": bool,                  // false = paused via my_profile_disable_v1
  "erase_requested_at": timestamptz|null,   // always null in release 1a (A2 fills it)
  "linked_from_admin": bool,          // dancer_profiles.source = 'admin_create' AND claimed_by = me
  "complete": bool,                   // = profile_complete_v1(profile)
  "strength": {"pct": int, "next_step": text|null, "missing": text[]}
}
```
`strength.missing` values and `next_step` are drawn from this fixed vocabulary, in this priority order:
`first_name`, `city`, `role`, `photo`, `started_year`, `styles`, `bio_social`. `next_step` = the first
missing item, null at 100.

`_dancer_strength_v1(p_profile_id uuid) returns jsonb` (internal; the ONLY place the formula lives):
10 base; +15 each for first_name, based_city_id, dance_role, avatar_url (= 70 exactly when all four);
extras counted ONLY when all four exist: +10 dance_started_year, +10 favorite_styles non-empty,
+10 (bio non-empty AND at least one of instagram/facebook/website_url). Max 100.
INVARIANT: `pct >= 70 <=> profile_complete_v1(profile)`; pinned by a table test over every section-3 shape.

`save_my_dancer_profile_v2(p_payload jsonb) returns jsonb` (GRANT authenticated; returns the
`my_dancer_edit_v1()` shape after the save). Diff-first:
- Accepted keys: `display_name, first_name, surname, based_city_id, dance_role, nationality, languages,
  bio, instagram, facebook, website_url, whatsapp, show_whatsapp_publicly, hide_surname_publicly,
  avatar_url, dance_started_year, favorite_styles, favorite_songs, achievements`. Unknown key ->
  22023 `unknown_key`.
- ABSENT key = leave as is. JSON `null` or `""` (or `[]` for arrays) = clear, EXCEPT `first_name`,
  `based_city_id`, `avatar_url` which are replace-only (clearing raises the `*_required` code).
- Reads the current row + sidecar, computes the delta; if the delta is EMPTY it returns WITHOUT any
  write (no `updated_at` bump, no person_role insert, no cache purge). Order: gate -> rate check only
  when the delta is non-empty -> validation -> write.
- Non-empty delta: calls `save_my_dancer_profile_v1` in the same transaction with ONLY the changed keys
  v1 handles (never with a key v1 would COALESCE back), and writes the keys v1 cannot
  (display_name, languages, bio, facebook, whatsapp, show_whatsapp_publicly, clears of
  dance_started_year / scalars) directly. v1 is NEVER edited.
- Any public-field change emits `_emit_cache_revalidation_v1` for the dancer page tags (same call as v1).
- Rate check: `_member_rate_check_v1('profile_save', 60, interval '1 hour')` on non-empty deltas.

`get_public_dancer_extras_v1(p_profile_id uuid) returns jsonb` (GRANT anon, authenticated; read-only):
`{"bio": text|null, "languages": text[], "whatsapp": text|null}` where `whatsapp` is non-null ONLY when
`show_whatsapp_publicly` AND the person has another active profile type AND the profile is live
(`is_active`, not archived, not deactivated). Returns `null` (SQL NULL) for a hidden/paused/archived/
unknown profile. Never raises for an unknown id.

Rate helper (M3): table `public.member_action_attempts(id bigserial pk, user_id uuid not null references
auth.users(id) on delete cascade, action text not null, created_at timestamptz not null default now())`,
index `(user_id, action, created_at desc)`, RLS on, no client grants.
`_member_rate_check_v1(p_action text, p_limit int, p_window interval) returns void` internal: counts the
caller's rows for `p_action` newer than `now() - p_window`; raises `rate_limited` when `count >= p_limit`;
otherwise inserts one row. Guard `check_member_rate_limit_contract_v1` (ACL + RLS + no client grants).

## 4. md5 pin guard (M4)

`check_dancer_rebuild_untouched_v1() returns jsonb` (anon-callable, SECURITY INVOKER, `healthy`):
md5(prosrc) of each function below, measured on prod READ-ONLY by the A1 worker on the day and written
into the migration as constants (CR-stripped; see the repo's md5 memory notes): `save_my_dancer_profile_v1`,
`claim_my_dancer_profile_v1`, `_my_dancer_profile_id_v1`, `set_attendance`,
`set_my_occurrence_attendance_p5_v1`, `my_account_erase_v1`, `my_account_erase_check_v1`,
`_account_erase_refusal_v1`, `my_account_export_v1`, `my_profile_disable_v1`, `admin_save_person_v1`,
`admin_get_person_v1`, `_public_surname_v1`, `_public_display_name_v1`, `get_public_dancer_names_v1`,
`rate_series_level_p5_v1`, `series_level_summary_p5_v1`, `get_my_event_attendance_v2`,
`profile_complete_v1`, `_require_complete_dancer_profile_v1`, `record_profile_view_v1`,
`hook_before_user_created_allowlist_v1`, `check_account_erase_contract_v1`.
A function that does not exist on prod under that exact name is reported in the handover, not invented.

## 5. Website routes and folders (PR B1a)

Routes (all inside ONE lazy chunk `dancer-app`, all `noindex`, all behind `AuthGuard` + the gate):
`/app` -> redirect `/app/home`; `/app/welcome` (onboarding), `/app/home`, `/app/nights`, `/app/me`,
`/app/me/edit`, `/app/me/photo`, `/app/options`. (B1b adds `/app/page`; B2 adds `/app/options/*` and
`/join/:token`.) Every route is listed in `src/components/catchallClientPaths.ts` and `public/robots.txt`
gets `Disallow: /app/`.

Folders under `src/modules/dancer-app/` (each wave-2 slice owns exactly one `screens/<name>/` folder):
```
shell/        DancerAppShell.tsx (header: logo top-left -> "/", "Events" top-right -> "/" events; bottom
              tabs Home/Nights/Me/Options; profile-type label), DancerAppRoutes.tsx, renderInShell test util
theme/        dancer.css (one CSS custom-property set scoped to [data-profile="dancer"]), tokens.ts
gate/         useDancerArea.ts, RedirectIfAllowed.tsx, (B1b: useGoingLock.ts)
api/          rpc.ts (typed wrappers via rpcLoose), fakeBackend.ts (in-memory, every section-3 shape as a
              named fixture), errors.ts (code -> copy map, ONE mapping), types.ts (the shapes in section 3)
analytics/    events.ts (the funnel event names; W1 adds them to src/lib/analytics.ts AnalyticsEventMap)
screens/onboarding/   (W2a)   screens/home/ + screens/nights/   (W2b)
screens/me/ + screens/edit/   (W2c)   screens/photo/   (W2d)   screens/options/   (W2e)
```

Gate hook contract (W1 exports, wave 2 imports; never re-implemented):
- `useDancerArea(): { status: 'loading'|'ready'|'error', open: boolean, allowed: boolean }` — react-query,
  key `['dancer-area-gate', userId ?? 'anon']`, staleTime 60s, `enabled` ONLY when signed in (a signed-out
  visitor makes NO request and gets `{status:'ready', open:false, allowed:false}`). Error = fail CLOSED
  (`allowed:false`).
- `RedirectIfAllowed({ children })`: renders `children` (today's element) unless the person is signed in,
  `allowed`, and NOT organiser-type (uses the exact same organiser check `src/pages/Account.tsx` uses,
  IMPORTED, never copied); when allowed it `<Navigate replace>` to `/app/home` (or `/app/welcome` when
  `ProfileGateContext` says incomplete). While `loading`, render `children` (today's page) — never a
  blank screen.
- `api/rpc.ts` exports: `fetchMyDancerEdit()`, `saveMyDancerProfile(delta)`, `fetchGate()`,
  `fetchPublicExtras(id)`; each typed against `api/types.ts`; each maps RPC error messages through
  `api/errors.ts`. Tests use `fakeBackend.ts` through the same wrappers (`setFakeBackend()`).
- `analytics/events.ts`: `dancer_app_entered`, `onboarding_step` ({step}), `profile_strength_70`,
  `first_going_tap`, `first_level_vote`, `feedback_sent`; fired through `trackAnalyticsEvent`, NEVER for a
  signed-out visitor.

Seams (the ONLY existing Website files PR B1a may change; R0's isolation check enforces this list):
1. `src/components/AnimatedRoutes.tsx`: lazy `/app/*` chunk; `RedirectIfAllowed` wraps the `/account`,
   `/account/dancer` and `/finish-profile` route ELEMENTS (not the routes).
2. `src/components/AppChrome.tsx`: hide GlobalHeader / BottomNav / footer / spacers on `/app/*`.
3. `src/lib/profileCompletion.ts`: `BANNER_HIDDEN_ON` += `/app`; `src/components/profile/
   ProfileCompletionChrome.tsx` only if strictly needed (say why).
4. `src/components/catchallClientPaths.ts` + `tests/catchallClientPaths.test.ts`; `public/robots.txt`;
   `package.json` (`test:e2e` spec list only); `perf-budgets.json` (one row for the lazy chunk);
   `src/lib/analytics.ts` (new `AnalyticsEventMap` entries only).
8. `.github/workflows/unit-tests.yml` (new) + `scripts/check-dancer-area-isolation.mjs` (new) — R0 only.
Protected (NEVER changed in B1a): `src/pages/Account.tsx`, `src/pages/AuthCallback.tsx`,
`src/components/account/DancerProfileGate.tsx`, `AuthGuard`, `src/components/account/DancerHome.tsx`,
`src/pages/FinishProfile.tsx`, `DancerDashboard`, `EditProfile`, `EventAttendanceButtons`,
`useAttendance.ts`, `useOccurrenceRsvp.ts`, `src/pages/AccountSettings.tsx`, `src/lib/accountSettings.ts`,
`src/hooks/useMyProfileVisibility.ts`, `src/components/profile/HideSurnameSwitch.tsx`,
`src/components/account/HideSurnameCard.tsx`, `src/lib/publicDancerNames.ts`,
`src/pages/PracticePartners.tsx`, `app/routes/sitemap.tsx`, `src/pages/Auth.tsx`,
`src/components/auth/AuthStepper.tsx`, `src/pages/DancerProfile.tsx`, `app/routes/dancers.tsx`,
`src/modules/event-page/bento/blocks/RsvpBlock*.tsx`, `src/pages/FestivalHub.tsx`.

## 6. Admin Beta-access screen (A4-lite)

Route `/beta-access` (admin app, sidebar entry "Beta access" under the people/settings group the sidebar
already has). Reads `admin_dancer_area_access_list_v1`; add form (email + optional note) ->
`admin_dancer_area_access_add_v1`; per-row Remove with confirm -> `..._remove_v1`; Open/Close switch
with a confirm dialog that states the consequence ("Opens the new dancer area and public page v2 to
everyone") -> `admin_dancer_area_set_open_v1`. Every state: loading, error (with the RPC code),
empty ("No one is on the list yet. Add an email above."), long list. Codes against this file; its tests
mock the four RPCs with these shapes.

## Round-2 additions (orchestrator, 2026-10-15, from the independent review of PR A1; wins over earlier text)
- **Error codes the Website must cover** (from the SQL): gate/admin `area_closed` 42501, `not_signed_in` 42501,
  `admin_only` 42501, `invalid_email` 22023, `invalid_note` 22023, `invalid_argument` 22023. Member:
  `no_profile` P0002, `profile_mismatch` P0002, `rate_limited` 54000, `whatsapp_not_allowed` 42501; 22023:
  `invalid_payload`, `unknown_key` (DETAIL = key), `invalid_type` (DETAIL = key), `first_name_required`,
  `city_required` (clear OR unknown city), `photo_required`, `invalid_display_name`, `invalid_text`
  (DETAIL = first_name|surname|nationality|bio), `invalid_role`, `invalid_year`, `bio_too_long`, `bio_has_link`,
  `invalid_handle` (DETAIL = instagram|facebook), `invalid_url` (DETAIL = website_url|avatar_url),
  `invalid_whatsapp`, `invalid_list` (DETAIL = key). PostgreSQL's own `permission denied for function ...` (42501)
  when a signed-out caller reaches a member RPC.
- **WhatsApp keys for pure dancers**: `save_my_dancer_profile_v2` refuses the mere PRESENCE of `whatsapp` or
  `show_whatsapp_publicly` with `whatsapp_not_allowed` when the person has no other profile type. The Website save
  wrapper drops both keys when `other_roles` is empty; the fake backend refuses like the DB.
- **WhatsApp eligibility** = an active profile type other than `dancing` and `guest_dancer` (one DB helper).
- **Existing WhatsApp opt-outs are kept**: on apply, `show_whatsapp_publicly` = the row's `show_contact_publicly`
  for rows that already have a number; new rows default to true (D2).
- **Allowed = confirmed email** on `dancer_area_access` (`email_confirmed_at` set). Sign-in by 8-digit code confirms it.
- **Flag write paths**: only `admin_dancer_area_set_open_v1` audits and purges; never flip `dancer_area_open` any
  other way (documented in admin `docs/db-contracts.md`; a trigger is a PR A2 item).
