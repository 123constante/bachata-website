# Search v7: one row per person (shared brief, read first)

Owner decision 2026-10-20 (the owner is not technical and judges screens on a phone): public search must show ONE row per human, not one row per role.
Tapping that row opens ONE person page with the roles as tabs. Old `/teachers/:id`, `/djs/:id`, `/dancers/:id` URLs keep working.

## Facts (prod survey, SELECT-only, counts)
- One persona per human: `dancer_profiles.id`; every role is a `person_roles` row (`teaching`, `dancing`, `djing`, `organising`, `performing`) with the SAME `person_id`. 158 active personas; 72 hold 2+ roles
  (dancing+teaching 34, dancing+djing+teaching 22, dancing+djing 10, four roles 3, other 3). 62 teaching-only, 19 dancing-only, 4 DJ-only, 1 performing-only, 1 djing+teaching.
- Cause: `search_public_v6` builds `person_match` as one row per (persona id, role) and returns separate `teachers`, `djs`, `dancers` arrays carrying the SAME `id`.
  The Website renders one row per array (`src/lib/searchEntities.ts`, `src/hooks/useSearchResults.ts`, `src/lib/searchRpc.ts`, the header search and overlay) and links to `/teachers/:id`, `/djs/:id`, `/dancers/:id`
  (framework routes `app/routes/teachers.tsx`, `djs.tsx`, `dancers.tsx`).
- Organisers (`organisers` array), venues, vendors, events, cities are different things and stay as they are.

## Pinned interface between the slices (do not deviate; if you think it is wrong, stop and write why in the handover)
`public.search_public_v7(...)` has EXACTLY v6's 11 arguments (same names, types, order, defaults) and returns jsonb with v6's keys EXCEPT `teachers`, `djs`, `dancers` are replaced by ONE key:

    "people": [ { "id": uuid, "first_name": text, "surname": text|null, "display_name": text, "photo_url": text|null, "avatar_url": text|null,
                  "slug": text|null, "nationality_code": text|null,
                  "roles": ["teacher","dj","dancer"]   (subset, always in that order, never empty),
                  "primary_role": "teacher" | "dj" | "dancer"   (first of roles) } ]

- `total_count` counts a person ONCE. Everything else (events, organisers, venues, vendors, cities, query, unrated_event_count, did_you_mean) is v6 behaviour, unchanged.
- Visibility is unchanged: a persona is listed only if it is active, not archived, matches the query exactly as v6 does, and holds an ACTIVE `teaching`, `djing` or `dancing` role (a persona with only `performing` or `organising` stays out, as in v6).
- Privacy helpers unchanged: `_public_surname_v1`, `_public_display_name_v1`, `_public_person_nationality_code_v1(id, 'dancer')`.
- Ranking: per persona, best of (similarity score + ln(1 + clicks_30d) * 0.25), where clicks_30d is the SUM of the click counts for entity types teacher, dj and dancer for that id; ties by `updated_at` desc. LIMIT is `p_section_limit`, applied to people.
- Website route: `/people/:id` (id = persona id, the same ids the old pages use).
- Telemetry: keep logging the old entity kind of `primary_role` (teacher / dj / dancer). Do not add a new entity_type.
- Flag: `searchV7` (Website `src/lib/featureFlags.ts`), default OFF. Flag off = behaviour identical to today (the v6/v5/v4 path untouched).

## Rules for every worker (owner's standing rules)
- Plain git only (`git fetch`, `git show`, `git push`). Never `gh api`. Write shell commands WITHOUT variables, loops or `$(...)` where a plain command works.
- Never merge, never approve, never `--no-verify`. Any PR must be bot-authored. The Supabase connector is READ-ONLY on production (SELECT only); apply and test only on a Supabase BRANCH project you create, never prod.
- Push ONCE at the end of the slice (plus one PARTIAL push if you hit your limit). No WIP pushes. The last commit subject ends with `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]`).
- Context: at 25% start nothing new; by 30% push and write the handover (done / left / exact next steps). Leave the handover doc your brief names.
- Run EVERY CI job step from `.github/workflows/*` in your sandbox (read the workflow files) and put the per-job table (command + exit code) in the PR body and handover. GitHub Actions on billed runners may refuse with a payments annotation: that is NOT a code failure; do not ask for billing.
- Check a PRODUCTION build (`npm run build`) for Website work, not only the dev server.
- Red first: write the table-driven tests, run them against the UNFIXED code (v6 / current UI), show they fail for the right reason, then fix.
- Every empty state says what the person CAN do; a control that cannot work is disabled with a reason; no text points at a control that is not on screen.
- Final report: head SHA, branch, PR number, per-job checks, and an honest "Verified / Not verified" block.
