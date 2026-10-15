# Handover: can event line-ups / teacher links leak a hidden surname? (PR #746)

Brief: `docs/briefs/surname-screens-lineups.md` (branch `arc/briefs-account-lifecycle`).
Previous handovers: `surname-screens-handover.md`, `surname-screens-typeerror-cycle-handover.md`.

## Answer

**No Website code change.** No line-up, programme, teacher-link or couple name on the Website reads a
name column directly. Every one is computed by the DB in `resolve_person_v1`, which admin PR #794
(`20261120200000_surname_hide_publicly_v1.sql`, branch `claude/surname-hide-db`) masks. **Today on prod
it is NOT masked**: #794 is not applied (prod has no `hide_surname_publicly` column and no
`get_public_dancer_names_v1`). Prod's `resolve_person_v1` builds `display_name` or `first_name || ' ' || surname`.
So the walk "identical to production" is expected. Nobody can switch the setting on until #794 lands,
and once it lands the same body masks it.

Two places are NOT closed by #794 and cannot be fixed in the Website (category b, rows 9-10 below).
They need an owner / DB decision.

## Trace: route to pixel (line-ups)

`/event/:id` -> `app/routes/event.tsx` loader / `useEventPageQuery.ts` -> RPC `event_view_p5(snapshot_compat)`
-> `_event_view_snapshot_compat_v1` / `_compute_effective_occurrence_p5` -> `_p5_native_people_v1` ->
`resolve_epp_person_v1(profile_id, profile_type, NULL, NULL)` -> `resolve_person_v1(id,'dancer')` ->
`dancer_profiles.display_name` else `first_name || ' ' || surname` (+ guest_dancer_profiles, 0 rows).
For `profile_type='dj'`, `dj_role_details.dj_name` wins. The Website parses `lineup.teachers[].display_name`
(`useEventPageQuery.ts` `parsePeople`), and `buildEventPageModel.ts:126` adds `href: /teachers/<uuid>`.
The programme grid (`EventScheduleGrid.tsx` `useProgramItems` / `useOccurrenceProgram`, rendered by bento
`PersonChip` / `PeopleStack`) calls `event_view_p5(legacy_compat)` -> `get_event_program_v1` /
`get_occurrence_program_v1` -> the same `resolve_epp_person_v1` with a NULL override. Festival pages call
`get_public_festival_detail_v2`, which emits names from `resolve_epp_person_v1` / `resolve_person_v1`. Its raw
`dp.surname` is only used in ORDER BY (#794 classifies it `public_delegated`).
Couples ("Carlos & Paz", "Abdel & Lety") and "Julian Mr M" are a profile's own `display_name` going down
the same path. When the switch is on, #794's `_public_display_name_v1` shows the first name (or the
first word of display_name).

## Table: every public name read (src/, app/, middleware.ts) and every name-bearing RPC the Website calls

