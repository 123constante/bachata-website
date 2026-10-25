# Brief: multi-city teachers directory, Website half (Worker C). Normal lane, opus.

Branch: `claude/teachers-directory-city`. ONE slice, ONE push. Flag `teachersDirectory` stays OFF: do not flip any flag.

## Already true on prod (verified 2026-10-25, do not redo)
- Admin #1039 is merged and APPLIED (ledger 20270215010000). `get_public_teachers_list_v1(p_city_slug, p_limit, p_offset)` now returns only teachers whose city is ACTIVE (`cities.is_active`); `p_city_slug` narrows to that city. `list(NULL,500,0)` = 46 rows (all London). Inactive-city teachers (Madrid 23, Barcelona 5, others) and city-less teachers are no longer returned. Their detail pages `/teachers/:id` still work by direct link.
- Only `london-gb` is active (319 cities, 1 active). The switcher reads `cities` with `is_active = true` (anon SELECT, policy "Public read"). NO new RPC. Do not revive `get_active_cities()`.

## Read first
- `~/.claude/plans/PLAN-teachers-directory-multicity.md` is local only; its decisions are copied here.
- `src/pages/Teachers.tsx` (one page, calls the list with `p_city_slug = null`, filters city on the client, heading says "London").
- `src/utils/cityPath.ts` `buildCityPath`, `useCity()`, and how `/city/:slug/classes` sets its head tags: COPY that mechanism for titles.
- `vercel.json`: `/:slug([a-z-]+-[a-z]{2})/teachers` is a permanent 308 to `/teachers` (drops the slug).
- `AnimatedRoutes.tsx`: `/teachers` sits inside `ComingSoonGate(flags.teachersDirectory)`. `/teachers/:id` is a framework route (`app/routes/teachers.tsx`); do not collide with it.
- Rules: `.claude/rules/design-density.md` (compact), `breadcrumbs.md`, `data-contracts.md`. Explicit px for tap targets (html font-size ~13.5px on phones). HTML entities in JSX, no raw Unicode punctuation. Source files over 2 KB via `scripts/safe-edit.py` / `safe-write.py`.

## Build
1. Route `/city/:slug/teachers` in `AnimatedRoutes.tsx`, inside the SAME `teachersDirectory` gate. `/teachers` redirects to `buildCityPath(citySlug ?? 'london-gb', 'teachers')` (visitor city from `useCity()`, else London). `vercel.json`: repoint the 308 to `/city/:slug/teachers` (keep it from looping with the redirect).
2. `Teachers.tsx` takes the slug from the URL, passes `p_city_slug`, DROPS the client city filter. Heading, subtitle and document title follow the city name (read the name from `cities`). Unknown or inactive slug: show London with the empty-city note, never a blank page.
3. City switcher: a sheet listing ACTIVE cities (name + teacher count if cheap from the same query; otherwise name only). Compact, 44 px taps, works at 390x844.
4. Empty city (active city, 0 teachers, or unknown slug fallback): "No teachers listed in <city> yet. Know one? Tell us." with a real action: the existing `ListingRequestForm`. Every empty/loading/error state says what the person CAN do.
5. `sitemap.tsx`: one URL per ACTIVE city, only behind the flag (as today). Fix any test that pins the old single URL.
6. `tests/e2e-phone/fakeSupabase.mjs`: serve the new shapes (London 46 / a city with 5 / a city with 0 / inactive / unknown slug).
7. Table-driven vitest: city x shape (46 / 5 / 0 / inactive / unknown slug); one shared mapping for heading/title/empty copy; redirect cases; sitemap per active city. For any fix to existing behaviour run the new test against unfixed code first.
8. Design record `docs/design/<pr>.md` (Design Gate: brief, the owner-picked option "per-city pages + switcher" from https://claude.ai/artifact/Av322D7J3JMxN1d5cXuafC, tokens reuse existing, self-running checks: contrast >= 4.5, taps >= 44 px, no clipping, no sideways scroll, every state). Link it in the PR body. Say in the pack that the independent critique (stage 5) and 390 walk (stage 6) are done by the orchestrator after you.

## Definition of done (put in the PR body)
Per-job CI table (run every step of every applicable job from `.github/workflows` in your sandbox, incl. lint chain, unit, build, any check:* the workflows run); "Verified on real data" block (prod-shaped: London 46, a 5-teacher city, a 0-teacher active city, an inactive slug, a city-less teacher never shown); an honest "Not verified" list (phone, real walk).

## Out of scope
Any migration or `supabase/**`; flag flips; Worker B (public-api `p_teacher_id`); the `/teachers/:id` detail page; calendar density-exempt files.

## Pack note for the orchestrator
Mention: URL is `/city/<slug>/teachers` (not `/london-gb/teachers`) because vercel.json already 308s the bare form and the repo convention is `/city/<slug>/classes`. Public API `/api/v1/teachers` also lost inactive-city rows.
