# S2b person-page-web handover

Branch `claude/person-page-web`. Brief: `docs/briefs/search-v7/S2b-person-page-web.md` (brief branch `brief/search-v7-2026-10-20`).

## Done
- `/people/:id` framework route (`app/routes/people.tsx`, registered in `app/routes.ts`): loader runs the SAME public reads as the old pages, 404 + noindex for unknown/archived ids, `noindex,nofollow`, canonical = strongest role page (teacher, else dj, else dancer), title/description use the (privacy-masked) name, tagged with `stampDancer`. Not in the sitemap.
- Page `src/modules/person-page/PersonPage.tsx`: back (44px), round photo, name once (only h1), role chips, city + Instagram, tabs Teaching / DJ / Dancing in that order (single role = no tab bar), tab in the URL hash (`#teaching`, `#dj`, `#dancing`), "Open full teacher/DJ/dancer page" under each tab.
- Tab bodies REUSE `TeacherProfile`, `DJProfile`, `DancerProfile` (no copied queries or render logic). They render "embedded" through `EmbeddedProfileContext` (`src/lib/embeddedProfile.ts`): `GlobalLayout` returns children only, `useCanonicalReplaceState` does not rewrite the URL, `DjHero` and the `DancerProfileGrid` identity tile drop the photo/name block (name shown once). Standalone pages are unchanged.
- Old role pages gain "Also: DJ . Dancer" (`AlsoRoles`) linking `/people/:id#...` (client-only, after mount, so SSR/hydration is untouched).
- Breadcrumb id `person.detail` added to `siteIa.ts`.
- Tests: `src/modules/person-page/__tests__/*` (roles x 11 shapes, tab order, single role, hash opens tab, hash for a missing role, click writes hash, links, tap targets, name once, hidden surname via masked read, archived/unknown -> null, teacher flag, Also row, embedded DjHero) and `app/routes/people.seo.test.ts` (noindex + canonical).

## OPEN ISSUE 1 (owner/DB decision): roles are INFERRED, not read
`person_roles` is RLS-locked for anon (no policy), and no public RPC returns a person's roles. No database change was allowed, so roles come from the old pages' own reads:
- Teaching = `get_public_teacher_detail_v1` returns a row AND `flags.teacherDetail` is on (off in prod today, so prod would show NO Teaching tab until the flag opens; the old teacher page is locked too).
- DJ = `get_public_dj_v1` returns a profile.
- Dancing = the dancer row has dancer content (years, styles, partner role, achievements), or the person has no other role. Every persona has a `dancing_role_details` row, so that row proves nothing.
Measured on prod (read-only): of 15 active people with an active `dancing` role, 6 have dancer content, 9 do not; of 68 without the role, 0 have dancer content. So no false Dancing tab, but Dancing is MISSED for dancers who are also teacher/DJ with an empty dancer section (e.g. `/people/chong` shows Teaching + DJ only although they hold dancing). Also `paola` (active teaching role) has no public teacher read (0 rows), so `/people/paola` shows a bare Dancer page; the old `/teachers/paola` 404s the same way.
Fix: an admin-repo migration adding `get_public_person_roles_v1(p_person_id uuid) returns text[]` (anon execute, active + public roles only), then replace `derivePersonRoles` input in `src/modules/person-page/reads.ts` with it (one place; tests are table-driven on `RoleSignals`). Search v7 already returns `roles` per person, so it could also pass them in.

## OPEN ISSUE 2: dancer tab ignores the v2 public page flag
Embedded dancer tab always renders the classic grid (the v2 page has its own h1/photo, so it would show the name twice). Decide whether v2 should get an embedded variant.

## Not changed on purpose
Old loaders keep their own copies of the dancer/DJ reads (same query keys and bodies as `reads.ts`); folding them onto the shared function is a follow-up (the brief allowed only the Also row on old pages).

## CI (run locally; billed runners may refuse)
| step | exit |
|---|---|
| `npm run typecheck` (97 errors, ZERO in touched files; baseline main has the same pre-existing errors) | non-zero, pre-existing |
| `npm run test:unit` | 17 failed / 9524 passed: `tests/eventViewCompat|occurrenceProgram|publicEventPageLineup.contract` need a live DB; `tests/integrityCouldNotRun` fails identically on main; `ProfilePage.test` timed out under load, passes alone; `imageWidths` was MINE (240px), fixed to 320 and passes |
| `npm run build` (with prod Supabase URL/key and teacher flag on) | 0 |
| check:rpc-typing, check:wallclock-brand, check:legacy-tables, check:legacy-program-rpcs, lint:architecture, check:bundle-budget, check:first-load-requests, check:chunk-cycles, check:dancer-area-isolation | all 0 |
Not run: check:images (AUDIT_STRICT), lighthouse, e2e-smoke, db-contract-check, lint chain, `/code-review`, pre-ship.

