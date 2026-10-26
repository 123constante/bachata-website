# Brief: Bristol AUDIT (read-only; careful lane; opus)

Branch to push: `claude/bristol-audit`. Output: ONE file, `docs/audits/bristol-audit-2026-10-26.md`, plus a handover note in the PR body. NO source change, NO migration, NO prod write of any kind (Supabase read-only, SELECT only, counts only, no personal data).

## Why (owner's words, 2026-10-26)
The owner wants to launch Bristol (`bristol-gb`, id `6d4eca31-23f2-455c-b70c-66101d1ed5a6`, `cities.is_active = false`; London is the only active city of 319). The Bristol ambassador, Jan, phoned: "his Bristol city is not listed". Root cause already verified: the city picker (MobileCityPicker, DesktopCityPicker, `src/components/ui/city-picker.tsx`, organiser `CitySheetBody.tsx`, `src/modules/organiser/home/onboarding/citySearch.ts`, `CityView.tsx`) calls RPC `search_cities(p_query, p_limit)` whose WHERE is `c.is_active = true`. So nobody can pick Bristol until it is active, and the owner does not want it live until people exist. The owner will choose between: **A** activate Bristol early (one UPDATE of `is_active`), **B** keep it inactive and set each person's city by hand, **C** build an invited-only picker. Your table decides whether A is safe. Do not recommend a choice before the table; end with a recommendation.

Facts you can rely on (prod, read-only, 2026-10-26): 0 of 192 `dancer_profiles` are based in Bristol; 35 have no city; a teacher's city = `dancer_profiles.based_city_id`. Teachers directory flag `teachersDirectory` is ON; `/city/<slug>/teachers` shows "No teachers listed in <City> yet. Know one?" + a "Tell us" button for a city with none. Switcher and sitemap read `cities.is_active`. Rule: never INSERT cities.

## Questions (answer EACH, with file:line evidence and, for DB facts, the exact read-only SELECT you ran)

### Part 1 -- What does a visitor see for an ACTIVE city with 0 people? (decides option A)
For each surface below, state: (a) where its city comes from (URL param, stored choice, hard-coded London, `cities.is_active`), (b) what a Bristol visitor sees if Bristol were active and had 0 / 1 / many rows, (c) whether the empty state is actionable (says what the person can do), (d) any London assumption, (e) severity if wrong (blocker / ugly / fine). Use `git grep` on current `origin/main`, then run the real RPCs read-only for a stand-in empty city (pick any ACTIVE-shaped call with the Bristol slug or id as the argument; the RPCs take a slug/id, so passing Bristol returns what Bristol would get) and show the returned shape/count.
Surfaces: home, calendar (incl. day rollover, which must mirror admin), events list and event page for a Bristol-venue event, organisers list, venues list, classes/parties, dancers, teachers, DJs, videographers, vendors if present, search (autocomplete + results), city switcher / city picker at signup, onboarding and profile, sitemap and SEO titles/meta/JSON-LD (`addressCountry` etc.), the edge/SSR layer (any `api/` or edge file with a London default), OG images.
Present as ONE table: rows = surfaces, columns = city source / 0 people / 1 / many / actionable empty state? / London assumption? / severity. Then a gap list ranked by what a Bristol visitor would see wrong.

### Part 2 -- Who can pick Bristol, and when?
- Confirm the `search_cities` root cause from the live function body (`pg_get_functiondef`). List EVERY RPC/table/guard that restricts city choice to `is_active` (picker, `set_*_city` RPCs, profile save validators, organiser create, event create, onboarding). For each: if Bristol were inactive, does a direct save with Bristol's id succeed or fail?
- If Bristol is ACTIVE and Jan picks it, which profile column gets set (`dancer_profiles.based_city_id`, organiser city, event/venue city)? Does picking a city need a profile first (Jan has no `dancer_profiles`/`organiser_profiles` row by name, accounts in auth NOT checked: check `auth.users` for a Jan only via a COUNT of emails matching `%jan%` and report the count, never the addresses)?

### Part 3 -- Ambassador and invite mechanism
(a) Is there any ambassador / referral / "invited_by" concept in the DB or admin today (tables, columns, RPCs, admin screens)? Say "none" if none.
(b) The organiser INVITE mechanism that exists (invite links like the pending invite for an organiser, the `dancer-invite-send` edge function, the invite-type email worker, claim-my-profile emails for 43 pages): what does an invite carry (role, entity, city?), what does the invitee see when they land, can an invite carry a city (Bristol), can it open a Bristol-aware onboarding, who can create one (admin only? any signed-in user? an organiser?), is there a cap or expiry, and is any tracking kept (who invited whom, who joined)?
(c) Can the ambassador pick Bristol as their home city while Bristol is inactive (answered by Part 2; restate in one line)?
(d) What does an organiser with a Bristol event see while Bristol is inactive: their own dashboard, the public event page by direct link, the calendar, day rollover, search, and does event creation even accept a Bristol venue or city?

### Part 4 -- The "Tell us" form (empty-city note)
On `/city/<slug>/teachers` for a city with none, the "Tell us" button opens `src/components/ListingRequestForm.tsx`, an EVENT listing-request form (fields Your name / Phone / "Event link" / honeypot / "Send my details"). Answer:
1. Where do submissions go? Trace client call -> RPC/edge function (`send-listing-request-email`?) -> table/inbox/email. Name the table and who reads it (admin screen? an email address? nothing?). Count rows by month and by `kind`/source if a table exists (counts only).
2. Does the form know the page it was opened from, the city, or that it is a teacher request? What would the receiver see?
3. List every place the form is opened from, and every copy string that says "event".
4. Propose the smallest teacher variant (label "Their profile or Instagram link", heading, success text, a `kind = teacher` + city on the submission) and say whether it needs a DB/RPC change (careful lane) or is Website-only (normal lane). Do NOT build it.

## Hard limits
Read-only everywhere; no flag change; no `is_active` change; no city write; no migration; no `--no-verify`; plain git only; worker context cap 30% (careful): at that point push what you have with a clear `PARTIAL` marker and what is left. Verified / Not verified block at the end of the audit file: say which RPCs you actually ran, which surfaces you could only read in code, and anything you could not check.

## Deliverable shape
1. Executive summary (5 lines): is option A safe, what must be fixed first, what can wait.
2. The Part 1 table and ranked gap list.
3. Part 2 findings (restriction list).
4. Part 3 answers (a)-(d).
5. Part 4 answers and the proposed variant.
6. Per-gap fix sketch: lane (normal / careful), files, size (S/M/L). No code.
7. Verified / Not verified.
