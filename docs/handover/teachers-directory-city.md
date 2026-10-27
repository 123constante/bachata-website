# Handover: multi-city teachers directory, Website half (claude/teachers-directory-city)

Brief: branch `brief/teachers-directory-city`, file `brief/teachers-directory-city.md`.
Design record: [`docs/design/teachers-directory-city.md`](../design/teachers-directory-city.md).

## Done
- `/city/:slug/teachers` route inside the SAME `teachersDirectory` gate; bare `/teachers` redirects (lazy chunk) to
  `/city/<visitor city or london-gb>/teachers`. `catchallClientPaths.ts` lists the new path.
- `vercel.json`: `/:slug-xx/teachers` now 308s to `/city/:slug/teachers` (no loop: the source is one segment).
- `Teachers.tsx`: slug from the URL, `p_city_slug` passed, client City filter dropped; heading, subtitle and
  document title follow the city name read from `cities`; unknown or inactive slug shows London plus the note.
- Switcher sheet (active cities, name only; 44 px rows). Empty city note + "Tell us" (ListingRequestForm).
  Error state with Try again; filters-match-nothing with Clear filters.
- `buildSeoForRoute('teachers')` canonical is `/city/<slug>/teachers`.
- Sitemap: one URL per active city, only behind the flag (`tests/sitemapTeachersCities.test.ts`, red on the
  unfixed loader: it emitted `/teachers`).
- `tests/e2e-phone/fakeSupabase.mjs`: London 46 / Manchester 5 / Leeds 0 / Madrid inactive / unknown slug.
  `people-nationality-flag` teachers surface now visits `/city/london-gb/teachers` with 46 codes.
- Tests: `src/modules/teachers-directory/__tests__/teachersCity.matrix.test.tsx` (pure mapping + page, city x shape,
  redirects, sitemap paths), `tests/e2e-phone/teachers-city.phone.spec.ts` (contrast, 44 px, no sideways scroll).
- `perf-budgets.json`: dancer-app 373 -> 374 KB (main had 0.1 KB headroom; +76 B gz in the AnimatedRoutes chunk).

## Review (one /code-review round, high; the orchestrator's independent critique follows)
Fixed: the RPC no longer waits on the cities read (parallel on the URL slug); heading/subtitle now come from
`buildSeoForRoute('teachers')` (one copy); the heading is back to h2 (PageHero owns the h1); `DEFAULT_TEACHERS_CITY`
instead of a `'london-gb'` literal; the loading canonical is London's. Kept, with reasons:
- Inactive/unknown slugs answer HTTP 404 (app/catchallGate.ts; prod `is_valid_city_slug` requires `is_active`), while
  the client still renders London + the note. Same gate as every `/city/:slug/*` listing; never a blank page.
