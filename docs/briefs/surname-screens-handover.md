# Handover: surname-hide, Website slice (Phase E)

Branch `claude/surname-screens` (from `main`). Brief: `docs/briefs/surname-screens.md` on
`arc/briefs-account-lifecycle`. Depends on admin PR #794 (DB). **Deploy order: #794 applied, then this PR.**
Never merged by the worker.

## Done
1. **Switch** (`src/components/profile/HideSurnameSwitch.tsx`, mounted in `src/pages/EditProfile.tsx`, the dancer's
   own-profile form; not the #743 account screens). Label "Hide my surname from the public"; helper text "Anyone viewing
   your profile or a line-up sees only your first name." Default shown. Initial value is a separate select of
   `hide_surname_publicly` off the person's own row, so a failed read (column not live yet) disables the switch with a reason
   instead of breaking the form. Disabled with a reason while saving, while first name or city is missing, or when the setting
   could not be read. `saveMyDancerProfile` sends `hide_surname_publicly` as a JSON boolean only when the value differs from
   the loaded one; an untouched save still short-circuits ("No changes to save") and sends nothing.
2. **Public reads** now go through `src/lib/publicDancerNames.ts` (`get_public_dancer_names_v1`, param `p_ids`,
   chunks of at most 500, deduped, unknown id fails closed to null surname/display_name). `resolvePublicName` takes
   `public_name` first.

| File | Showed | Fix |
|---|---|---|
| `src/modules/profile/dancerPublicProfile.ts` (`DANCER_PUBLIC_COLS`) | surname + display_name direct | columns removed; `attachPublicDancerName` merges the RPC |
| `src/pages/DancerProfile.tsx`, `app/routes/dancers.tsx` | page heading, `<title>`, og/meta via loader `entityName` | both queryFns call `attachPublicDancerName` (page, SSR cache and meta read one masked value) |
| `src/pages/Dancers.tsx` | card names | select drops the columns; `withPublicNames` |
| `src/components/CommunitySpotlight.tsx` | avatar alt + initials | same; on RPC failure surname is null |
| `src/pages/PracticePartners.tsx` | partner list names | list select drops surname; `withPublicNames`. Own-row read kept (own data) |
| `src/pages/OrganiserProfile.tsx` | team member names | select drops the columns; `withPublicNames`; `resolvePublicName` |
| `src/modules/organiser/dates/peoplePicker.ts` | picker rows (organiser side) | `withPublicNames` |
| `app/routes/sitemap.tsx` | name used only as an index filter (no title emitted) | select drops columns; `withPublicNames` |
| `src/lib/searchRpc.ts`, `src/pages/SearchResults.tsx` | two private `personName` copies | unchanged: RPC rows are already masked and null-safe. Sharing `renderPublicName` pulled `publicName` into the app shell and cost +1 first-load chunk on every route (bundle-budget), so the copies stay; dedupe later with the budget allowance raised on purpose |
| `src/pages/Teachers.tsx`, `TeacherProfile.tsx`, `DJs.tsx`, `DJProfile.tsx`, `app/routes/teachers.tsx`, `djs.tsx` | RPC names | unchanged: RPCs mask server side; `hide_surname:false` from `get_public_teachers_list_v1` is NOT used to abbreviate |
| `middleware.ts` (teacher og fallback) | `get_public_teacher_preview_v1` name | unchanged: masked by RPC, already null-safe |
| Event line-ups, JSON-LD performers (`buildEventJsonLd`) | `resolve_person_v1` names | unchanged: masked by RPC |
| Own editors (`EditProfile`, `DancerDashboard`, `PracticePartners` own row) | the person's own full name | unchanged on purpose (own row) |
| `src/pages/Videographers.tsx`, `lib/videographerPublicCols.ts` | `videographer` table first/surname | not `dancer_profiles`, not covered by the switch; **owner call** |

3. **Slugs untouched.** Public places a slug (which contains the surname for 51 of 56 prod profiles) shows: `app/routes/sitemap.tsx`
   (`/dancers/`, `/teachers/` locs), `src/lib/seo/buildSeoForRoute.ts` (canonical paths), `src/lib/breadcrumbs/siteIa.ts`,
   `src/components/AnimatedRoutes.tsx`, `middleware.ts`, `src/lib/searchEntities.ts`, links in `pages/Dancers.tsx`, `DJs.tsx`,
   `Teachers.tsx`, `PracticePartners.tsx`, `OrganiserProfile.tsx`, `DJProfile.tsx`, `TeacherProfile.tsx`, `DancerProfile.tsx`,
   `VendorDetail.tsx`, and event line-up links (`modules/event-page/*`). The address bar and the sitemap show the slug.
4. **Tests**: `tests/surnameHide.matrix.test.ts` (56 cases: switch off/on x person page, line-up credit, search result,
   teacher/DJ card, og/meta title, JSON-LD x with surname / no display_name / no surname; one-mapping equality; static
   guard that no public select lists `surname`/`display_name`; batching; payload; disabled reasons). **Red on unfixed code: 15
   failed**; green after. `fixesBatch.matrix.test.tsx` fake backend gained the names RPC.

## Next
- Follow-up DB migration revokes anon SELECT on `surname`/`display_name` (admin Open 2 tail); flip the KNOWN test.
- Owner: slug option; videographers.

## Verified / Not verified
See the PR body table. The fake RPC in the tests mirrors #794's SQL; **real DB responses before #794 is applied are NOT verified.**
No browser walk of the toggle at 390x844 / 360x640 was done (needs a signed-in session on prod-shaped data).

## Fail closed (follow-up, same branch)
Cause confirmed (local SSR build against a stub PostgREST returning 404 PGRST202 for `get_public_dancer_names_v1`, as prod
does until #794 is applied): unfixed head -> `/sitemap.xml` 500 and `/dancers/<slug>` 500; fixed -> both 200, first name only,
no surname. `fetchPublicDancerNames` (src/lib/publicDancerNames.ts) now never throws: any error (missing function, network,
malformed answer) yields no entries, ids absent from the result render first name only (never a select of surname /
display_name), and one `console.warn("[PUBLIC_DANCER_NAMES_UNAVAILABLE] ...")` per process carries the PostgREST code.
Tests: `tests/surnameHide.failClosed.test.ts` (6 RPC modes x 6 surfaces + logging + partial; 39 red on unfixed, green after).
Deploy order unchanged: #794 applied, then this PR; the PR is now safe before that.

CI jobs run locally (Actions may refuse to start on claude/* branches): tsc 0, check:rpc-typing 0, build 0, check:bundle-budget 0,
check:first-load-requests 0, lint:architecture 0, check:legacy-tables 0, check:legacy-program-rpcs 0, check:images (AUDIT_STRICT=1) 0,
check:mojibake 0, test:unit: 15 failures, all in 4 files (integrityCouldNotRun, eventViewCompat/occurrenceProgram/publicEventPageLineup
contract = live DB), identical before my change. NOT run: check:lighthouse / check:seo / check:og against a deployed preview
(need a live URL; replaced by the stub SSR check above), e2e, live-db gates.
