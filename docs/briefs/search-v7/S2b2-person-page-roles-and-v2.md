# S2b2 `person-page-web` continuation (Website repo `123constante/bachata-website`, Sonnet)

Branch: `claude/person-page-web` (SAME branch as S2b, continuing it; nobody else pushes there). Handover to extend: `docs/handover/person-page-web.md` (already on the branch; read it fully first, then `COMMON.md` and `S2b-person-page-web.md`). Your own handover: append a section "S2b2" to that file.

Plain git only (no `gh api`), no shell variables/loops/`$(...)`, never merge/approve/`--no-verify`, push ONCE at the end with last commit subject ending `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at 30% context). Run every CI step in `.github/workflows`, give a per-job table. Check a PRODUCTION build (`npm run build`). Red first: write the table-driven tests, run them on the current code, show they fail for the right reason, then fix. Supabase connector is read-only on production.

## Two decisions are made (owner delegated them to the orchestrator)

### 1. Roles come from the database
A new public function (being built by a sibling worker, NOT applied to prod yet): `public.get_public_person_roles_v1(p_person_id uuid) returns text[]`. Returns active public roles among `'teacher','dj','dancer'`, in that order, `'{}'` for unknown/archived/none. Same vocabulary as `search_public_v7.people[].roles`.
- In `src/modules/person-page/reads.ts` call it (use the repo's RPC wrapper style and typing rules: `check:rpc-typing`) and feed its result into `derivePersonRoles` as the role input. `derivePersonRoles` stays the ONE place that maps signals to tabs; keep tests table-driven on `RoleSignals`.
- TEMPORARY fallback (the function is not on prod until the owner applies the migration): if the RPC errors because the function does not exist (Postgres `42883` / PostgREST `PGRST202`), fall back to the CURRENT inferred signals. Any OTHER error must NOT silently fall back to guessing: surface it like the other reads do. Put a one-line `TODO(remove after get_public_person_roles_v1 is on prod)` and a test for both paths.
- Teaching while `flags.teacherDetail` is off (it is off in prod and the old `/teachers/:id` page shows a "coming soon" gate): the Teaching tab AND the Teacher role chip are both hidden, from ONE shared list, so no chip points at a missing tab. When the flag is on both show. Test this.
- An empty roles array (no public roles) = 404 + noindex like an unknown id.
- Prove with a fake RPC in tests over the 11 role combinations in COMMON.md, plus the persona that holds `dancing` with an EMPTY dancer section (must now show a Dancing tab).

### 2. Dancer tab uses the v2 public page when v2 is open
Prod measured: `dancer_area_gate_v1()` returns `open: true`, so the standalone `/dancers/:id` shows `PublicDancerPageV2` today, and the embedded Dancing tab (classic grid) would show a different design for the same fact. Make them match.
- In the `/people/:id` loader (`app/routes/people.tsx`) call `loadPublicPageV2(id)` exactly as `app/routes/dancers.tsx` does (same deadline, `DEGRADED_EDGE_TTL_SECONDS` caching rule when degraded) and pass `publicPage` to the embedded dancer tab.
- Add an embedded variant of `PublicDancerPageV2` (prop, e.g. `embedded`) that drops ONLY the photo/name header block (name is shown once by the person page) and keeps the rest (stats, bio, actions, share, etc.). No second copy of the page: one component, one prop. If some action inside v2 does not make sense embedded (for example a share title that names the dancer is fine; a "back" control is not), hide it only with a comment saying why.
- Flag closed or read failed (`publicPage` null) = today's classic embedded grid (current behaviour). Test both, and name-once in both.
- `src/modules/dancer-app/__tests__/journeyGuards.test.tsx` lists the v2 file; keep it passing and extend the guard if needed. Do not change the standalone `/dancers/:id` output (add a test that its markup is unchanged for the non-embedded case).

## Walk (required, production build, live prod data, read-only, 390x844)
`/people/<a 3-role person>`, `/people/<dancing + teaching, empty dancer section>`, `/people/<dancer-only>`, `/people/<DJ-only>`, an unknown id, with teacher flag off AND on. Check no horizontal scroll, one h1, 44px targets, tab switching by hash, v2 body in the Dancing tab. Save screenshots under `docs/screenshots/person-page-web/`. Say honestly what you could not walk.

Final report: head SHA, branch, per-job table, "Verified / Not verified".
