# People arc S4 -- the teacher world on the shared frame, plus the teacher-only 404 fix

DRAFT (orchestrator, 2026-10-24). Owner questions Q1-Q4 in the chat decide the [BRACKETED] lines before dispatch.
S0-S3 are merged (#975, #980, #984, #986); worlds sit behind `flags.personWorlds` (off on prod). Teacher pages are also off on prod (`flags.teacherDetail`).
Work branch: `claude/people-teacher-world` (new, from origin/main). Lane: normal if the 404 is a Website-only bug; STOP and report if the cause is in an RPC (that is a careful-lane admin-repo item).

## Read first
- Approved design: branch `claude/people-arc-worlds`, `docs/people-arc/worlds/` (`src/worlds.js` teacherWorld, `shots/*teacher*`, HANDOVER.md). Owner D7: KEEP the light lilac "studio timetable" card on a dark violet grid ground.
- Merged API: `src/modules/person-page/frame/**` (PersonFrame, RoleTabs, WorldPage shell, Avatar), `facts/` (worldNames, languageLine, gigDateLabel, timeLabel, wallDayOf, showsJoinInvite, FIND_A_PARTY), `worlds/tokens.ts` (teacher tokens, Fraunces).
- Pattern to copy: `worlds/dj/` and `worlds/dancer/` (model.ts + World component + matrix test). Handovers `docs/people-arc/s2|s3/HANDOVER.md`.
- Audit REPORT section on teacher (raw "London · BO", no photo rendered, Website card duplicated, 404).

## Owner decisions (binding)
D1' tabs on top, each role its own world; D3 thin first; D8'/D8'' invite "Dance bachata too? Get your own card" on every world, hidden when signed in (use `facts.showsJoinInvite`); D9 Back rule is in the frame; counts only from 2; full weekday names; hide empty facts; London default for a person with no city, saying "in London".

## Build (behind `flags.personWorlds`; OFF = teacher page exactly as today)
1. `/teachers/:id` flag ON: `WorldPage` > `PersonFrame` > teacher world. Add `'teacher'` ground to `src/components/layout/pageGrounds.ts` (dark violet grid, tokens from `worlds/tokens.ts`), footer straight after content (D13 via the shell).
2. Card: TEACHER band, photo or initials (`Avatar`, teacher colour), name (`facts.worldNames(..,'teacher')`) + flag (NEVER the raw code "BO"), "Teaches in <city>", "Speaks Spanish, English" (`languageLine`, never "es").
3. "Next class" / "Next classes" rows lead with the time (`timeLabel`), date under it (`gigDateLabel`, London wall clock via `wallDayOf`); no class -> one "Classes this week" button to the classes calendar (like the DJ "Find a party"). Muted line "No classes on the calendar yet." / "No classes coming up yet." above it (D11 pattern).
4. Contact: ONE row, website shown once (today it shows twice); button reads "Learn with <first name>". [Q2: what happens to the old detail sections.]
5. Teacher-only 404: `/teachers/<id>` 301s to the slug then "Page not found" for teacher-only people (63 of 170, on main). Diagnose read-only (loader `app/routes/teachers.tsx` uses `resolveEntityInLoader(qc,'dancer_profiles')` and `get_public_teacher_detail_v1`; client `src/pages/TeacherProfile.tsx`). Red-first test with a teacher-only fixture. If the fix needs SQL: stop, write the exact finding in the handover, do NOT write SQL here.
6. Raw-code fixes: nationality code text -> flag; language codes -> full names; years-teaching scale -> one shared rule or hidden [Q2].
7. `AlsoRoles`/old role bar stays only on the flag-OFF path.

## Prod shapes (read-only survey first; counts only, prod `stsdtacfauprzrdebmzg`)
teacher-only / +dancer / +DJ x photo/none x city/none x nationality/none x languages/none x years/styles/lessons filled/none x 0/1/2+ upcoming classes x past-only x long name x claimed/unclaimed x Madrid/Barcelona congress-only teachers (class abroad). Every shape gets a 390x844 + 360x800 shot, flag ON.

## Tests (red first where fixed)
Table-driven shape x teacher world matrix; flag OFF unchanged; the 404 regression; identical-frame test now includes the teacher world (Back/Share/tabs boxes equal across DJ/Dancer/Teacher); no copy that points at a missing control; untouched state sends nothing.

## Design Gate 4 + record
Contrast >= 4.5 (light card AND dark ground), taps >= 44px explicit px (site html is ~13.5px on phones), no clipping, no sideways scroll, all empty/loading/error states actionable. Record `docs/design/people-s4-teacher-world.md` linked in the PR body. Stage 5 critique is a separate worker afterwards; do not self-certify.

## Checks, PR body, handover
Run every CI job step that applies; per-job table in the PR body; sections `## Verified on real data` with lines starting EXACTLY `- Shapes surveyed: `, `- Checks run: `, `- NOT verified: ` (no bold, nothing before the colon) and `## Phone QA`. Push once. `docs/people-arc/s4/HANDOVER.md`: head sha, PR, shape table with shots, how the orchestrator turns the flag on (`preview-deploy.mjs --flag VITE_ENABLE_PERSON_WORLDS=true`, plus `VITE_ENABLE_TEACHER_DETAIL=true` for teacher pages), not verified. Context under 35%.
