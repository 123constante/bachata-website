# People arc S4 -- the teacher world -- handover

- Branch: `claude/people-teacher-world` (from `main` 03e5241). Brief: `briefs/PEOPLE-S4-teacher-world-brief.md` on
  `brief/people-arc` (sha 794068d0). Head: `git log -1 origin/claude/people-teacher-world`. PR: the open PR from this
  branch into `main` (opened right after the one push, so its number is not in this file).
- Design record (decisions, Gate 4 self-checks, shape table with shots): [`docs/design/people-s4-teacher-world.md`](../../design/people-s4-teacher-world.md).
- Behind `flags.personWorlds`. Flag OFF = today's `/teachers/:id`, unchanged (tested). The `/people/:id` tab is
  unchanged too (the world never renders embedded).

## The teacher-only 404: cause is in SQL (admin repo, careful lane) -- NOT fixed here

Read-only diagnosis on prod (2026-10-24). The route is fine: `resolveEntityInLoader(qc, 'dancer_profiles', ..)`
finds the row and 301s the uuid to the slug, then `get_public_teacher_detail_v1(p_entity_id)` returns **no row**,
so the loader throws `throwDetailNotFound("Teacher")`. The RPC's WHERE requires, besides an active `teaching`
role and a live row:

```
AND tp.first_name IS NOT NULL AND btrim(tp.first_name) <> ''
AND tp.avatar_url IS NOT NULL AND btrim(tp.avatar_url) <> ''
AND tp.based_city_id IS NOT NULL
```

Counts (active teaching roles, 132): 59 render. Of the 64 teacher-only people (no dancing role) only 2 render;
the 62 others fail the gate: 25 have a first name but no photo and no city, 17 no name/photo/city, 11 photo +
city but no first name, 7 photo but no name/city, 1 inactive, 1 (DJ + teacher) no photo/city. Teachers who also
dance almost all pass (the dancer onboarding collects photo + city).

Fix options for the admin repo (owner decision, not taken here): relax the photo/city gate (the world already
falls back to initials and "Teaches in London"), and/or resolve the name from `display_name` when
`first_name` is empty; or keep the gate and stop linking those people to `/teachers/:id`. The website test
`404 regression` pins only the Website half: an RPC with no row gives an actionable not-found in the world shell.

## Turning the flag on for the preview

`node scripts/preview-deploy.mjs --flag VITE_ENABLE_PERSON_WORLDS=true --flag VITE_ENABLE_TEACHER_DETAIL=true`
(both are build-time `VITE_` vars; teacher pages are off on prod without the second). Then open
`/teachers/melita-somos`, `/teachers/llf-malva-marina-montenegro`, `/teachers/magda-sobolewska`.

