# People arc S7 -- roles in the /dancers/:id loader (the DJ-holder page shift)

Brief: `briefs/PEOPLE-S7-roles-in-loader-brief.md` on `brief/people-arc` (sha 61fa4446). Fixes S6 critique
finding 1 (`docs/design/people-s6-critique.md`). Branch `claude/people-dancer-roles-in-loader`.

**No visible change except less movement.** Same tabs, same 64 px reserve, same previews: they are now in the
served HTML instead of arriving ~1.7 s after load.

## What changed

- `app/routes/dancers.tsx` loader, ONLY when `flags.personWorlds` is on: `seedPersonSnapshot(qc, ref.id)` runs
  beside the existing reads (started right after the dancer read is issued, awaited after `publicPageLoad`), and
  writes the answer under `['person-snapshot', id]` before `dehydrate(qc)`.
- `src/modules/person-page/seedPersonSnapshot.ts`: the SAME read as the client hook and the `/people/:id`
  loader (`loadPersonSnapshot`, closed-page filter included), raced against its own deadline
  (`PUBLIC_PAGE_DEADLINE_MS`, 2.5 s, `loadPublicPageV2`'s pattern). Never rejects. Failure or a late answer =
  nothing seeded = today's behaviour (the hook reads after mount); a late answer is dropped.
- `src/modules/person-page/usePersonRoles.ts`: the key is now one export (`personSnapshotKey`) shared by the hook
  and the seed. The hook itself is unchanged: with a seeded cache, `useQuery` returns the answer on the server and
  on the first client render (`enabled` is still false until mount, so both match), and after mount a stale
  answer (edge-cached HTML older than 5 min) refetches as before.
- Unchanged: `entityName`, meta, OG, cache headers, cache tag (`stampDancer`) and the degraded edge-TTL rule.
  Flag OFF: the seed is never called and the dehydrated state is exactly `['dancer-profile', id]` (test).

## Before / after CLS (local production build, prod data, Chromium, 6 s after load, largest session window)

Teacher pages closed (prod today: `VITE_ENABLE_TEACHER_DETAIL=false`):

| Profile | Shape | main 390 | main 360 | S7 390 | S7 360 | tabs in served HTML |
|---|---|---|---|---|---|---|
| `brito` | DJ, undated | 0.161 | 0.164 | **0.037** | **0.036** | 2 (was 0) |
| `bobby-blanco` | DJ, dated | 0.141 | 0.143 | **0.017** | **0.015** | 2 (was 0) |
| `b` | teacher + DJ, dated | 0.128 | 0.132 | **0.005** | **0.005** | 2 (was 0) |
| `ben` | dancer only | 0 | 0 | 0 | 0 | 0 |

Teacher pages open (`VITE_ENABLE_TEACHER_DETAIL=true`, the preview the orchestrator builds):

| Profile | main 390 | main 360 | S7 390 | S7 360 | tabs in served HTML |
|---|---|---|---|---|---|
| `brito` | 0.161 | 0.164 | **0.037** | **0.036** | 2 |
| `bobby-blanco` | 0.141 | 0.143 | **0.017** | **0.015** | 2 |
| `b` | 0.150 | 0.156 | **0.027** | **0.029** | 3 |
| `ben` | 0 | 0 | 0 | 0 | 0 |

Target met: < 0.1 on all, and the tabs shift is gone (0 for the tabs). What is left is S6 finding 2, which the
owner kept: the 64 px reserve collapsing when an undated DJ's dates answer empty (`brito` 0.037, `kal` 0.037), or
growing into "Coming up" + a preview (`bobby-blanco` 0.017). Raw numbers: `docs/people-arc/s7/cls-*.json`,
script `docs/people-arc/s7/cls-walk.cjs`.

Walk, S7 build, teacher pages closed, 390x844 and 360x800 (24 renders): `brito`, `bobby-blanco`, `b`, `ben`,
`aitor-angelica-tbf`, `pao-pao-army`, `florian`, `alex-boneva`, `alexa-bzuk26`, `kal`, `john-otaran`,
`nickchata`. Every one: HTTP 200, tabs in the served HTML == tabs after load, 0 hydration errors in the console,
no sideways scroll, CLS <= 0.037. Teacher holders with pages closed (`alex-boneva`, `alexa-bzuk26`) serve no tab
and no reserve; no served page links to `/teachers/` while closed (curl, 4 holders).

## Review findings left to the owner (not built: the brief forbids or they are out of scope)

1. **Cache tags.** The served HTML now carries the DJ / teacher tabs, but the page is still tagged only
   `stampDancer` (brief: do not change edge-TTL tags). A `dj` purge does not refresh `/dancers/<slug>`; until the
   edge TTL expires the cached page serves the old tabs (the client corrects them after mount once the seed is
   older than 5 min). Recommendation: a follow-up that adds `djTag`/`teacherTag` to the dancer page's tags.
2. **Degraded TTL.** A failed / late seed is cached for the full edge TTL (brief: no TTL change). That page is
   today's page (tabs client-side), so the cost is the old shift, not a broken page. Recommendation: bound it
   with `DEGRADED_EDGE_TTL_SECONDS` like `loadPublicPageV2` in a follow-up if the owner wants.
3. **Extra reads.** With the flag ON every `/dancers/:id` loader run (SSR and client navigation) also reads the
   roles RPC, `get_public_dj_v1` and (teacher pages open) the teacher detail RPC, as `/people/:id` does; the DJ
   row is dehydrated too. Flag OFF: none of this runs.
4. **DJ and teacher worlds** read the same snapshot client-side; `/djs/:id` was 0.056 in S6 (below 0.1), the
   teacher world holds its tabs row. Not in this brief.