| # | File | Renders | Source | Leaks? | Class / why |
|---|---|---|---|---|---|
| 1 | `src/modules/event-page/useEventPageQuery.ts`, `buildEventPageModel.ts`, bento line-up, `app/routes/event.tsx` (JSON-LD performers, og) | event line-up names, `/teachers/<uuid>` links | `event_view_p5` -> `resolve_person_v1` | no once #794 applies; yes on prod today but nobody can hide yet | (a) DB-side masked by #794 (computed live, nothing stored) |
| 2 | `src/modules/event-page/sections/EventScheduleGrid.tsx` (`useProgramItems`, `useOccurrenceProgram`), bento `PersonChip`/`PeopleStack` | programme talent, couples | `event_view_p5(legacy_compat)` -> `get_*_program_v1` -> `resolve_epp_person_v1(..., NULL override)` | same as 1 | (a) via #794 |
| 3 | `EventScheduleGrid.tsx:464` `useProgrammeNationalities` | flags only | `dancer_profiles.id, nationality` | no | no name column |
| 4 | `src/pages/FestivalDetail.tsx`, `app/routes/festival.tsx`, `fromFestivalSchedule` | festival line-up | `get_public_festival_detail_v2` -> `resolve_epp_person_v1`/`resolve_person_v1` | same as 1 | (a) via #794 (`public_delegated`) |
| 5 | `src/pages/Teachers.tsx`, `TeacherProfile.tsx`, `app/routes/teachers.tsx`, `middleware.ts:225` (og fallback) | teacher cards, `/teachers/<uuid>` page, og title | `get_public_teachers_list_v1`, `get_public_teacher_detail_v1`, `get_public_teacher_preview_v1` | no once #794 applies | (a) all three replaced by #794 |
| 6 | `src/pages/DJs.tsx`, `DJProfile.tsx`, `app/routes/djs.tsx` | DJ cards/page | `list_public_djs_v1`, `get_public_dj_v1` | no once #794 applies, except the stage name (row 10) | (a) |
| 7 | Search (`useSearchResults.ts`, `searchRpc.ts`, `DancerDashboard.tsx`) | person results | `search_public_v4/v5/v6` (masked by #794); `search_public_v2` does not exist on prod (call errors, renders nothing) | no | (a) |
| 8 | `DancerProfile.tsx`, `app/routes/dancers.tsx`, `Dancers.tsx`, `CommunitySpotlight.tsx`, `PracticePartners.tsx` (list), `OrganiserProfile.tsx`, `peoplePicker.ts`, `app/routes/sitemap.tsx`, `get_all_profiles_v1` users | dancer names | `get_public_dancer_names_v1` (`withPublicNames` / `attachPublicDancerName`), direct selects carry `first_name` only | no; fails closed when the RPC is absent | (a) already done on this PR |
| 9 | `src/pages/VendorDetail.tsx:140-157` (team list, `member.name`) | vendor team member names, `/dancers/<id>` links | `get_public_vendor_detail_v1` (SECURITY DEFINER, anon) -> `member_profiles.full_name` | **yes, after #794 too**; 0 `vendor_team_members` rows on prod today | **(b) needs DB change.** `member_profiles.full_name` is a stored copy. #794's stores census classes it `own_or_admin` (RLS), but this DEFINER reader hands it to anon, and #794's reader census does not list `get_public_vendor_detail_v1`. Fix belongs in admin: emit `_public_display_name_v1(...)` / `resolve_person_v1(dancer_id)` there, and add it to the census. |
| 10 | DJ line-up credits and DJ pages (rows 1, 2, 6) | DJ stage name | `dj_role_details.dj_name` (wins over the masked name in `resolve_epp_person_v1`, `list_public_djs_v1`, `get_public_dj_v1`) | **yes if the stage name contains the surname**: 3 of 11 stage names on prod do | **(b) owner decision.** A stored string typed by the person; #794 keeps "a DJ stage name still wins" on purpose. |
| 11 | `src/pages/PromoCodes.tsx:37` | `promo_codes.owner_display_name` | stored snapshot | possible | (b) owner decision, already listed by #794 (`owner_decision`) |
| 12 | `src/pages/Videographers.tsx:134` | `videographers.first_name/surname` | other table | not governed by the switch | owner call (already in the first handover) |
| 13 | Own editors (`EditProfile.tsx`, `DancerDashboard.tsx`, `PracticePartners.tsx` own row), `AuthGuard`, `useMyDancerSummary`, `useProfileCompletion`, `useUserIds`, `AuthCallback` | the person's own name / first name | own row | no | own data |
| 14 | `entities.name` (type person), `profiles.full_name` | not read by any public Website path (grep `from('entities')`: 0; `profiles` read only for `is_admin`) | - | no | DB masks both on switch (#794 review fixes, triggers) |
| 15 | Slugs in `/dancers/<slug>` / `/teachers/<slug>` links, sitemap | slug | `dancer_profiles.slug` | yes (51 of 56 slugs contain the surname) | left alone: owner decision 2026-10-13 |

No row is category (c), so no Website fix and no new red-first test: there is nothing for one to fail on.
The existing `tests/surnameHide.matrix.test.ts` / `surnameHide.failClosed.test.ts` stay as the guard for row 8.

## Shapes surveyed (prod `stsdtacfauprzrdebmzg`, SELECT only, counts)

- `hide_surname_publicly` column: absent. `get_public_dancer_names_v1`: absent (#794 not applied).
- `resolve_person_v1`, `resolve_epp_person_v1`, `event_view_p5`, `get_*_program_v1`, `_p5_native_people_v1`:
  no masking today; the override argument is NULL in both programme paths.
- `event_series_program_people_p5`: 283 rows, no `display_name_override` column.
- `dancer_profiles.display_name` set: 92. DJ stage names: 11, of which 3 contain the person's surname.
- `vendor_team_members`: 0 rows (row 9 is latent, not live).
- Name-bearing RPCs the Website calls, checked against prod bodies: all go through rows 1-8 except
  `get_public_vendor_detail_v1` (row 9) and `organiser_home_v1` (organiser-only, masked by #794's fixes).

## CI

Per-job table in the PR #746 body. Code is unchanged from 59a1a6f; this push adds only this doc.

## NOT verified

- The #746 Vercel preview was NOT re-walked (vercel.app is blocked from the sandbox).
- #794's masking was read from its SQL, not executed: it is not applied anywhere this worker can reach.
- Row 9 and row 10 are reported, not fixed.