- `/teachers` is a client-side redirect (it needs the visitor's city); internal links still say `/teachers`.
- CityContext trusts the URL slug in memory, so after an unknown slug `/teachers` returns there for that tab
  (pre-existing; not persisted).
- The sitemap would list an active city with 0 teachers (today only London is active, 46 teachers).
- No breadcrumbs on this page (pre-existing `showSubheader={false}`).

## Left / next steps
- Orchestrator: independent critique (stage 5) and 390x844 walk on the preview (stage 6).
- Owner: flip `VITE_ENABLE_TEACHERS_DIRECTORY` when ready (not this PR).
- Small, not done: the "Tell us" form stays open if the visitor switches city in the sheet (same component instance).
- The teacher card grid is still 1 column on phones (pre-existing; the 3-column density rule is a separate change).
- Public API `/api/v1/teachers` also lost inactive-city rows after admin #1039 (pack note; Worker B's area).

## Fixes round (critique of 2026-10-25, verdict FIX-THEN-MERGE)
Continuation worker, same branch, brief `brief/teachers-directory-city-fixes.md`. Flag still OFF; no migration.

Done:
- **B1** `app/cityCanonical.ts`: `teachers` moved from `CLEAN_LISTINGS` to `SELF_CANONICAL_SUBPAGES`. Bots get canonical
  `/city/<slug>/teachers` and a "Bachata Teachers in <city>" card. The copy is pinned to `buildSeoForRoute('teachers')`.
  Each table entry now declares `nameFrom` (`map` uses the slug; `teachers` uses `cities.name`, as `Teachers.tsx` does)
  and `gateEnv`. While `VITE_ENABLE_TEACHERS_DIRECTORY` is not `'true'` the edge emits `noindex` (meta + `X-Robots-Tag`)
  on a 5-minute cache (`citySubpageNoindex`). `/city/<slug>/classes` still consolidates onto `/classes`. Proof:
  `tests/middlewareCityCanonical.test.ts` (Googlebot request, self canonical, not `/teachers`, classes unchanged,
  noindex off/on) and `app/cityCanonical.test.ts`. 8 of these tests were red with `teachers` put back in
  `CLEAN_LISTINGS`, and 2 were red with `nameFrom` set to `'slug'`.
- **S1** `src/modules/teachers-directory/__tests__/teachersGate.routes.test.tsx`: renders the real `AnimatedRoutes`
  with the flag OFF at `/teachers` and `/city/london-gb/teachers`. Red with `teachersGate(...)` removed from the new
  route, green once it was restored.
- **S2/S3** design record: the HTTP 404 note is in the states table, plus a paragraph on the `vercel.json` 308
  (do NOT revert it to `/teachers`) and a section on what bots read at the edge, flag OFF and ON.
- **N1/N2** `Teachers.tsx`: a city change closes "Tell us" and the switcher sheet, and clears the Name/Style filters
  (state is reset during render, not in an effect). Matrix tests N1 and N2 were red with the reset disabled.
  Honest note: in the real app `AnimatedRoutes` keys `<Routes>` by pathname, so a city change already remounts the
  page. The leak showed only where the page stays mounted (the test harness, or a future change to that key). The
  reset makes the page correct on its own.
- N3/N4/N5 left alone, as the brief says.

/code-review findings not fixed, with reasons:
- With the flag ON, an active city with 0 teachers is indexable (a thin page). This is critique N5, which the brief
  says to leave; only London is active today.

Hand-off for the owner: flip `VITE_ENABLE_TEACHERS_DIRECTORY` only after this PR merges, and redeploy. The edge reads
the same env var at runtime, so the flip also lifts the edge `noindex`.

Review round 2 (/code-review high, last round under the two-round rule for a user-facing change):
- Fixed: the edge reads the flag env var by a STATIC key (`process.env.VITE_ENABLE_TEACHERS_DIRECTORY`), not as a
  computed lookup on `process.env`. A spec pins the var name to `src/lib/featureFlags.ts` and to `middleware.ts`. The
  stale "takes the slug" header comment in `citySubpageSeo` is corrected.
- Not fixed, with reasons:
  - With the flag ON, Googlebot still gets the edge OG stub, not the SPA list. This is the same deliberate treatment as
    `/city/:slug/map`: `next()` would serve a zero-byte document, because the catchall renders null on the server.
    The real fix is an SSR route, queued in `queued-city-map-ssr-route.md`; it applies to both pages.
  - The N1/N2 reset never fires in production (Routes is keyed by pathname). This is stated above; the brief asked
    for it.
  - Flag set via `.env.production` would leave the edge noindexed: no such file exists. Flags live in Vercel project
    env, which the edge reads.
  - The 5-minute TTL on the noindex answer contradicts round 1's finding. It is kept as cheap insurance for the
    flip (bot-only traffic, flag OFF).
  - The gate test's absence check uses a sleep. The mutation (gate removed) proved it red; the "gate renders both"
    case is hypothetical.
- No review stamp was minted: the forked reviewer reported findings as text, not via ReportFindings. `ship-gate`
  is GREEN on the soft (advisory) tier.

Local CI on the final tree: see the PR body's "Per-job CI" table.
