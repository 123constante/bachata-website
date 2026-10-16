# Brief S4 -- New event (one question per screen)

Repo `123constante/bachata-website`, branch `claude/org-r1-new`, base `feat/organiser-r1` (wave 3). READ FIRST: `docs/organiser-rebuild/briefs/00-COMMON.md` applies with `<X>` = S4; plan = `docs/organiser-rebuild/R1-PLAN.md`. Sections: 4.1 (New event exception, D44 routes), 4.3 #2 #4 #6 #11, 4.4 (S4 row), 4.5 Flows ("Save as draft and leave"), 4.11 (`series.upsert` create facts, D44), 4.12 R3-1, R3-2, R3-7, D15, D19, D28, D29, D35, D44, D54, D55.

## Owns (4.4 row)
`flows/new/**` (What, Name, Venue, FirstDate, Time, Cover, Live), DELETE `events/NewEventPage.tsx` + `events/newEvent.ts` (+ their tests), `events/eventType.ts` (now exactly the two creatable formats + the read-only labels for the existing course/festival series), tests. Reads `shared/createModel.ts`, `shared/seriesCommands.ts` (`createDraftPayload`, S0b), `events/media.ts` + `shared/flyerUploadApi.ts` (cover upload, unchanged), `shared/runCommands.ts`.

## Boards (3.14 C5 group, amended by R3-1/R3-2/D44): C19 what -> C20 name -> C21 venue -> C22 first date -> C22b time -> C23 cover -> C24 Live
- `/new/what` (C19, D54): the question "What are you listing?" and exactly TWO rows, "Weekly night" (`recurring`) and "One night" (`one_off`); tap advances (D19/D35) to `/new/name?format=...`; the quiet link reads "Leave" here (nothing exists yet, D44).
- `/new/name` (C20): name field; Next creates the server draft with ONE `series.upsert` create via `createDraftPayload(name, format)` (`{name, format, timezone, organiser_ids}`), then `/new/:seriesId/venue`. From here every step shows the quiet "Save as draft and leave" link (returns Home; the draft shows on Home as `stale_draft` after 7 days, D6).
- `/new/:seriesId/venue` (C21): venue search (existing `publicVenues.ts` read-only; `createCity.ts` read-only); ONE `series.upsert {venue_id}`.
- `/new/:seriesId/date` (C22): list of the next 30 days (`comingDays`); tap = ONE `series.upsert {start_date}`; for `recurring` then ONE `series.set_recurrence { weekly on that weekday }` (D55, R3-2) before the time step; `one_off` sends nothing extra.
- `/new/:seriesId/time` (C22b): time; ONE `series.upsert {start_time}`.
- `/new/:seriesId/cover` (C23): photo via the existing upload; ONE `series.upsert {default_cover_image_url}`; the button "Choose a photo and go live" then sends ONE `series.set_lifecycle {to:'live'}` (the server gates on readiness + cover + a scheduled date, A1b; a refusal shows the server's reason as the recovery line).
- C24 = Done "Live - Friday 23 October, 20:00" (`next` = `/events/:seriesId`). No Undo.
- Course and festival are never creatable in R1 (R3-1): `eventType.ts` exports exactly two creatable formats; existing course/festival series stay editable through the other flows.

## Tests (4.5), RED first
- C19 renders exactly 2 options (R3-1); each step sends exactly ONE command of the pinned kind with `expected_version` + idempotency key (table over the steps); a Weekly night sends ONE `series.set_recurrence` after the first date and a One night sends none (D55); "Save as draft and leave" from every step after name leaves a draft that `homeJobs()` lists as `stale_draft` once 7 days pass (clock frozen and advanced, never a literal date); the draft created at name carries only `{name, format, timezone, organiser_ids}` (D44); Next on name/time is disabled until a value is typed (`aria-disabled` + reason); untouched Save sends nothing; `version_conflict` -> the R3-7 Done; no `SectionLabel` import; every control >= 44px.
- On the E2E project (real RPC, your sandbox; paste the result): creating a Weekly night and going live yields >= 2 scheduled dates and date 2 carries the seeded session (R3-2; the FIX-6 F-e regression re-checked under #750).