Local equivalent (what the worker ran): export `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (prod anon)
and both flags in the shell, `npm run build`, then
`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/_serve-build.mjs --port 4173`,
then copy `docs/people-arc/s4/walk.mjs` under `node_modules/.cache/` and run it.

## Shapes (prod survey 2026-10-24, read-only, counts only)

| Shape | Prod count (of 59 rendering) | Walked |
|---|---|---|
| photo + city | 59 (the RPC requires both) | all |
| nationality code (flag) | 15 | melita-somos, ramiro-zapata, llf-* |
| languages (11 of 12 stored as codes) | 12 | melita-somos, nico, unclaimed-645cb1ef |
| years teaching / styles / private lessons | 0 / 3 / 1 | not shown on the world (Q2, design record) |
| website / Instagram only / no link | 46 / 1 / 12 | ramiro-zapata / unclaimed-645cb1ef / viola-palmai |
| no class / past only / 1 / 2+ (max 3) | 28 / 6 / 18 / 7 | viola-palmai / magda-sobolewska / ramiro-zapata / melita-somos |
| teacher-only / +dancer / +DJ | 2 / 32 / 25 | llf-enoch-lopez / nadina-toso / melita-somos |
| longest name (23) | 1 | llf-malva-marina-montenegro (wraps to 2 lines, no clipping) |
| claimed / unclaimed | both | unclaimed-645cb1ef |
| Madrid/Barcelona congress-only | llf-* (Madrid) | no upcoming class today, so the "class abroad" row is matrix-tested only |

Screenshots: `docs/people-arc/s4/shots/<slug>-390.png` and `-360.png` (360x800), flag ON, prod data.

## API (additive)

- `worlds/teacher/`: `TeacherWorld`, `teacherWorldView` (pure), `TeacherWorldPage` / `TeacherWorldLoading` /
  `TeacherWorldMissing`, `CLASSES_LABEL`, `DEFAULT_CITY`, `INVITE_LABEL`.
- `worlds/tokens.ts`: `TEACHER_PAPER` (band, rules, grid, row inks).
- `pageGrounds.ts`: `'teacher'` ground (solid dark violet; first load). `frame/WorldPage` maps the teacher world to it and draws the timetable grid itself (`TEACHER_GRID`), so the grid stays out of every route's first load (/event is at 380.8 of 381 KB).

## Not verified

- Real photos: the image host is blocked from the sandbox, so every face rendered the initials fallback.
- The Vercel preview with both flags (the worker could not set Vercel env: needs owner / orchestrator).
- A class held abroad on a real page (no prod teacher has one upcoming today).
- The `/code-review` pass (the owner types it); the diff was self-reviewed.
- Stage 5 critique: separate worker.

## S4 critique (Design Gate stage 5) -- fresh worker, one fix pass

Brief: `briefs/PEOPLE-S4-critique-brief.md` on `brief/people-arc` (sha cf7189d9). Full critique, ordered fix list and
every number: [`docs/design/people-s4-critique.md`](../../design/people-s4-critique.md). Probe:
`docs/people-arc/s4/critique-probe.mjs`. The design record's numbers are refreshed; the shots in `shots/` are retaken
(11 teachers x 390 / 360, added `thayna` = styles, `virginia-timoon` = private lessons).

Local build note: the sandbox's `VITE_SUPABASE_URL` points at a non-prod project (every teacher 404s). Build with the
prod URL and its public anon key (read-only) plus both flags to walk real data.

### What changed

| # | Fix | Files |
|---|---|---|
| 1 | Load jump 0.46-0.55 -> 0.03-0.13: the loading page holds the room of the page it turns into (frame bar, tabs row, card, one class, contact, invite for signed-out), from shared `TEACHER_ROOM` / `TABS_HEIGHT`; the contact row shows while the classes load; card top padding in px (the 13.5px phone root made `pt-4` 2px off). No new read. | `TeacherWorldPage.tsx`, `TeacherWorld.tsx`, `frame/PersonFrame.tsx` (export only) |
| 2 | No city = no "Teaches in" line (was "Teaches in London"). | `model.ts` |
| 3 | Extra detail (years, styles, private lessons) only when filled, in one box under the classes. | `model.ts`, `TeacherWorld.tsx`, `pages/TeacherProfile.tsx` (flag-ON branch only) |
| 4 | No first name: contact label "Learn more" (was "Learn with Teacher"); h1 "Teacher", never empty. | `model.ts` |
| 5 | The grid fades into the plain ground at the page box's bottom (was a hard line 54px above the footer). | `frame/WorldPage.tsx` |
| 6 | Raw U+00B7 (middle dot) -> the `\u00B7` escape. | `TeacherWorld.tsx` |

Tests: 20 new / changed cases in `teacherWorld.matrix.test.tsx` (S4 critique blocks), run red against the unfixed
code first (20 failed), then green. Mutation: a padded wrapper around the teacher's PersonFrame reds
`worldShellGuard`; an extra `pl-4` on the teacher page box reds the shell test.

### Owner calls (not in code)

- Georgia's flag shows as a grey "GE" sticker (shared flag art has none for GE). Recommend: add the missing art, own PR.
- "Classes this week" goes to the visitor's city (London) calendar even under a Madrid teacher. Recommend: keep.
- Past-only teachers say "No classes coming up yet." (D11 says "No classes on the calendar yet."). Recommend: keep the split.
- Teacher-only pages: the held tabs row closes when roles answer (0.057). Recommend: keep (57 of 59 hold 2+ roles).

### CI, run locally on the fix head

| Job | Steps | Result |
|---|---|---|
| Source Integrity (architecture-guard) | integrity (`bash bin/check-integrity.sh`, AUDIT_STRICT=1), legacy-tables, legacy-program-rpcs, lint:architecture, check:images AUDIT_STRICT=1, image-widths +self-test, plan-hygiene self-test, workflow-artifact-policy +self-test, prove:entry-point +self-test, mojibake +self-test + grep | all pass (integrity is mode 100644 in git, so it needs `bash`/chmod as CI does) |
| Typecheck | check:rpc-typing, check:wallclock-brand; full `tsc -p tsconfig.app.json` | pass; tsc 94 errors with and without this pass (none in touched files) |
| Unit & Contract Tests | test:unit; dancer-area isolation + self-test | 13328 pass, 15 fail in 4 suites (3 live-DB contract suites + integrityCouldNotRun) -- the same 15 the builder saw on unchanged main; person-page 874/874; isolation passes |
| Lint | npm run lint | 21 of 22 links pass; the 22nd is check:integrity exit 126 (not executable in this checkout; passes with bash) |
| Perf Budget | self-tests, build, bundle-budget, first-load-requests, chunk-cycles | pass: /event 380.8 of 381 KB (unchanged), dancer-app 367.7 of 368 |
| Phone QA (suite) | playwright.phone.config.ts | 271 pass, 74 skipped, 1 fail (keyboard: dancer setup, unrelated) -> passes 4/4 on re-run |
| ci-budget / doc-weight | | cannot run here (need CI_BUDGET_GITHUB_TOKEN / GITHUB_REPOSITORY) -- rely on PR CI |
| E2E smoke, Phone QA (build) | | not run locally (no teacher page in either spec list) -- rely on PR CI |
| DB Contract Check | | not touched (no SQL); was red on main per the builder |

### Verified / Not verified

- Verified (prod data, flag ON, Chromium): 11 teachers at 390x844 and 360x800 (+3 at 430x932): 0 page errors, no
  sideways scroll, no clipping, every tap >= 44px; frame boxes identical on teacher / DJ / dancer worlds at 360, 390,
  430; layout shift measured before and after; Back (fresh tab -> /teachers; tab -> Back returns); focus ring by
  keyboard; contrast from tokens (lowest 7.16); flag OFF unchanged (matrix test).
- Not verified: real photos (image host blocked), the Vercel preview with both flags (needs owner: Vercel env), a real
  class held abroad (none upcoming on prod), the no-photo / no-city / no-first-name shapes on a real page (0 render
  until the admin RPC gate is relaxed -- matrix-tested only), a real phone, `/code-review` (owner types it).

### Ready-to-paste PR body

```
## Summary
- `/teachers/:id` with `flags.personWorlds` ON (teacher pages also need `flags.teacherDetail`): the teacher world
  ("studio timetable", owner D7) on the shared frame -- Back + Share, role tabs, a light lilac card on a dark violet
  grid ground, "Next class(es)" time-first with full weekday dates, ONE contact row, the D8'' invite.
