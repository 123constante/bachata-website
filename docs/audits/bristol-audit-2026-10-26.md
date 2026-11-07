# Bristol launch audit -- 2026-10-26

Read-only audit for brief `docs/briefs/bristol-audit.md` (branch `brief/bristol-audit`, blob d14113db).
Code read at `origin/main` 899f85e. DB: prod `stsdtacfauprzrdebmzg`, SELECT and STABLE RPCs only
(every RPC we called was checked first: `provolatile = 's'` and no INSERT/UPDATE in its body). Counts only, no
personal data. Nothing was written anywhere: no flag, no `is_active`, no city, no migration.
Bristol = `bristol-gb`, id `6d4eca31-23f2-455c-b70c-66101d1ed5a6`, `is_active = false`; 1 active city
(London) of 319 (re-read today).

## 1. Executive summary

1. **Option A is safe.** Activating Bristol breaks nothing: no save, RPC or edge path fails or leaks data for an active
   city with 0 people. The only blocker today is the Jan bug. Every picker calls `search_cities`
   (`WHERE c.is_active = true`), and activation alone fixes that.
2. **What a Bristol visitor would see wrong is cosmetic but noticeable:**
   - London copy and London SEO titles on Bristol-scoped pages.
   - `/city/bristol-gb/venues` lists London's 53 venues.
   - The Dancers, DJs and Organisers directories are global but titled "in London".
   - Dead-end empty states ("Nothing listed for today yet.").
   - The map falls back to a London centre.
   - Global festivals (London, Budapest) fill the "What's on" list, which is intended but unlabelled.
3. **Fix first** (all Website-only, normal lane, size S each):
   - city-aware titles and intros (cityDisplay);
   - an actionable empty-city note with a "Tell us / add your night" button;
   - a teacher variant of the "Tell us" form, which today asks for an "Event link";
   - the map centre for a city with no pins;
   - venues filtered to the page city on the client.