## Walk (production build, live prod data, read-only)
390x844, 360x640, 1280x800 on `chong` (2 inferred roles), `ricky-quinonez` (3 roles), `paola`, `bobby-blanco` (DJ only): no horizontal scroll, every tab/back/link target 44px high, one h1, hash switches tabs (#dj, #dancing). Chip text is rgba(255,255,255,.8) on a dark page (about 13:1 estimated; resolved bg read as black, not a measured gradient contrast). Screenshots: `docs/screenshots/person-page-web/`. A dancer-only person and long-name fixtures were NOT walked on prod (covered in unit tests only). Photo shows blank in the local screenshots (the local /_vercel/image emulation).

## S2b2 (roles from the database + v2 Dancing tab)
Brief: `docs/briefs/search-v7/S2b2-person-page-roles-and-v2.md`.

### Done
- Roles: `reads.ts` calls `get_public_person_roles_v1(p_person_id)` and feeds `RoleSignals.publicRoles` into `derivePersonRoles` (still the ONE mapper). Missing function (`42883` / `PGRST202`) -> `publicRoles = null` -> the old inferred signals (`TODO(remove after get_public_person_roles_v1 is on prod)`). Any other error is thrown (the loader fails like the other reads). The RPC is called through a typed local cast (not `as never` on the name; it is not in the generated types yet, so `check:rpc-typing` stays green).
- Teacher flag off: `teacherPagesOpen=false` drops `teacher` from the single list, so the Teaching tab AND the Teacher chip go together. Teacher-only + flag off = empty roles = 404 + noindex.
- Empty roles = 404 (loader already did this).
- v2: `/people/:id` loader calls `loadPublicPageV2` exactly as `/dancers/:id` (same deadline, `DEGRADED_EDGE_TTL_SECONDS` rule), passes `publicPage` to `PersonPage` -> Dancing tab -> `DancerProfile` -> `PublicDancerPageV2 embedded`. `embedded` drops ONLY the DANCER label, photo, name (h1) and the Back link (the person page has its own); role line, stats, languages, contacts, share, achievements, join stay. Flag closed / failed = classic grid.
- Tests (red first, each shown failing for the right reason): `personRoles.test.ts` (11 combos + flag + fallback), `reads.test.ts` (fake RPC: ok, empty, flag, both fallback codes, other error surfaced), `PersonPage.test.tsx` (v2 vs classic), `public-page/__tests__/embedded.test.tsx` (standalone snapshot written BEFORE the prop existed and unchanged after; embedded drops/keeps), `app/routes/people.loader.test.ts` (3 of 4 failed on the old loader).

### CI (local)
| step | exit |
|---|---|
| `npm run typecheck` | 97 errors = same as before, 0 in touched files |
| `npx vitest run` | 15 failed / 9616 passed: 3 live-DB contract files + `integrityCouldNotRun` (all pre-existing, same as S2b) |
| `npm run build` (prod Supabase, teacher flag off and on) | 0 |
| check:rpc-typing, wallclock-brand, legacy-tables, legacy-program-rpcs, lint:architecture, bundle-budget, first-load-requests, chunk-cycles | 0 |
| `AUDIT_STRICT=1 check:images` | 0 |
| `check:dancer-area-isolation` | **1 -- needs the orchestrator**: this PR now touches `src/modules/dancer-app/` so it counts as a dancer-area PR; rule (a) lists every non-seam changed file (all of S2b's person-page files too) and rule (c) flags `app/routes/people.tsx` and `PersonPage.tsx` importing dancer-app. Adding seams is an orchestrator decision (allowlist JSON); I did not edit it. |
| eslint on touched files | only pre-existing errors (`DancerProfile.tsx` `any`, `usePersonRoles` set-state-in-effect) |
Not run: lighthouse, e2e-smoke, db-contract-check, lint chain, `/code-review`, pre-ship.

### Walk (production build, REAL prod data via the anon key, 390x844; teacher flag off and on)
ricky-quinonez (3 role), chong, leoncio (dancer-only), bobby-blanco (DJ-only), unknown id. All: one h1, no horizontal scroll, `noindex`; unknown = 404. Flag off: ricky = DJ, Dancing (no Teaching tab, no Teacher chip); flag on: Teaching, DJ, Dancing. Clicking Dancing writes `#dancing` and shows the v2 body (`dancer-page-v2`, no second name/photo); dancer-only shows v2 too. Screenshots `docs/screenshots/person-page-web/s2b2-{on,off}-*`.
Not verified: the new RPC on live data (the function is not on prod, so the walk used the inferred fallback: chong shows Teaching + DJ / DJ only, NOT Dancing; the "dancing + empty dancer section" persona is proven by the fake-RPC tests only); 44px targets inside v2 body: the "Get your own card" join link and some site chrome are under 44px (unchanged from standalone v2, not touched); the classic-grid fallback was not walked live (the live flag is open); tab-bar targets are 44px.