- S4 critique fix pass (docs/design/people-s4-critique.md): the page no longer jumps while it loads (layout shift
  0.46-0.55 -> 0.03-0.13, no new read); no city = no "Teaches in" line; years / styles / private lessons only when
  filled, under the classes; no name -> "Teacher" h1 and "Learn more" (not "Learn with Teacher"); the grid fades
  into the ground above the footer instead of a hard line.
- Flag OFF is exactly today's page.
- Teacher-only 404: the cause is the RPC gate (SQL, admin repo) -- see docs/people-arc/s4/HANDOVER.md.

## Verified on real data
- Shapes surveyed: read-only prod counts 2026-10-24 -- 132 active teaching roles, 59 render; nationality 15,
  languages 12, years / styles / private 1 / 6 / 1 stored (0 / 3 / 1 rendering + walked thayna, virginia-timoon),
  links website / Instagram-only / none 46 / 1 / 12, classes none / past / 1 / 2+ 28 / 6 / 18 / 7.
- Checks run: teacherWorld.matrix.test.tsx (every shape x flag ON/OFF, red-first for the critique fixes); every CI
  step in the handover table; browser walk of 11 prod teachers at 390x844 and 360x800 (+430x932): 0 errors, no
  sideways scroll, taps >= 44px, frame boxes identical on teacher / DJ / dancer worlds, layout shift measured.
- NOT verified: real photos, the Vercel preview with both flags, a class abroad on a real page, the no-photo /
  no-city / no-first-name shapes on a real page (gate not yet relaxed), a real phone, /code-review.

## Phone QA
- Sizes checked: 390x844, 360x800, 430x932 (flag ON, prod data)
- Walked: /teachers/melita-somos, nadina-toso, ramiro-zapata, llf-malva-marina-montenegro, magda-sobolewska,
  unclaimed-645cb1ef, viola-palmai, nico, llf-enoch-lopez, thayna, virginia-timoon (shots in docs/people-arc/s4/shots)
- Not verified: real phone, real photos, Vercel preview
```
