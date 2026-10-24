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