4. **Can wait:**
   - `/` always 307s to London;
   - Bristol's home canonical points at `/`;
   - sitemap per-city entries;
   - the hard-coded `/cities` page;
   - organisers city scope (flag-gated);
   - the ambassador and invite plumbing (dancer `/join` route missing; the admin invite sheet's city picker also uses `search_cities`).
5. **Option B is possible but manual.** Every save RPC accepts an inactive city id; nothing checks `is_active` on write.
   It still needs an admin to set each person's city by hand, and a Bristol event published under B is
   reachable only by direct link or name search. Option C has a cheap half-step: organiser invites already carry
   `prefill_city_id` (accepted even when the city is inactive), but the admin sheet that issues them cannot pick Bristol.

## 2. Part 1 -- what a visitor sees for an ACTIVE Bristol with 0 / 1 / many people

"0 / 1 / many" means what a Bristol visitor would see if `cities.is_active` were true for bristol-gb. Bristol cannot be
activated in a read-only audit, so these columns are inferred from live RPC output with Bristol's slug/id plus code.
Today every `/city/bristol-gb/*` URL is a 404 (`is_valid_city_slug('bristol-gb')` = false; `app/routes/home.tsx:146-150`).

Correction to the home row below: festivals are surfaced feed-wide BY DESIGN (`get_calendar_events_v2` lets any
festival through whatever city is passed; `src/modules/home-map/mapListDerivations.ts:35-44`). `isOnCityMap` keeps
off-city festivals OFF the map, so they appear in the list but are not pinned. With no Bristol pins the map uses its
hard-coded London centre (`src/modules/home-map/EventMap.tsx:181,407,835`). Bristol live data today: 0 venues (of 67),
0 series with Bristol as city, 0 organisers (of 51), 0 of 192 dancer profiles, 0 teachers, 0 DJs. Called with Bristol,
`get_calendar_events_v2` returns 7 festival occurrences over 90 days (3 london-gb, 4 budapest-hu), the same festival rows London gets.

### Part 1 table

| Surface | City source | 0 people | 1 | many | Actionable empty state? | London assumption? | Severity |
|---|---|---|---|---|---|---|---|
| Home `/city/:slug` (feed + map teaser) | URL param -> `is_valid_city_slug` (cities.is_active); bare `/` hard-redirects to london-gb | Feed is never truly empty: 7 global festival rows (3 London, 4 Budapest) show as "what's on in Bristol". Map frames on those pins, not Bristol. Copy is "Nothing listed for today yet." / "Nothing on tonight - N venues on the map" | 1 local event plus festivals. The outlier filter keeps the median pin, so framing could still land on London or Budapest | Fine: frames on the Bristol median | No: "Nothing on right now." / "Nothing listed for today yet." / "No recent additions or updates." say nothing about what the person can do | Yes: EventMap default centre is LONDON; `/` -> london-gb; tz is Europe/London (same zone as Bristol, so harmless) | ugly (festival bleed, wrong map centre); the 404 today is the gate itself |
| Calendar `/city/:slug/calendar` (same Index, calendar tab) and day rollover | URL param (as home) | "Nothing listed for this day yet." on most days; festival days show London/Budapest festivals | ok | ok | No | Day keys use LONDON_TZ (fine for Bristol). Rollover is tz-agnostic (naive wall clock, 08:00 cut) and mirrors admin | fine for rollover; ugly for festival bleed |
| Events list (`/tonight`, `/city/:slug/tonight`) | URL param, else localStorage `activeCitySlug` via CityContext | "No events tonight - There are no events scheduled in your city tonight. Check back later or switch city." | ok | ok | Partly: "switch city" is a next step, but there is no link | Yes: intro copy "bachata dancers in London tonight"; SEO title is "Bachata Tonight in London" (no cityDisplay passed) | ugly |
| Event page `/event/:id` (Bristol-venue event) | The event's own data (event_view_p5); no city gate, does not read is_active | n/a | Renders by direct link even while Bristol is inactive. Title "<name> - Bachata Calendar" (city-neutral) | n/a | n/a | tz falls back to 'Europe/London' only when the occurrence/event tz is null (fine for GB). ErrorScreen falls back to london-gb | fine |
| Organisers `/organisers` (flag organisersDirectory; no `/city/:slug/organisers` route) | None. Lists all organiser_profiles; event counts are fetched with `p_city_slug: null` | Shows London's organisers as "N in London" | same | same | No: "No organisers yet." | Yes: "{N} in London" hard-coded copy; SEO "Organisers in London" | ugly (wrong city list; only matters if the flag is on) |
| Venues `/venues`, `/city/:slug/venues` | None. `get_public_venues_list_v4()` takes no city argument, and the slug in the URL is ignored | `/city/bristol-gb/venues` lists all 56 venues, 53 of them London, grouped by London postcode areas | A Bristol venue (BS postcode) falls under "Elsewhere"; with no station it shows address, else 'London' | same | n/a in practice (the list never empties); "No venues yet." has no CTA | Yes: "Every bachata venue in London" copy, Central/North/... London area labels, `v.address ?? 'London'` fallback | blocker-ish/ugly: a city-scoped URL that shows another city's data |
| Classes / Parties (`/classes`, `/parties` prerendered; `/city/:slug/classes`, `/city/:slug/parties` client) | EventCalendar: `useCity()` (URL, else localStorage); city_slug goes to get_calendar_events_v2 | Month list: "No events found for <Month>" + "Clear filters"; day modal: "No events found" | ok | ok | No: "Clear filters" is the only action, and it is the wrong one for an empty city | Yes: ListingIntro says "in London" plus links to the London guides; SEO titles default to "London" because no cityDisplay is passed | ugly |
| Dancers `/dancers` | NONE -- global list, all active `dancer_profiles` (Dancers.tsx:66-70) | Bristol is irrelevant: London's dancers show (list is global, 192 profiles) | Bristol dancer appears in the global grid with "Bristol" on card | same, mixed with London | Only when the whole site has 0: "No dancers yet. Be the first to join!" + "Create Your Profile" (Dancers.tsx:195-199) -- yes | Title "Bachata Dancers in London" (buildSeoForRoute('dancers') no ctx, Dancers.tsx:42, CITY_DEFAULT buildSeoForRoute.ts:14) | ugly |
| Teachers `/city/:slug/teachers` | URL slug, validated against `cities.is_active` (Teachers.tsx:58-97, teachersCity.ts:42-62) | Heading "Bachata Teachers in Bristol", note "No teachers listed in Bristol yet. Know one?" + "Tell us" + "See another city" (teachersCity.ts:91-92, Teachers.tsx:329-349, 508-516) | 1 card | grid | YES (note + Tell us + See another city). But Tell us opens the EVENT listing form (see Part 4) | Fallback city London (teachersRedirect.ts:5); only on inactive/unknown slug | fine (copy of form: ugly) |
| DJs `/djs` | NONE -- `list_public_djs_v1(p_city_id => null)` (DJs.tsx:44-47) | London DJs (40 total) | Bristol DJ in global grid | mixed | Site-wide only: "No DJs yet." -- no action (DJs.tsx:95) | Title "Bachata DJs in London" (DJs.tsx:40) | ugly |
| Videographers `/videographers` | NONE -- `videographers.is_active` (Videographers.tsx:46-49) | global list | global | global | "No Videographers Yet ... Check back later!" -- no action (Videographers.tsx:107-108) | none (title has no city) | fine |
| Vendors `/vendors` | free-text city filter typed by visitor (Vendors.tsx:22,76) | global list | global | global | "No vendors found for the current filters." -- no action (Vendors.tsx:181) | none | fine |
| Search results `/city/:slug/search`, `?city=` | CityContext slug (URL else localStorage) or `?city=` override (SearchResults.tsx:172-201, useSearchResults.ts:107,133) | events 0, organisers 0, BUT people 8 + venues 2 from London (v7 does not scope people/venues by city) | Bristol event/organiser shown, plus London people/venues | same | "No results for X" / "Try a different word" (SearchResults.tsx:323-330); city Reset in Filters (:491-493). Never says "nothing in Bristol yet" | none in code; result mix is London-heavy | ugly |
| Search autocomplete (overlay/header) | same slug (usePublicSearch.ts:10-23, searchRpc.ts:197-199) | same mix as above (section_limit 3) | same | same | as above | none | ugly |
| Search "cities" section | `ci.is_active = true` inside search_public_v7 | typing "bristol" returns cities 0 today; 1 once active | - | - | - | - | fine once active |
| Popular searches | `get_popular_searches_v1(city_slug)` | 0 rows (London also 0 in last 14d) | - | - | chip row just absent | none | fine |
| Shared CityPicker (signup Auth.tsx:786, AuthStepper.tsx:607, Onboarding.tsx:150, FinishProfile.tsx:220, EditProfile, EditScreen, OrganiserProfile, Vendor*, CreateVideographer, admin AddOrganiser/join AboutStep) | RPC `search_cities` -> `c.is_active = true` (city-picker.tsx:93) | Today: "No city found." Bristol NOT pickable; signup requires a city ("City is required.", Auth.tsx:798) | once active: Bristol listed (simulated: 1 match, country join OK) | - | Request button only if VITE_ENABLE_CITY_REQUESTS (prod value UNKNOWN); and the request INSERT uses columns that do not exist (see gap G3) | ORDER BY puts GB first (search_cities body) -- harmless | BLOCKER today (the Jan bug); fine after A |
| MobileCityPicker / DesktopCityPicker | `search_cities` | - | - | - | - | - | DEAD CODE: no importer outside tests (git grep) -- fine |
| Organiser CitySheetBody + citySearch.ts | `search_cities` via citySearch.ts:16 | same as CityPicker | - | - | - | - | blocker today / fine after A |
| `CityView.tsx` | does NOT exist on main (only named in comments, CitySheetBody.tsx:8) | - | - | - | - | - | n/a |
| Dancer4 onboarding (FinishProfile -> Dancer4Flow) | chips = `cities` by NAME, NO is_active filter (dancer4Api.ts:9-11, dancer4Model.ts:90); search = search_cities; invite prefill city_id trusted if it exists, no is_active check (dancer4Api.ts:36-40, Dancer4Flow.tsx:64-77) | Bristol not a chip, not searchable -> "Can't find it? Tell us your city" -> city_requests row + "We will add it. For now, pick the nearest city above." (dancer4Model.ts:47,51) | - | - | YES | chips list starts with London; Bristol absent | ugly today; fine after A |
| Person pages `/dancers/:id`, `/teachers/:id`, `/djs/:id` | person's `based_city_id` via RPC (routes/dancers.tsx:93, teachers.tsx:70, djs.tsx:60) | n/a | "Bristol" in title/card; detail RPCs have no city is_active gate (checked) | - | - | personCard no longer defaults London (personCard.ts:6-9) | fine |
| Sitemap `/sitemap.xml` | `cities.is_active` for teachers paths only (sitemap.tsx:209-213, 235-238) | adds `/city/bristol-gb/teachers` (thin, empty page) | same | same | n/a | static list hard-codes London landing pages (sitemap.tsx:52-64); NO `/city/<slug>` home entries at all | ugly |
| SEO titles/meta (SPA useSeo) | ctx.cityDisplay else `CITY_DEFAULT='London'` (buildSeoForRoute.ts:14,25) | city pages pass the slug name -> "Bachata in Bristol - ..." ; listings without ctx say London | - | - | n/a | dancers/djs/search/choreography/discounts fall back to London | ugly |
| Bare city canonical | `cityCanonicalPath` -> '/' for `/city/:slug` (cityCanonical.ts:214) and home spec `path: () => '/'` (buildSeoForRoute.ts:48) | Bristol home canonicalises to `/`, which 307s to London -> Bristol home cannot be indexed as itself | - | - | n/a | YES | ugly (SEO, not visible) |
| SSR default `<title>` | app/root.tsx:44-55 "Bachata London -- Events, Classes & Parties Calendar" | server HTML for every catchall route (incl. /city/bristol-gb/teachers) carries the London default until hydration | - | - | n/a | YES | ugly |
| JSON-LD | event: addressLocality from venue city, addressCountry deleted (buildEventJsonLd.ts:102-122); list: same (buildEventListJsonLd.ts:123-132); venue: venue's own city/country (buildVenueJsonLd.ts:58-60); Organization areaServed 'GB' (claims.ts:63) | correct for Bristol (GB) | - | - | n/a | areaServed GB only -- Bristol is GB | fine |
| Edge `/` | vercel.json redirect `/` -> `/city/london-gb` (vercel.json first redirect) AND app/routes/index.tsx:19 `redirect("/city/london-gb", 307)` | returning Bristol visitor typing the domain always lands on London; the localStorage-aware CityRedirect (AnimatedRoutes.tsx:91-95) never runs | - | - | n/a | YES | ugly (high visibility) |
| Edge middleware `/city/:path*` bots | `cities?slug=eq.X&is_active=eq.true` (middleware.ts:230) | social card "Bachata in Bristol", desc fallback "Bachata classes, socials and festivals in Bristol." (Bristol has no description, no hero -> generic og-image.jpg) | - | - | n/a | none | fine |
| Edge 404 gate (inactive today) | `is_valid_city_slug` (= slug AND is_active) via cityValidity.ts:13-20, home.tsx:147-150, catchallGate.ts:12 | today every /city/bristol-gb/* answers 404; once active 200 | - | - | n/a | none | fine after A |
| OG images `/api/og/card` | entity data; dates read as stored wall clock (ogCardRender.ts:572-581) | no city logic | - | - | n/a | none (Bristol tz is Europe/London anyway) | fine |
| Cache purge | `cities.is_active` limit 50 (cloudflarePurgeResolver.ts:52) | Bristol tag purged once active | - | - | n/a | none | fine |
| `/cities` page | hard-coded (Cities.tsx:20-25,63,92) | shows London pin + "upcoming: Madrid, Lisbon, Paris, Berlin"; Bristol never appears | - | - | n/a | YES | ugly |

### Ranked gap list (what a Bristol visitor would see wrong, most visible first)

| Rank | Gap | Severity | Today (inactive) / after A |
|---|---|---|---|
| 1 | Bristol cannot be picked in any picker that uses `search_cities`: signup (city required, `Auth.tsx:798`), onboarding, profile edit, organiser city sheet, admin invite sheet. This is Jan's bug. | blocker | blocker today; fixed by A alone |
| 2 | `/city/bristol-gb/venues` lists all 56 venues (53 London) under London copy and London area groups (`src/pages/Venues.tsx:37-72,379,566`); `get_public_venues_list_v4()` takes no city. | ugly (looks wrong) | after A |
| 3 | London copy and titles on Bristol pages: Parties and Classes intros, the Tonight intro, and SEO titles for parties, classes, tonight, venues, organisers, dancers, djs ("... in London"; `buildSeoForRoute.ts:14` `CITY_DEFAULT`). | ugly | after A |
| 4 | Dead-end empty states: "Nothing on right now." / "Nothing listed for today yet." / "No events found for <Month>" + "Clear filters" / "No events tonight ... switch city" (no link). Only Teachers has an action. | ugly | after A |
| 5 | Global festivals (London, Budapest) are the only rows in "What's on in Bristol", with nothing saying they are elsewhere. By design, but unlabelled. | ugly | after A |
| 6 | Map with 0 Bristol pins centres on London (hard-coded centre); no Bristol placeholder image. | ugly | after A |
| 7 | People directories (Dancers, DJs) and search people/venues are global: a Bristol search returns 0 events, 0 organisers, 8 London people, 2 London venues, and never says "nothing in Bristol yet". | ugly | after A |
| 8 | Teachers "Tell us" opens the EVENT listing form ("Event link") and the receiver cannot tell it came from Bristol's teachers page (Part 4). | ugly | after A |
| 9 | Bare `/` always 307s to London at the edge (`vercel.json` first redirect + `app/routes/index.tsx:19`), so a returning Bristol visitor's stored city is ignored. | ugly | both |
| 10 | Organisers directory: all organisers shown under "{N} in London" (`src/pages/Organisers.tsx:562`). Flag-gated (`organisersDirectory`, prod value not checked). | ugly if flag on | after A |
| 11 | SEO only: `/city/bristol-gb` canonicalises to `/` (= London; `app/cityCanonical.ts:214`); the sitemap has no `/city/<slug>` entries and would add an empty `/city/bristol-gb/teachers`; the SSR default `<title>` says London (`app/root.tsx:44-55`). | ugly (invisible) | after A |
| 12 | `/cities` page hard-codes London + 4 "upcoming" cities (`src/pages/Cities.tsx:20-25`). | ugly | both |
| 13 | Shared CityPicker "Request to add" inserts columns that do not exist in `city_requests` (`city-picker.tsx`); this only matters if `VITE_ENABLE_CITY_REQUESTS` is on in prod (not checked). | ugly/broken | both |
| -- | Fine: day rollover (`src/lib/programDayRollover.ts`, tz-agnostic, mirrors admin; Bristol shares Europe/London), event page by direct link (city-neutral title), JSON-LD (addressLocality from venue, `areaServed` GB), OG cards, edge bot card ("Bachata in Bristol"), cache purge, person pages, teachers empty state. | fine | -- |

## 3-4. Parts 2 and 3

## Part 2 and Part 3 -- Who can pick Bristol, and the ambassador / invite mechanism

Scope: read-only. Website code at origin/main 899f85e (`git show` / `git grep`). DB facts from prod
`stsdtacfauprzrdebmzg`, SELECT only (catalog reads with `pg_get_functiondef`, `pg_proc.prosrc`,
`pg_trigger`, `pg_constraint`, `pg_policies`, plus count queries). No function was executed. The admin
repo is NOT reachable from this session: every admin-side answer comes from live DB function bodies,
grants and tables, plus the website code. No admin UI screen was read.

Bristol: `bristol-gb`, id `6d4eca31-23f2-455c-b70c-66101d1ed5a6`, `is_active = false` (re-read
2026-10-26; 1 active city of 319).

### Part 2 -- Who can pick Bristol, and when?

#### 2.1 Root cause confirmed

`search_cities(p_query text, p_limit integer DEFAULT 20)`, LANGUAGE sql STABLE SECURITY DEFINER, live body:

```
  FROM public.cities c
  JOIN public.countries co ON co.code = c.country_code
  CROSS JOIN q
  WHERE c.is_active = true
    AND ( q.term = '' OR lower(c.name) LIKE q.term || '%' OR EXISTS (... city_aliases ...) )
```

An inactive city is never returned, under any search term. Confirmed.

#### 2.2 Every DB object that looks at `cities.is_active` or limits which city can be chosen

How I found them: every `public` function whose `prosrc` mentions both `cities` and `is_active` (55
functions). For each one I pulled the lines that mention `is_active`. Most of those lines are about
`dancer_profiles.is_active`, `person_roles.is_active` or `organiser_profiles.is_active`, not about the
city. Only **four** functions filter on `cities.is_active`, and all four are READ paths. I also read the
city lines of every save, create and invite RPC, the triggers on `auth.users`, `dancer_profiles`,
`organiser_profiles`, `venues`, `cities` and `member_profiles` (no `events` table exists; events live
in `event_series_p5` and `event_occurrence_override_p5`), every FK to `cities`, every CHECK constraint
that mentions a city, and the RLS on `cities`.

| Object | Kind | Restricts on is_active? | Column set | Inactive-Bristol save result | Evidence |
|---|---|---|---|---|---|
| `search_cities(text,int)` | RPC, read (every picker) | **YES** | none (read) | n/a: Bristol is never listed, so no UI can pick it | `WHERE c.is_active = true` (quoted above) |
| `is_valid_city_slug(text)` | RPC, read (CityContext URL check) | **YES** | none | n/a: `/city/bristol-gb` is treated as invalid, so the stored city is kept | body line `AND c.is_active = true`; called from `src/lib/cityValidity.ts:14` via `src/contexts/CityContext.tsx:56` |
| `get_public_teachers_list_v1(text,int,int)` | RPC, read | **YES** | none | n/a | line `AND c.is_active = true` |
| `search_public_v7(...)` | RPC, read (search) | **YES, for CITY results only** | none | n/a: city results and the name list skip inactive cities; event, organiser and person branches filter on the entity's own `is_active`, not the city's | lines `WHERE ci.is_active = true AND q.qstr <> ''` and `SELECT name FROM public.cities WHERE is_active` |
| `save_my_dancer_profile_v1(jsonb)` | RPC, write | no | `dancer_profiles.based_city_id` | **SUCCEEDS** (only the FK applies) | `based_city_id = COALESCE(NULLIF(v_merged_payload->>'based_city_id','')::uuid, dp.based_city_id)`; no city check |
| `save_my_dancer_profile_v2(jsonb)` | RPC, write (wizard) | no | `dancer_profiles.based_city_id` (through v1) | **SUCCEEDS** | `OR NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = v_txt::uuid) THEN RAISE ... 'city_required'`: an existence check only |
| `organiser_profile_update_p5_v1(uuid,jsonb)` | RPC, write (organiser edit in place) | no | `organiser_profiles.city_id` | **SUCCEEDS** | `IF NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = v_text::uuid) THEN RAISE EXCEPTION 'city_not_found'` |
| `create_organiser_profile_v1(text,uuid,text,text,text)` | RPC, write (new page) | no | `organiser_profiles.city_id` | **SUCCEEDS** | `IF p_city_id IS NULL THEN RAISE 'city_required'`; `IF NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = p_city_id) THEN RAISE 'city_not_found'` |
| `admin_add_organiser_v1(jsonb)` | RPC, admin write | no | `organiser_profiles.city_id`, and the Leader's `based_city_id` | **SUCCEEDS** | `IF v_city IS NULL OR NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = v_city) THEN ... 'CITY_REQUIRED'` |
| `admin_save_organiser_v1(...)` | RPC, admin write | no | `organiser_profiles.city_id` | **SUCCEEDS** | `IF p_city_id IS NULL THEN RAISE 'city_required'`; then `city_id = p_city_id` |
| `admin_save_dancer_v1(uuid,jsonb)` | RPC, admin write | no (its `is_active` lines are `dp.is_active`) | `dancer_profiles.based_city_id`, `member_profiles.based_city_id`, `entities.city_id` | **SUCCEEDS** | `based_city_id = CASE WHEN p_payload ? 'based_city_id' THEN NULLIF(...)::uuid ...` |
| `admin_issue_organiser_invite_v1(uuid,text,text,uuid)` | RPC, admin write | no | `organiser_invites.prefill_city_id` | **SUCCEEDS** | `IF p_city_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = p_city_id) THEN RETURN ... 'city_not_found'` |
| `series_command_p5` / `apply_aggregate_write_p5` (series upsert) | RPC, write (event create) | no city `is_active` check (its `is_active` lines are `op.is_active`) | `event_series_p5.default_city_id` | **SUCCEEDS** | grep of the city and `is_active` lines found no `cities.is_active` |
| `_series_go_live_check_p5` / `event_publish_readiness_v1` | RPC, publish gate | no | none | **PASSES** for Bristol | `IF v_s.default_city_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = v_s.default_city_id)`: existence only |
| `resolve_city_id(text,text)` | RPC, read (venue-city resolver, calendar slug) | no | none | resolves Bristol by name or slug | matches `c.slug` / `lower(c.name)` / alias, with no `is_active` |
| `get_based_city_prefill()` | RPC, read | no (the `is_active` lines are `dp`/`pr`) | none | returns Bristol if the profile has it | reads `dp.based_city_id JOIN cities` |
| `approve_city_request`, `admin_save_city_v1` | RPC, admin | they SET `cities.is_active` | `cities.is_active` | n/a (these are the writers; never run) | `v_is_active := COALESCE((p_payload->>'is_active')::boolean, false)` |
| Triggers on `auth.users` (`on_auth_user_created`, `trg_handle_new_dancer_profile`), `dancer_profiles` (8), `organiser_profiles` (8), `venues` (5), `cities` (`trg_cascade_city_to_venues`, `trg_cities_touch_updated_at`) | triggers | **no** | none of them sets a city | do not block | the trigger function bodies have no `cities.is_active` (checked: `tg_organiser_self_serve_door_v1`, `handle_new_dancer_profile`, `handle_auth_user_created`, `sync_venue_to_entities_minimal`, `cascade_city_update_to_venues`, `tg_dancer_profiles_contact_rule_a1`, `tg_organiser_profiles_self_serve_publish`, `_mint_person_for_dancer_profile_v1`, `_sync_person_from_persona_v1`) |
| FKs to `cities(id)` (dancer, member and profiles `based_city_id`; `entities`, `vendors`, `videographers`, `promo_codes`, `onboarding_targets`, `guest_dancer_profiles`, `admin_manager_city_scopes`, `city_aliases`, `organiser_invites.prefill_city_id`, ...) | FK | no | n/a | succeed (Bristol exists) | `pg_constraint` where `confrelid = cities` |
| CHECK constraints mentioning a city | CHECK | no | n/a | n/a | only enum checks (`entity_type`, `target_type`, `surface`) and `entity_members_ambassador_city_only` |
| RLS on `cities` | policy | no | n/a | n/a: SELECT is `true` (every row, inactive ones too, readable by anyone); writes need `is_current_user_admin() OR is_admin()` | `pg_policies` |

**Conclusion.** The only gate is the READ side: `search_cities` for the picker UI, plus
`is_valid_city_slug`, the teachers list and city search results. **No save path refuses an inactive
city.** A direct save with Bristol's id succeeds wherever an id is accepted.

Production data already shows this shape: **41** `dancer_profiles`, **3** `organiser_profiles` and
**6** `event_series_p5` rows today point at an inactive city.

#### 2.3 Website: which RPC each picker's save reaches

| Picker (all list cities via `search_cities`) | Save call (file:line) | Column |
|---|---|---|
| `src/components/ui/city-picker.tsx:93`, `MobileCityPicker.tsx:74`, `DesktopCityPicker.tsx:93` (dancer dashboard, /finish-profile, invite AboutStep, admin invite sheet) | `src/lib/saveMyDancerProfile.ts:238` -> `save_my_dancer_profile_v1` (callers e.g. `src/components/profile/DancerDashboard.tsx:617`, `src/modules/admin-organisers/join/AboutStep.tsx:64`) | `dancer_profiles.based_city_id` |
| Wizard dancer city step `src/modules/organiser/wizard/registry.tsx:124` (search `citySearch.ts:16`) | `src/modules/organiser/wizard/dancerApi.ts:65` -> `save_my_dancer_profile_v2` | `dancer_profiles.based_city_id` |
| `Dancer4Flow.tsx:275` (onboarding) | the same dancer save | `dancer_profiles.based_city_id` |
| Organiser edit in place `CitySheetBody.tsx` (lookups `EditInPlaceLayer.tsx:24,124`) | `draftModel.ts` `saveDrafts` -> `src/lib/organiserProfileUpdate.ts:100` `organiser_profile_update_p5_v1` | `organiser_profiles.city_id` |
| Organiser wizard city `registry.tsx:147`, `NewPageFlow.tsx:68` | `src/modules/organiser/shared/selfServeApi.ts:194` `create_organiser_profile_v1` | `organiser_profiles.city_id` |
| Event create (no city picker: the city comes from the venue's `city_name` through `resolve_city_id`, else the organiser's `city_id`) | `src/modules/organiser/shared/createCity.ts` -> `flows/new/model.ts:35` / `events/eventModel.ts:222` `default_city_id` -> `series_command_p5` (`selfServeApi.ts:282`) | `event_series_p5.default_city_id` |
| Admin "Send a link" sheet `src/modules/admin-organisers/AdminOrganisersPage.tsx` (CityPicker, sheet line 56 of the 140-215 excerpt) | `src/modules/admin-organisers/adminApi.ts:86,90` `admin_issue_organiser_invite_v1(p_city_id)` | `organiser_invites.prefill_city_id` |

Note: `city-picker.tsx:119-131` shows the label of a value that is already set by reading
`from('cities').eq('id', value)`. That read has RLS `true`, so a PREFILLED Bristol id shows as
"Bristol" even though Bristol cannot be searched.

#### 2.4 Jan

- If Bristol is ACTIVE and Jan picks it as a dancer, `dancer_profiles.based_city_id` is set. That is
  also the teacher's city. As an organiser page, `organiser_profiles.city_id` is set instead.
- **A profile row must exist first. The save does not upsert.** `save_my_dancer_profile_v2` raises
  `no_profile` (P0002) when `_my_dancer_profile_id_v1()` is NULL, and v1 raises `no_canonical_person`
  from `resolve_my_person_id_v1()`. That id is resolved by `_dancer_profile_id_for_account_v1`: a claimed
  persona, else the row whose id is the account id. The account's own row is the sign-up stub made by
  the `auth.users` AFTER INSERT triggers (`trg_handle_new_dancer_profile`, `on_auth_user_created`).
  So in practice Jan needs (1) an account (sign up, which makes the stub) and (2) the dancer area open
  to Jan. `_dancer_area_require_v1` runs first; the flag `dancer_area_open` is currently **true**, so
  this does not block today.
- `select count(*) from auth.users where email ilike '%jan%'` = **0**. No account email contains
  "jan", so Jan's account (if any) uses some other address, or there is none yet. Not identifiable without
  personal data; not attempted.

### Part 3 -- Ambassador and invite mechanism

#### (a) Ambassador / referral / invited_by concept

**An ambassador concept EXISTS in the DB. It is not a referral system, and today it is empty.**

- Table `entity_members` with `member_role` in (`owner`,`manager`,`contributor`,`ambassador`), CHECK
  `entity_members_member_role_check`, and CHECK `entity_members_ambassador_city_only`:
  `(member_role <> 'ambassador') OR (entity_type = 'city')`. An ambassador is a member of a CITY.
- `_is_city_ambassador(city,user)` = `_is_entity_member('city', city, user, ARRAY['ambassador'])`.
- What an ambassador can do: **moderate** their city's pending items. `_moderate_entity`:
  `IF NOT (v_admin OR public._is_city_ambassador(v_city, v_actor))`.
  `tg_enforce_lifecycle_transition`: the `pending_review -> live | rejected` arm.
  `admin_list_pending_review_v1`: the review queue is scoped to the ambassador's city.
- Created by `admin_add_entity_member_v1(entity_type, entity_id, email, role, is_primary)`. Only an
  admin, or an OWNER of that city entity, can call it with effect. The target must be an EXISTING
  account with a confirmed email (`user_not_found` / `unconfirmed_email`).
  `admin_list_ambassadors_v1` is admin only.
- Counts: `entity_members` has organiser:owner 15 and organiser:manager 46. **city:ambassador 0, and
  no city rows at all.**
- Referral / sponsor columns: **none.** Column and table names matching `invit`, `referr`,
  `ambassador`, `sponsor` (public and auth): only `auth.flow_state.referrer` (a Supabase auth internal,
  not referral), `auth.users.invited_at`, and the invite tables below.
  `series_organiser_invites.invited_by` / `invited_by_page_id` track page-to-page co-organiser
  invites, not people.
- Admin screens: the admin repo was not reachable. Admin RPCs exist (`admin_add_entity_member_v1`,
  `admin_list_ambassadors_v1`), so a screen probably exists there; **not verified**.

#### (b) The existing invite mechanisms

There are four:

1. **Organiser invite** (`organiser_invites`).
   - Carries: `organiser_id` (required; `organiser_not_found` otherwise), optional bound `email`,
     `prefill_first_name` and **`prefill_city_id`**, plus `token_hash`, `issued_by`, `issued_at`,
     `expires_at`, `used_at`, `used_by`, `revoked_*` and `bound_via`.
   - Role: redeeming makes the user an **owner** of that organiser page
     (`_organiser_member_set_p5(v_inv.organiser_id, v_user, 'owner', 'invite', ...)`).
   - Creator: **admin only**. `admin_issue_organiser_invite_v1` checks `IF NOT
     public._self_serve_is_admin() THEN RAISE 'not_authorised'`. It is granted to `authenticated`, but
     that admin check is the gate.
   - City: accepts ANY existing city (`city_not_found` is the only check). So **it can carry Bristol
     while Bristol is inactive.**
   - Expiry: 7 days (`v_expires := now() + interval '7 days'`). One live link per organiser:
     re-issuing revokes the old link.
   - Cap: a team may have at most 20 members (`... IN ('owner','manager','contributor')) >= 20`).
   - Side effect: a bound email is added to `signup_allowlist`.
   - Tracking: `issued_by` and `used_by` (who invited whom, who joined), `_write_entity_decision_audit`
     ('invite_issued', 'invite_revoked'), and the `organiser_invite_redeem_attempts` /
     `organiser_invite_bind_attempts` logs.
   - Landing: `/invite/:token`, `src/components/AnimatedRoutes.tsx:260-261` ->
     `src/modules/admin-organisers/InviteRedeemPage.tsx:27` -> `join/JoinPage.tsx`. The preview comes
     from `organiser_invite_preview_v1` (anon), which returns `prefill.city_id`. The inline "A bit about
     you" step, `join/AboutStep.tsx:48`, sets `based_city_id: preview.prefill?.cityId`, and the save
     goes through `saveMyDancerProfile` (`AboutStep.tsx:64`) -> `dancer_profiles.based_city_id`.
     **This path already sets Bristol on a dancer profile while Bristol is inactive**, but only for
     someone joining an ORGANISER page.
   - Website catch: the admin "Send a link" sheet chooses the city with `CityPicker` (`search_cities`),
     so Bristol cannot be CHOSEN there. Only a direct RPC call with Bristol's id would carry it.
   - Counts: expired 2, open 2, open+email 1, revoked 2, used 3, used+city+email 1, used+email 2.
     **0** carry Bristol.
2. **Dancer invite** (`dancer_invites`, edge function `dancer-invite-send` v2, read through
   `get_edge_function`).
   - Carries: `dancer_profile_id` (an existing, UNCLAIMED, admin-made profile with an email), `email`,
     `token_hash`, `issued_by`, `expires_at` (7 days), `redeemed_by` and `revoked_*`. **No city
     column.** The city is whatever `based_city_id` the admin-made profile already has, and
     `admin_save_dancer_v1` would accept Bristol.
   - Creator: admin only. `admin_dancer_invite_issue_v1` checks `IF NOT public.is_admin() THEN RAISE
     'admin_only'`, and the edge function calls it with the admin's JWT.
   - Minting also adds the email to `signup_allowlist` and `dancer_area_access`.
   - Email: "You have a dancer profile on Bachata Calendar..." with the link
     `<site>/join/<token>`.
   - **GAP: origin/main has no `/join` route.** `AnimatedRoutes.tsx` only has `/invite`, and no
     `peek_dancer_invite_v1` / `redeem_dancer_invite_v1` caller exists in `src/`. A sent link would hit
     the catch-all.
   - Counts: 0 rows (never used).
3. **Series co-organiser invite** (`series_organiser_invites`, `series_invite_organiser_v1`):
   page-to-page, with `invited_by` and `invited_by_page_id`. No city. 0 rows.
4. **Claim-my-profile.** `organiser_claim_emails(organiser_id, claim_email, ...)` is written by admins
   only (trigger `trg_organiser_claim_emails_admin_only`). `claim_my_organisers_v1` auto-claims as
   owner on sign-in when the email matches, and also joins a bound open invite. 0 rows today. The "43
   pages" claim emails are not in this table, so they presumably live in the admin repo or a queue;
   **not verified**. `organiser_invite_queue` has 0 rows; `organiser_invite_requests` ("request a new
   link") has 0 rows; `signup_allowlist` has admin_invite 5 and seed 1.

**Can an invite open a Bristol-aware onboarding?**
- Partly. The organiser invite carries `prefill_city_id`, and the join page's AboutStep prefills and
  saves it. But that invite is tied to an organiser PAGE and makes the invitee its owner.
- There is no invite that carries a city ROLE (ambassador), and no invite for "a person in a city"
  without a page.
- Making someone an ambassador is a separate admin-only call, `admin_add_entity_member_v1('city',
  bristol, email, 'ambassador')`, which needs an existing confirmed account. No invite link does it.

#### (c) Can the ambassador pick Bristol as home city while it is inactive?

Not from any picker (`search_cities` WHERE `c.is_active = true`). But **any save with Bristol's id
succeeds**: `save_my_dancer_profile_v1/v2`, `admin_save_dancer_v1`, and an organiser invite's
`prefill_city_id`. So an admin can set it for Jan (option B), or an invite prefill can carry it.

#### (d) An organiser with a Bristol event while Bristol is inactive

- **Event create**: accepted. The series city comes from the venue's `city_name` through
  `resolve_city_id` (no `is_active` check), else the organiser's `city_id`
  (`src/modules/organiser/shared/createCity.ts`). `series_command_p5` / `apply_aggregate_write_p5`
  have no city `is_active` check, and the go-live check `_series_go_live_check_p5` only needs the city
  to EXIST. Venue options come from `get_organiser_venue_options_v1`, which has no city filter. The
  website has no self-serve venue-create RPC; venues are made by admins or through import.
- **Own dashboard** (`organiser_home_v1`): no city filter. The event shows normally.
- **Public event page by direct link** (`event_view_p5`): no city or `is_active` reference. It renders.
- **Calendar**: the city comes from CityContext. `/city/bristol-gb` fails `is_valid_city_slug`
  (active only), so CityContext keeps the stored city (`CityContext.tsx:84-92`: "Invalid slug: do
  nothing"), and EventCalendar asks with that slug (`EventCalendar.tsx:101,149`).
  `get_calendar_events_v2` itself has no `is_active` filter (it uses `resolve_city_id`). So the
  Bristol event is **invisible in every calendar**, but a Bristol slug sent directly would return it.
- **Day rollover**: the server uses `Europe/London` (`organiser_home_v1`, `apply_aggregate_write_p5`).
  Bristol is in the same timezone, so this is fine. Not checked against the admin rollover code.
- **Search** (`search_public_v7`): the event branch filters on the entity's own `is_active`, not the
  city's. The event can be found by name. "Bristol" as a city result and in the city name list is
  hidden. I did not run search with Bristol's slug, so whether event results are scoped by
  `p_city_slug` is not verified.

### SQL run (all SELECT on catalog or counts; nothing executed that writes)

1. `select p.oid::regprocedure, p.prosecdef, length(p.prosrc) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc ilike '%cities%' and p.prosrc ilike '%is_active%'`
2. `select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n ... where p.proname='search_cities'`
3. `select p.proname, m[1] from pg_proc p ..., lateral regexp_matches(p.prosrc, '([^\n]{0,120}is_active[^\n]{0,80})','g') m where p.proname in (...17 names...)`
4. `select sig, prosecdef, proacl, <city lines regex> from pg_proc where proname in ('save_my_dancer_profile_v1','save_my_dancer_profile_v2','organiser_profile_update_p5_v1','resolve_city_id','create_organiser_profile_v1','is_valid_city_slug','get_based_city_prefill','my_dancer_edit_v1')`
5. The same regex for `INSERT INTO|ON CONFLICT|no_profile|auth.uid()` on the three dancer save and edit functions.
6. `select proname, prosrc from pg_proc where proname in ('resolve_my_person_id_v1','_my_dancer_profile_id_v1','_dancer_area_require_v1')`
7. `select prosrc of _dancer_area_allowed_v1, _dancer_profile_id_for_account_v1 union all select pg_get_triggerdef(t.oid) from pg_trigger t join pg_class ... where not t.tgisinternal and (auth.users or public dancer/organiser/cities/venues/series/member_profiles/profiles/person_roles)` (the first attempt failed: `public.events` does not exist)
8. City and `is_active` lines of 9 trigger functions (`tg_organiser_self_serve_door_v1`, `handle_new_dancer_profile`, ...).
9. `select (select enabled from app_feature_flags where flag_key='dancer_area_open'), (select count(*) from dancer_area_access), (select count(*) from auth.users where email ilike '%jan%'), (select is_active from cities where id=<bristol>), (select count(*) from cities where is_active)` -> true, 1, **0**, false, 1
10. `select ... from pg_policies where tablename='cities' union all select pg_get_constraintdef ... from pg_constraint where confrelid='public.cities'::regclass or (contype='c' and def ilike '%city%')`
11. The same constraint query with table names, plus `ilike '%ambassador%'`.
12. `select table_schema, table_name, column_name, data_type from information_schema.columns where table_schema in ('public','auth') and (column_name|table_name ilike '%invit%'|'%referr%'|'%ambassador%'|'%sponsor%')`
13. `select sig, prosecdef, proacl, flags from pg_proc where prosrc ilike '%ambassador%'|'%referr%'|'%organiser_invites%'|'%dancer_invites%'|'%entity_members%' or proname ilike '%invite%'|'%ambassador%'`
14. Bodies of `_is_city_ambassador`, `admin_list_ambassadors_v1`, `admin_add_entity_member_v1`, `admin_issue_organiser_invite_v1`.
15. `prefill_city|ambassador` lines across functions (not `check_%`).
16. Counts: `entity_members` by type:role; `organiser_invites` by state, `+city`, `+email`; `dancer_invites` by state; `organiser_invite_queue` by kind:status; `series_organiser_invites` by status; `organiser_invite_requests` pending/handled; `signup_allowlist` by source; `organiser_invites` where `prefill_city_id` = Bristol.
17. Heads of `admin_invite_person_v1`, `admin_dancer_invite_issue_v1`, `_dancer_invite_mint_v1`, `peek_dancer_invite_v1`.
18. City lines of `admin_save_dancer_v1`, `redeem_dancer_invite_v1`, `admin_add_organiser_v1`, `admin_save_organiser_v1`, `get_organiser_venue_options_v1`, `tg_organiser_self_serve_door_v1`.
19. City, `is_active` and London lines of `event_view_p5`, `calendar_events_dto`, `apply_aggregate_write_p5`, `event_publish_readiness_v1`, `organiser_home_v1`, `series_command_p5`, `occurrence_command_p5`, `_series_go_live_check_p5`.
20. `calendar_events_dto` city lines and arguments.
21. Counts: Bristol series, organisers, entities and venue entities (all 0); rows pointing at any inactive city: organisers 3, series 6, dancers 41.
22. City-slug and `is_active` lines of `get_calendar_events_v2`, `is_valid_city_slug`.
23. Role, expiry and admin lines of `redeem_organiser_invite_v1`, `_join_bound_invite_v1`, `claim_my_organisers_v1`; `organiser_claim_emails` columns and count (0); `dancer_invites` count (0).

Edge functions: `list_edge_functions` (read) and `get_edge_function('dancer-invite-send')` (read source).

### Gaps and fix sketches (no code)

| # | Gap | Lane | Files | Size |
|---|---|---|---|---|
| G1 | No picker can pick an inactive city. This is the cause of Jan's report. If option C (invited-only picker) is chosen: a variant of `search_cities` (or a param) that also returns cities where the caller is a city ambassador, or the city on the caller's open invite. | careful (admin migration) + normal (website pickers pass nothing new or a flag) | admin `supabase/migrations`; website `src/components/ui/city-picker.tsx`, `MobileCityPicker.tsx`, `DesktopCityPicker.tsx`, `src/modules/organiser/home/onboarding/citySearch.ts` | M |
| G2 | The dancer invite email links `/join/<token>`, but the website has no `/join` route and no `peek_dancer_invite_v1` / `redeem_dancer_invite_v1` caller. The dancer-invite path is dead end to end (0 sent so far). | normal (website route + page) | `src/components/AnimatedRoutes.tsx`, new join-dancer page | M |
| G3 | The admin "Send a link" sheet picks the prefill city through `search_cities`, so it cannot carry Bristol, although the RPC accepts it. | normal (admin-side picker with all cities) or careful (if done via a new RPC) | `src/modules/admin-organisers/AdminOrganisersPage.tsx` (and the admin repo's own screen, not verified) | S |
| G4 | No "ambassador invite": making Jan an ambassador needs Jan's existing confirmed account, plus `admin_add_entity_member_v1('city', ...)` run by an admin. No link-based or self-serve path exists, and nothing records that the ambassador invited someone (no `invited_by` on people). | careful (DB) | admin migrations (+ admin screen) | L |
| G5 | Under option B, an event or organiser in inactive Bristol saves and publishes, but is invisible on the calendar and city pages (`is_valid_city_slug`); it is reachable only by direct link or name search. Owner and organiser expectations need saying. | n/a (decision) or normal (copy on the organiser dashboard) | `src/modules/organiser/...` dashboard copy | S |
| G6 | The `is_active` gate is spread across 4 read RPCs (`search_cities`, `is_valid_city_slug`, `get_public_teachers_list_v1`, `search_public_v7`). Activating Bristol flips all four at once, which suits option A. A partial "soft launch" would need a second flag. | careful | admin migrations | M |

### Verified vs not verified

**Verified (live DB bodies or counts, website code at 899f85e):**
- the `search_cities` WHERE clause
- the full list of `cities.is_active` readers (4)
- every save, create and invite RPC accepts an inactive city (existence check or FK only)
- no trigger or CHECK blocks a city
- `cities` RLS SELECT is `true`
- the dancer save requires an existing profile (`no_profile` / `no_canonical_person`)
- `dancer_area_open` is true
- the auth.users `%jan%` count is 0
- the ambassador role exists, with 0 rows
- organiser invites carry `prefill_city_id`, are admin only, expire after 7 days, and track issuer and redeemer
- the dancer invite email targets `/join/<token>`, and the website has no such route
- the Bristol event path has no city `is_active` gate in create, dashboard or event view
- the calendar hides an inactive-city slug through CityContext

**Not verified:**
- the admin repo source and screens (not accessible; inferred from DB RPCs only)
- whether an admin ambassador screen exists
- where the "43 pages" claim emails live (not in `organiser_claim_emails`, which has 0 rows)
- whether `search_public_v7` scopes event results by `p_city_slug` (not run)
- day rollover parity with admin
- no RPC was executed. Every "succeeds" or "fails" answer is read from function bodies, constraints, triggers and RLS, not from a test call.

## 5. Part 4

## Part 4 -- The "Tell us" form (ListingRequestForm)

Code base: origin/main 899f85e (read with `git show origin/main:<path>`). DB: prod `stsdtacfauprzrdebmzg`, SELECT only, counts only.

### 4.1 Where submissions go

Chain (all verified, code + live DB definitions):

1. `src/components/ListingRequestForm.tsx:45-54` calls `rpcLoose('submit_listing_request_v1', { p_payload: { section, name, phone, event_link, source_url, field_url_check } })`. `source_url` = `window.location.pathname + window.location.search` (`:41-43`).
2. `public.submit_listing_request_v1(p_payload jsonb)` -- SECURITY DEFINER, EXECUTE granted to anon/authenticated. Honeypot -> fake `{ok:true,id:null}`; requires section/name/phone/event_link; casts `section` to enum `listing_request_section` (else `invalid_section`); `event_link` must match `^https?://`; IP throttle 5/hour in `listing_request_throttle`; duplicate detection = same phone OR same event_link HOST within 30 days, not archived/declined -> sets `duplicate_of_request_id`. INSERTs into **`public.listing_requests`** (section, name, phone, event_link, source_url, duplicate_of_request_id) and one `listing_request_status_history` row (`new`). Every other payload key is ignored.
3. Trigger `trg_listing_requests_email_dispatch` (AFTER INSERT) -> `listing_requests_after_insert_dispatch_email()` reads Vault secrets `send_listing_request_email_url` / `..._anon_key` and `net.http_post`s `{request_id}` to edge function **`send-listing-request-email`** (v19; deployed from the admin repo path `bachata-admin-11april/supabase/functions/send-listing-request-email/index.ts`; not in this repo). Errors swallowed.
4. Edge function re-reads the row via service role, sends via Resend from `hello@bachatacalendar.co.uk` (business address) to **a personal address hard-coded in the edge function source (`TO_ADDRESS`, admin repo `send-listing-request-email/index.ts`)**, then logs to `public.listing_request_email_log` (sent/failed).

Who reads `listing_requests` (inferred from DB; admin repo not accessible): table has RLS on with a single `deny_all_phase3` (ALL) policy, so anon/authenticated table grants are inert; readers are SECURITY DEFINER admin RPCs gated on `is_admin()`: `admin_list_listing_requests_v1(p_status, p_section, p_stale_only, p_search, p_limit, p_offset)`, `admin_get_listing_request_detail_v1(p_id)`, `admin_listing_request_kpis_v1()`, `admin_dashboard_action_queue_v1`, `admin_mark_request_contacted_v1`, `admin_start_onboarding_v1`, `admin_update_listing_request_status_v1`. The email links to `https://admin.bachatacalendar.com/admin/listing-requests/<id>` -- an admin triage screen exists (inferred from that URL + RPC names).

Counts (all-time, whole table = 3 rows):

| month | section | status | rows | with source_url | flagged dup |
|---|---|---|---|---|---|
| 2026-04 | teacher_detail | archived | 1 | 1 | 0 |
| 2026-08 | teacher_detail | archived | 1 | 1 | 1 |
| 2026-08 | teacher_detail | contacted | 1 | 1 | 0 |

All 3 source_url shapes are `/teachers/:id` (teacher_detail gate). **Zero `teachers_directory` rows ever** -- the empty-city "Tell us" has never produced a submission. Email log: 2026-04 sent 1, 2026-08 sent 2, 0 failed. There is no `kind` column; `section` is the only kind-like field.

### 4.2 What the form knows / what the receiver sees

- Page: YES, implicitly -- `source_url` is the path+query, so `/city/leeds-gb/teachers` would arrive verbatim (`ListingRequestForm.tsx:41-43`).
- City: NO explicit field. Only derivable by parsing `source_url`. For an inactive/unknown slug the page shows London's list but the URL still holds the requested slug (`teachersCity.ts:89`), so the URL is the better city signal -- if nobody rewrites it.
- Teacher marker: only via `section`. Both the teachers-directory gate and the empty-city note send `section="teachers_directory"` (`AnimatedRoutes.tsx:88`, `src/pages/Teachers.tsx:346`) -- the RPC cannot tell "directory locked" from "empty city tip".
- Receiver email (edge fn `buildSubject`/`buildBody`): subject `[Bachata Calendar] New Teachers Directory listing request -- <name>`; body lines `Section: Teachers Directory`, `Name`, `Phone`, `Event link: <url>`, `Submitted from: <source_url>`, `Submitted at`, `Triage: <admin url>`. So a teacher tip would arrive labelled "Event link".

### 4.3 Where it is opened from, and "event" copy

Openers (file:line):
- `src/components/ComingSoonGate.tsx:38` (renders the form for every locked gate), used by:
  - `src/components/AnimatedRoutes.tsx:88` `teachersGate` -> `:165` `/teachers`, `:166` `/city/:slug/teachers` (section `teachers_directory`)
  - `src/components/AnimatedRoutes.tsx:175-181` `/organisers` (`organisers_directory`)
  - `app/routes/teachers.tsx:110` `/teachers/:id` (`teacher_detail`)
  - `app/routes/organiser.tsx:221` `/organisers/:id` (`organiser_detail`)
  - `app/routes/venue-entity.tsx:93` `/venue-entity/:id` (`venue_detail`)
- `src/pages/Teachers.tsx:344-346` direct, behind the "Tell us" button (`:333-339`, label `TELL_US_LABEL` = 'Tell us', `teachersCity.ts:79`), shown with the note "No teachers listed in <city> yet. Know one?" (`teachersCity.ts:89,92`). Section `teachers_directory`.

Copy containing "event" in the form (`src/components/ListingRequestForm.tsx`):
- `:31` and `:69` 'Please fill in name, phone, and event link.'
- `:35` and `:65` 'Event link must start with http:// or https://'
- `:138` label 'Event link'
- `:150-151` 'Paste a link to your event &mdash; your Facebook event, Eventbrite, Instagram post, your own site, anything.'
- (identifiers only: `eventLink` state, payload key `event_link`, error code `invalid_event_link`)
Not "event" but event-oriented: success `:101` 'Thanks &mdash; I&rsquo;ll call you soon.'; button `:178` 'Send my details'.
Gate wrapper (not the form, but shown above it on gated pages): `ComingSoonGate.tsx:35-36` 'If you have an event you&rsquo;d like on the calendar, drop your details below &mdash; Ricky will call you to add it.'

### 4.4 Smallest teacher variant (proposal, not built)

Website-only, normal lane, size S:
- `ListingRequestForm.tsx`: add optional prop `variant?: 'event' | 'teacher'` (default `'event'`, so all 6 gate callers are unchanged) and optional `cityName?`. A small copy map per variant: label 'Their profile or Instagram link', helper 'Paste their Instagram, Facebook or website link.', validation 'Please fill in name, phone, and their link.' / 'Link must start with http:// or https://', success 'Thanks &mdash; we&rsquo;ll look them up and add them.' Heading, e.g. 'Know a teacher in <city>?', rendered by the form when variant is teacher (or by the caller in `Teachers.tsx`).
- `Teachers.tsx:346`: pass `variant="teacher"` and the requested city name.
- Payload stays `event_link` (the RPC column name); `section` stays `teachers_directory`.
- "kind = teacher + city" on the submission WITHOUT a DB change: the RPC ignores unknown keys and stores only the 6 columns, so `kind`/`city` keys would be silently dropped. What survives today: `section` (teachers_directory) + `source_url`. Website-only option: append a marker to source_url, e.g. `/city/leeds-gb/teachers?tip=teacher` (source_url is stored as free text and shown in the email as "Submitted from"). That gives the receiver kind + city with zero backend change.
- Tests: extend `teachersCity.matrix.test.tsx` (Tell us opens teacher copy, no "event" string on screen) and a payload test asserting section + source_url marker.

Proper version (careful lane, admin repo, size M): new enum value e.g. `teacher_tip` (or nullable `kind`/`city_slug` columns) in a migration in `bachata-admin-11april`, `submit_listing_request_v1` to read them, edge function `SECTION_LABELS` + body line "Link:" instead of "Event link:", admin list filter. Not needed for the minimal variant.

Gotchas found:
- Duplicate check matches on event_link HOST: every Instagram tip shares host `instagram.com`, so any second teacher tip (or event) with an Instagram link inside 30 days gets `duplicate_of_request_id` set to an unrelated request. Harmless to insert, misleading in triage. Fix is RPC-side (careful lane); flag it, do not fix in the S change.
- Phone is mandatory and success says "I'll call you" -- the tipster, not the teacher, gets the call. Acceptable for S; mention in copy.
- Email subject/body will still say "Teachers Directory" and "Event link" until the edge function changes (admin repo).

### Fix sketch

| Item | Lane | Files | Size |
|---|---|---|---|
| Teacher copy variant + source_url marker | normal (Website-only) | `src/components/ListingRequestForm.tsx`, `src/pages/Teachers.tsx`, teachers-directory tests | S |
| Real kind/city fields, email label "Link" | careful (DB + RPC + edge, admin repo) | admin migration, `submit_listing_request_v1`, `send-listing-request-email/index.ts` | M |
| Host-based duplicate false positives for social hosts | careful (RPC) | `submit_listing_request_v1` | S |

### SQL run (all SELECT, prod)

1. `SELECT proname, args, prosecdef, pg_get_functiondef(oid) FROM pg_proc ... WHERE proname='submit_listing_request_v1'`
2. `SELECT column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='listing_requests'`
3. `SELECT typname, string_agg(enumlabel) FROM pg_type JOIN pg_enum ... WHERE typname LIKE 'listing_request%'`
4. `SELECT tgname, tgrelid, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid IN (listing_requests, ..._email_log, ..._status_history)`
5. functions whose definition mentions `listing_request` + EXECUTE roles (pg_proc + has_function_privilege)
6. `SELECT month, section, status, count(*), count(source_url), count(duplicate_of_request_id) FROM listing_requests GROUP BY 1,2,3`
7. `SELECT pg_get_functiondef('listing_requests_after_insert_dispatch_email()')`
8. `information_schema.columns` for `listing_request_email_log`
9. `SELECT month, status, count(*), count(error) FROM listing_request_email_log GROUP BY 1,2`
10. `SELECT regexp_replace(source_url, '/[^/?]+$', '/:x') shape, section, count(*) FROM listing_requests GROUP BY 1,2` (path shape only, ids masked)
11. table grants for anon/authenticated/service_role + `relrowsecurity` + pg_policies on `listing_requests`
12. `left(pg_get_functiondef(...),1500)` for `admin_list_listing_requests_v1`, `admin_get_listing_request_detail_v1`
Plus MCP `list_edge_functions` and `get_edge_function send-listing-request-email` (read source).

### Verified / Not verified

Verified: client payload (code); RPC body, enum values, table columns, trigger, dispatch function, RLS/grants, admin RPC list and gating on `is_admin()` (live DB); edge function source v19 (deployed copy); row and email-log counts.
Not verified: the admin UI screen itself (admin repo not accessible -- inferred from RPC names and the triage URL in the email); Vault secret values (not read); whether Resend delivery actually reached the inbox beyond `status='sent'`; no form submission made (would write); no browser walk; whether prod has `VITE_ENABLE_TEACHERS_DIRECTORY=true` (Vercel env not read) -- if false, every teachers route shows the gate form, not the empty-city note.

## 6. Per-gap fix sketch (consolidated; no code)

| Gap (rank) | Fix | Lane | Files | Size |
|---|---|---|---|---|
| 1 picker | Option A: one UPDATE of `cities.is_active` (owner, admin side). For C: a `search_cities` variant that also returns the caller's ambassador or invite city. | A: owner action; C: careful | C: admin migration + `city-picker.tsx`, `citySearch.ts` | A: -, C: M |
| 2 venues | Client-side filter on `city_name` for the page city, plus a flat list outside London; or a `p_city_slug` param on the RPC. | normal (client) / careful (RPC) | `src/services/venuePublicService.ts`, `src/pages/Venues.tsx` | M |
| 3 London copy and titles | Pass `cityDisplay` from `useCity` into `buildSeoForRoute`; city-aware intros; keep London guide links only for London. Prerendered `/parties` and `/classes` stay London. | normal | `src/pages/{Parties,Classes,Tonight,Venues,Organisers,Dancers,DJs}.tsx`, `buildSeoForRoute.ts` | S |
| 4 empty states | One shared empty-city note ("Nothing listed in Bristol yet. Run a night? Tell us") opening ListingRequestForm. The calendar list and day modal are density-excluded files (CLAUDE.md), so ask Ricky first. | normal | `AllEventsList`, `HomeMapShell`, `CalendarPanel` (+ excluded calendar files only with Ricky's OK) | S-M |
| 5 festivals | Label or group off-city festivals ("Festivals elsewhere") on the client. | normal | `src/pages/Index.tsx`, `mapListDerivations.ts` consumers | S-M |
| 6 map centre | Centre on the city (lat/lng from `cities` if present, not checked) when there are no local pins. | normal | `EventMap.tsx`, `HomeMapCard.tsx`, `CityMap.tsx` | S-M |
| 7 people and search | City-neutral or city-aware titles; a "Nothing in <City> yet" + "Search all cities" empty state. | normal | `Dancers.tsx`, `DJs.tsx`, `SearchResults.tsx` | S |
| 8 Tell us | Teacher variant (Section 5): Website-only, with kind and city in `source_url`; real columns need careful lane. | normal (S) / careful (M) | `ListingRequestForm.tsx`, `Teachers.tsx` | S |
| 9 `/` redirect | Honour a city cookie at the edge, or keep London as the deliberate default. | careful (edge + cache) | `vercel.json`, `app/routes/index.tsx`, middleware | M |
| 10 organisers | Filter by `city_id` or drop the "in London" line. | normal | `src/pages/Organisers.tsx` | S-M |
| 11 SEO | Self-canonical for non-default cities; sitemap per active city; gate the teachers entry on count > 0. | careful (pinned by `app/cityCanonical.test.ts`) | `app/cityCanonical.ts`, `buildSeoForRoute.ts`, `app/routes/sitemap.tsx` | M |
| 12 `/cities` | Drive it from `cities.is_active`. | normal | `src/pages/Cities.tsx` | M |
| 13 city request | Align the insert with `requested_name, requested_by, context, notes` (as `dancer4Api.ts` does). | normal | `src/components/ui/city-picker.tsx` | S |
| P3 invites | Dancer invite `/join/<token>` route missing (0 sent). Admin invite sheet city picker uses `search_cities`. No link-based ambassador invite and no `invited_by` tracking. | normal (route, picker) / careful (ambassador, tracking) | `AnimatedRoutes.tsx` + new page; `AdminOrganisersPage.tsx`; admin migrations | M / S / L |

## Recommendation (after the table, as the brief asks)

**Choose A, but ship a small Website-only polish PR first (or the same day):**
- ranks 3 and 7 (titles and copy);
- rank 4 (actionable empty note; ask Ricky about the density-excluded calendar files);
- rank 8 (teacher "Tell us" variant);
- rank 6 (map centre).

Rank 2 (venues) should land before A too if possible, since it is the one Bristol URL that shows clearly
wrong data. Everything else can follow activation. B works mechanically today, since saves accept an inactive id,
but it leaves Bristol content hidden from the calendar and needs a hand edit per person. It is only worth it as a
stopgap for Jan alone. C is not needed: the only person blocked is the ambassador, and A unblocks Jan with no data risk.

## 7. Verified / Not verified

**Verified by running (prod, read-only):**
- Read with pg_get_functiondef or prosrc: `search_cities` (WHERE `c.is_active = true`, re-checked by the lead), `is_valid_city_slug`, `get_calendar_events_v2` (festival bypass), `get_map_events_v1`, `get_public_venues_list_v4`, `get_public_festivals_list_v1`, `get_organiser_event_counts`, `get_public_teachers_list_v1`, `list_public_djs_v1`, `get_popular_searches_v1`, `search_public_v7`.
- Called with the Bristol slug or id, then compared with London where that was useful.
- Catalog scans: every function, trigger, constraint and RLS policy that touches cities or city ids.
- `auth.users` count where the email matches `%jan%`: **0**.
- Invite tables: columns plus counts by status.
- `listing_requests`: counts by month and by section.
- The deployed `send-listing-request-email` edge function source (read only).
- Exact SQL for each is in the sections and appendices below.

**Read in code only:**
- Every UI empty state and copy string.
- CityContext and localStorage.
- All pickers and the Dancer4 flow.
- SEO specs, the sitemap, middleware, `vercel.json`, the OG renderer and the `/cities` page.
- The day-rollover parity script (not executed).

**Not verified:**
- No browser walk at 390x844.
- What an ACTIVE Bristol actually renders. It cannot be activated read-only, so it is inferred.
- Prod values of `organisersDirectory`, `VITE_ENABLE_CITY_REQUESTS`, `VITE_ENABLE_SEARCH_V7` and `VITE_ENABLE_TEACHER_DETAIL`.
- Whether `cities` has lat/lng.
- The admin repo source and screens: `123constante/bachata-admin-11april` is not accessible from this session, so admin answers are inferred from live DB bodies and grants.
- `redeem_organiser_invite_v1` (VOLATILE, not called).
- No write RPC was executed: "would a save succeed" comes from reading the function bodies, constraints, triggers and policies.

## Appendix A -- Part 1 group A evidence and SQL

#### (2) Evidence (file:line)

Home
- `app/routes/index.tsx:19`: `throw redirect("/city/london-gb", 307)` (bare `/` always goes to London).
- `src/components/AnimatedRoutes.tsx:92-95`: client CityRedirect uses localStorage `activeCitySlug`, falling back to `'london-gb'`.
- `app/routes/home.tsx:146-150`: `isRealCitySlug(citySlug)` -> `throwDetailNotFound("City")`. This is why an inactive Bristol 404s today.
- `src/lib/cityValidity.ts:14`: `is_valid_city_slug` checks slug AND cities.is_active.
- `src/contexts/CityContext.tsx:22-43,84-91`: city comes from the path, else localStorage. An inactive slug is not stored.
- `app/routes/home.tsx:139`, `src/pages/Index.tsx:78`: day keys come from londonDateKey / useLondonToday (Europe/London, same zone as Bristol).
- `src/pages/Index.tsx:109-152`: global festivals (`useUpcomingFestivalsGlobal`) are merged into every city's feed. On top of that, the RPCs already return festivals for any city (see SQL).
- `src/modules/home-map/EventMap.tsx:181` `const LONDON = [51.5085, -0.128]`; `:407` `center = LONDON` default; `:835-836` with no pins it calls `setView(center)`. Neither caller passes a centre (`HomeMapCard.tsx:133`, `CityMap.tsx:318`).
- `src/modules/home-map/mapPlaceholders.ts:31-36`: there is a placeholder image only for london-gb, so Bristol gets the flat grey plate.
- Empty copy: `src/modules/home-map/cards/AllEventsList.tsx:289` "Nothing on right now."; `HomeMapShell.tsx:161` "Nothing listed for today yet."; `:194` "No recent additions or updates."; `HomeMapCard.tsx:110` "Nothing on tonight - N venues on the map".
- SEO: `src/lib/seo/buildSeoForRoute.ts:46` reads the city from cityDisplay (home passes it, `app/routes/home.tsx:297,377`), so this one is correct for Bristol.

Calendar / rollover
- `src/lib/programDayRollover.ts:59-79`: getDisplayDay works on naive UTC wall-clock with ROLLOVER_HOUR 8. No tz and no city, so it is NOT London-hard-coded. Header `:4-9` says it is a byte mirror of admin, checked by `scripts/check-day-rollover-consistency-v1.mjs`.
- `src/components/calendar/CalendarGrid.tsx:29`, `CalendarListView.tsx:255`: "today" comes from useLondonToday (London calendar; harmless for Bristol).
- `src/modules/home-map/cards/CalendarPanel.tsx:192`: "Nothing listed for this day yet."

Events list (Tonight)
- `src/pages/Tonight.tsx:102,133-150,207`: citySlug from useCity -> get_calendar_events_v2.
- `:282`: "What's on for bachata dancers in London tonight".
- `:319-322`: empty copy.
- `:100`: `buildSeoForRoute('tonight')` with no cityDisplay -> CITY_DEFAULT 'London' (`buildSeoForRoute.ts:14,61`).

Event page
- `app/routes/event.tsx:104` and `src/modules/event-page/useEventPageQuery.ts:372` call event_view_p5 (STABLE; its body has no is_active).
- `src/modules/event-page/bento/BentoPage.tsx:572,578`: `?? 'Europe/London'` tz fallback.
- `app/routes/event.tsx:241,249`: title "<name> - Bachata Calendar".
- `src/modules/event-page/bento/blocks/ErrorScreen.tsx:18-19`: london-gb fallback for the error screen's back link.

Organisers
- `src/components/AnimatedRoutes.tsx:174-183`: `/organisers` only, behind flags.organisersDirectory (`src/lib/featureFlags.ts:14`).
- `src/pages/Organisers.tsx:267-273`: selects every organiser_profiles row with no city filter.
- `:302-304`: `p_city_slug: null`.
- `:562`: "{totalFiltered} in London".
- `:621,770`: "No organisers yet."

Venues
- `src/components/AnimatedRoutes.tsx:172-173`: `/venues` and `/city/:slug/venues` render the same page.
- `src/services/venuePublicService.ts:87-88`: `get_public_venues_list_v4` takes no city.
- `src/pages/Venues.tsx:37-72`: London area labels and the postcode-to-area map. A BS postcode gets null, which renders as "Elsewhere".
- `:379`: `v.address ?? 'London'`.
- `:566`: "Every bachata venue in London".
- `:592`: "No venues yet."

Classes / Parties
- `app/routes/parties.tsx:12`, `app/routes/classes.tsx`: meta `buildSeoForRoute("parties")` with no city.
- `src/pages/Parties.tsx:10,22-27` and `src/pages/Classes.tsx:22-31`: London copy and links to /london-bachata-guide and /learn-bachata-london.
- `src/components/EventCalendar.tsx:101,149`: citySlug from useCity, query enabled only when a city is set.
- `src/components/calendar/CalendarListView.tsx:294`: "No events found for <Month>" + "Clear filters".
- `src/components/calendar/DayDetailModal.tsx:379`: "No {events} found". This file and EventCalendar/CalendarListView are density-excluded: ask Ricky before editing.

#### (3) SQL run (read-only; all functions checked provolatile = 's' and no INSERT/UPDATE in their bodies first)

1. Volatility and is_active check. I scanned `pg_proc` for is_valid_city_slug, get_calendar_events_v2, get_map_events_v1, get_public_venues_list_v4, event_view_p5, get_organiser_event_counts, get_organiser_next_event_dates, get_organiser_last_event_dates_v1 and get_public_festivals_list_v1. All are STABLE. Only is_valid_city_slug mentions is_active.
2. RPC calls:
```sql
select (select public.is_valid_city_slug('bristol-gb')),            -- false
       (select public.is_valid_city_slug('london-gb')),             -- true
       (select count(*) from public.get_calendar_events_v2('2026-10-26T00:00:00Z','2026-11-02T00:00:00Z','bristol-gb',false)), -- 3
       (select count(*) from public.get_calendar_events_v2('2026-10-26T00:00:00Z','2026-11-02T00:00:00Z','london-gb',false)),  -- 39
       (select count(*) from public.get_map_events_v1('bristol-gb','2026-10-26','2027-01-24')),  -- 7
       (select count(*) from public.get_map_events_v1('london-gb','2026-10-26','2027-01-24')),   -- 396
       (select count(*) from public.get_calendar_events_v2('2026-10-01T00:00:00Z','2026-12-01T00:00:00Z','bristol-gb',false)), -- 7
       (select count(*) from public.get_public_venues_list_v4()),   -- 56
       (select count(*) from public.get_public_festivals_list_v1()); -- 8
```
3. Shape of Bristol's rows. Bristol map90 returned 7 occurrences of 2 distinct events, all `type='festival'`, 0 cancelled, all with coords, all 7 also in London's feed. By city_slug: london-gb 3, budapest-hu 4. Bristol calendar week returned 3 rows, all festival, city_slug london-gb.
4. Cause, read from the get_calendar_events_v2 body: `AND (cf.target_slug IS NULL OR ... d.city_id = cf.target_city_id OR lower(c.slug) = cf.target_slug OR COALESCE(d.type,'') = 'festival')`. Festivals bypass the city filter, and get_map_events_v1 passes city_slug_param through to the same source.
5. venues_v4 rows by city_name: London 53, Budapest 1, Turku 1, Gammarth 1. None in Bristol.
6. Existing Bristol data (counts only):
```sql
select (select count(*) from public.venues where postcode ~* '^BS[0-9]'),  -- 0
       (select count(*) from public.venues where address ilike '%bristol%'), -- 0 (of 67 venues)
       (select count(*) from public.event_series_p5 where default_city_id='6d4eca31-...'), -- 0
       (select count(*) from public.event_series_p5 s join public.venues v on v.id=s.default_venue_id
          where v.postcode ~* '^BS[0-9]' or v.address ilike '%bristol%'),   -- 0
       (select count(*) from public.organiser_profiles where city_id='6d4eca31-...'), -- 0 (of 51)
       (select count(*) from public.get_organiser_event_counts('bristol-gb')),  -- 0 (London 37)
```
   `venues` has no city_id column, so a venue's city is inferred: from postcode/address here, and from its events' city_id inside venues_v4. No Bristol venues, events or organisers exist, so the COALESCE(co.venue_id, e.venue_id) check has nothing to match.


## Appendix B -- Part 1 group B evidence and SQL

#### (2) Evidence bullets (file:line)

- Dancers: src/pages/Dancers.tsx:42 useSeo('dancers') no city; :66-70 global `.from('dancer_profiles')` no city filter; :195-199 empty copy + Create Your Profile.
- Teachers: src/pages/Teachers.tsx:63-75 active cities read; :80-92 inactive row name; :105-112 `get_public_teachers_list_v1(p_city_slug)`; :329-349 note + Tell us + ListingRequestForm section="teachers_directory"; :508-516 "See another city". src/modules/teachers-directory/teachersCity.ts:49-61 inactive -> London fallback; :88-93 note copy. teachersRedirect.ts:5 DEFAULT London, :13 `/teachers` -> stored city else London.
- DJs: src/pages/DJs.tsx:40, :44-47 p_city_id null, :95 "No DJs yet."
- Videographers: src/pages/Videographers.tsx:46-49, :107-108. Vendors: src/pages/Vendors.tsx:22,76,181.
- Search: src/pages/SearchResults.tsx:170,172,186,191-201,323-330,336-344,489-493; src/hooks/useSearchResults.ts:107,129-145; src/lib/searchRpc.ts:161,197-199. `searchPublic` (search_public_v2) has no caller and the RPC does not exist in prod -- dead.
- CityContext: src/contexts/CityContext.tsx:22-43 (path first, then localStorage `activeCitySlug`), :84-92 validates with is_valid_city_slug, no default city forced. No header city switcher exists (setCitySlug has no caller outside the context).
- Pickers: src/components/ui/city-picker.tsx:70 flag, :93 search_cities, :165-170 request insert with `user_id, city_name, country_name, status`, :180-185 falls back to a `world` city. MobileCityPicker.tsx / DesktopCityPicker.tsx: no importers. src/modules/organiser/home/onboarding/citySearch.ts:16. src/modules/organiser/edit-in-place/CitySheetBody.tsx:6-10.
- Dancer4: src/modules/organiser/home/onboarding/dancer4/dancer4Api.ts:5-11 (no is_active), :18-33 city_requests insert (correct columns), :36-40 fetchCityExists no is_active; dancer4Model.ts:10 prefill from redeem_organiser_invite_v1, :32 prefilled based_city_id, :47,:51,:90; Dancer4Flow.tsx:64-77, :274-275, :323-341.
- Signup city required: src/pages/Auth.tsx:786-798; src/components/auth/AuthStepper.tsx:274,607,658.
- SEO: src/lib/seo/buildSeoForRoute.ts:14 CITY_DEFAULT London, :25, :46-48 home path '/', :81,:86 'london-gb' path defaults. app/root.tsx:44-55 London default title/og. app/cityCanonical.ts:17-21 CLEAN_LISTINGS, :212-221 canonical rule. app/routes/sitemap.tsx:38-64 static list, :209-213, :235-238.
- Edge: vercel.json first redirect `/` -> `/city/london-gb`; app/routes/index.tsx:19; middleware.ts:70-71 matcher, :225-261 fetchCityMeta is_active, :347-392 city branch; src/components/AnimatedRoutes.tsx:91-95 (localStorage CityRedirect, shadowed by the server redirect).
- OG: app/lib/ogCardRender.ts:572-581; scripts/check-og-images.mjs:169 samples one /city/ URL.
- Cities page: src/pages/Cities.tsx:20-25, 63, 92, 116.

#### (3) SQL run (read-only) and results

1. Volatility: `select proname, provolatile, pg_get_function_identity_arguments(oid), prosecdef from pg_proc ... where proname in (search_cities, get_public_teachers_list_v1, list_public_djs_v1, is_valid_city_slug, search_public_v2/v4/v5/v6/v7, get_popular_searches_v1, get_active_cities, list_public_event_urls_v1, redeem_organiser_invite_v1, profile_complete_v1)` -> all 's' (STABLE) except redeem_organiser_invite_v1 'v' (not called). search_public_v2 and get_active_cities do NOT exist in prod.
2. Bodies via pg_get_functiondef: search_cities WHERE `c.is_active = true`; is_valid_city_slug `slug = lower(trim(p_slug)) AND c.is_active = true`; get_public_teachers_list_v1 has `c.is_active = true` AND requires avatar + first name + person_roles 'teaching'; list_public_djs_v1 has NO city is_active gate; get_popular_searches_v1 no is_active gate.
3. One SELECT:
   - `search_cities('bristol',20)` = 0, `search_cities('bri',20)` = 0, `search_cities('london',20)` = 1 -- Bristol 0 BECAUSE of is_active (row exists).
   - `is_valid_city_slug('bristol-gb')` = false (is_active), london-gb = true.
   - `get_public_teachers_list_v1('bristol-gb',200,0)` = 0, london-gb = 46. Bristol 0 for BOTH reasons (is_active gate, and 0 profiles based there).
   - `jsonb_array_length(list_public_djs_v1('6d4eca31-...'::uuid,200))` = 0 (0 rows; no is_active gate); `(null,200)` = 40.
   - `get_popular_searches_v1('bristol-gb',8)` = 0; london-gb = 0 (no searches in 14d either).
   - cities active = 1, total = 319; Bristol row: slug bristol-gb, name Bristol, is_active false, country GB, timezone set, description NULL, hero_image_url NULL.
4. `count(dancer_profiles where based_city_id = Bristol)` = 0 of 192; videographers in Bristol = 0; Bristol timezone = Europe/London; city_aliases for Bristol = 0.
5. search_public_v7 shape (section array lengths):
   - `('bachata','bristol-gb',8,false)`: cities 0, events 0, organisers 0, people 8, venues 2, vendors 0.
   - `('bachata','london-gb',8,false)`: events 8, organisers 8, people 8, venues 2.
   - `('bristol',null,8,false)`: all 0 (cities section gated by `ci.is_active`).
   - `('social','bristol-gb',8,false)`: venues 2, rest 0.
   Body read: events `sc.city_slug = lower(p_city_slug)`, organisers `c.slug = p_city_slug`; people and venues NOT city-scoped; cities `ci.is_active = true`. No rejection of an inactive p_city_slug -- Bristol's 0 events/organisers are genuinely 0 rows.
6. city_requests: columns `id, requested_name, requested_slug, requested_by, status, notes, context, created_at, approved_*, rejected_*, reject_reason`; 0 rows total; 0 matching bristol. `cities where slug='world'` = 0.
7. Simulation of activation: `count(cities c left join countries co where lower(c.name) like 'bristol%')` = 1 with country -- search_cities would return exactly Bristol once active.

