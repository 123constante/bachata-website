# Independent critique: PR #1049 (teachers directory per city)

Reviewed: `claude/teachers-directory-city` @ `ef644af6` against `main` @ `e2e32f1`. Read-only; the PR branch was not edited.
Read: `brief/teachers-directory-city.md`, `docs/design/teachers-directory-city.md`, `docs/handover/teachers-directory-city.md`, the full diff (19 files, +861/-110), plus the code it lands into (`middleware.ts`, `app/cityCanonical.ts`, `app/catchallGate.ts`, `src/contexts/CityContext.tsx`).

## What I ran

| Check | Result |
|---|---|
| `npx vitest run src/modules/teachers-directory tests/sitemapTeachersCities.test.ts tests/sitemapEdgeTtl.test.ts` | **3 files, 28/28 passed** (matrix 25, sitemap-cities 2, edge-TTL 1) |
| Mutation A: `p_city_slug: listSlug` -> `null` in `Teachers.tsx` | caught (8 failed) |
| Mutation B: sitemap fetches active cities with the flag OFF | caught (1 failed: the flag-off test) |
| Mutation C: drop `.eq('is_active', true)` from the switcher read | caught (2 failed: Madrid row, switcher list) |
| Mutation D: remove `teachersGate(...)` from `/city/:slug/teachers` in `AnimatedRoutes.tsx` | **NOT caught** (31/31 pass, incl. `tests/catchallClientPaths.test.ts`) |
| Mutation E: never render the ListingRequestForm after "Tell us" | caught (3 failed) |
| Mutation F: drop `.eq("is_active", true)` from the sitemap's cities read | caught (1 failed) |
| Prod survey (Supabase, read-only SELECT, project `stsdtacfauprzrdebmzg`) | 1 active city (`london-gb`); `list(NULL,500,0)` = 46; `list('london-gb')` = 46; `list('madrid-es')` = 0; `is_valid_city_slug('madrid-es')` = false, `('london-gb')` = true, `('LONDON-GB')` = true |

No test is vacuous among the ones I mutated except the gap in D (there is no test at all for the gate on the new route; the gate is present by reading, so this is a missing guard, not a leak).

## Findings

### BLOCKER (before the flag flips; harmless while OFF)

**B1. Googlebot is told the canonical of `/city/<slug>/teachers` is `/teachers`, a URL that client-redirects back.**
`app/cityCanonical.ts:19` keeps `'teachers'` in `CLEAN_LISTINGS`, so `middleware.ts:376` (bot UAs incl. googlebot/bingbot, matcher `/city/:path*`) answers the new page with the CITY's OG card and `<link rel="canonical" href=".../teachers">`. The SPA (`useSeo`, `Teachers.tsx:160`) says canonical `/city/london-gb/teachers`, and the sitemap (`app/routes/sitemap.tsx:237`) submits `/city/london-gb/teachers`.
Scenario (flag ON): GSC fetches the sitemap URL A -> edge canonical B (`/teachers`) -> B renders and JS-redirects to A. Result: "Submitted URL not selected as canonical" / duplicate without canonical, plus a social card titled for the city, not the teachers directory. Owner decision "canonical per city" is not met at the edge, which is what bots read. The brief's own instruction "COPY the `/city/:slug/classes` mechanism" does not hold here: classes is a *consolidating* listing, teachers is now a *distinct* per-city page.
Minimal fix: move `teachers` from `CLEAN_LISTINGS` into `SELF_CANONICAL_SUBPAGES` (`app/cityCanonical.ts`) with the copy pinned to `buildSeoForRoute('teachers', ...)` by `app/cityCanonical.test.ts`, as `map` already is. Because the edge cannot read the flag cheaply, either land this in the same PR as the flag flip, or have the edge also emit `noindex` while `VITE_ENABLE_TEACHERS_DIRECTORY` is unset. Either way, the flag flip must be gated on it. (Not introduced as a flag-OFF leak: `/city/x/teachers` already got this edge HTML before this PR.)

### SHOULD

**S1. No test pins the gate on the new route.** `src/components/AnimatedRoutes.tsx` `/city/:slug/teachers` -> `teachersGate(...)`. Mutation D (ungated route) passes every test. Scenario: a later refactor drops the wrapper and the directory goes public with the flag OFF; CI stays green. Fix: one vitest that renders `AnimatedRoutes` (or the two `<Route>` elements) with `flags.teachersDirectory=false` at `/teachers` and `/city/london-gb/teachers` and asserts the ComingSoonGate placeholder and no `teachers-city-heading`.

**S2. `vercel.json:19-21` now permanently 308s inactive-city URLs to an HTTP 404.** `/madrid-es/teachers` used to 308 to `/teachers` (200); it now 308s to `/city/madrid-es/teachers`, which `app/catchallGate.ts` answers 404 (`is_valid_city_slug('madrid-es')` = false on prod). Humans still see London + the note (client render), so the owner decision holds on screen; but a permanent redirect into a 404 tells crawlers the old URL is gone, and 308s are browser-cached. No loop (the source is one segment; `city` cannot match `[a-z-]+-[a-z]{2}`), and `/london-gb/teachers` behaves correctly. Acceptable if intended; the design record should say so. Minimal alternative: leave it as is and document; do NOT revert to `/teachers`.

**S3. The handover's "Kept" item on the HTTP 404 for inactive/unknown slugs should be in the design record's states table.** The table shows "Inactive slug -> London + note" without saying the status is 404 (non-indexable). One row note; no code.

### NIT

**N1. "Tell us" form stays open across a city change** (`Teachers.tsx:163`, `:319`, `:330`; known gap in the handover). Judged: **not a merge blocker.** It only shows when moving between two cities that both show the note (e.g. Leeds-0 -> an inactive slug); moving to a city with teachers removes the whole note block. The form posts `section="teachers_directory"` with no city field, so no wrong city is submitted. Fix when convenient: `key={view?.listSlug + wantedSlug}` on the note `<div>`, or reset `tellUsOpen` in an effect on `wantedSlug`.

**N2. Style filter persists across a city change** (`Teachers.tsx:166`). Manchester can open on "No teachers match your filters" from London's choice. Actionable (Clear filters is there), so cosmetic. Fix: reset filters on `wantedSlug` change.

**N3. The h1 does not name the city.** PageHero's h1 is "Find Teachers" (`Teachers.tsx:215`); the city lives in the h2 and the title. One h1 holds, title has the city, so the owner check passes; consider `titleOrange: 'Teachers in <city>'` if the 390 walk shows room.

**N4. Loading-state canonical is London's on every city URL** (`Teachers.tsx:160`). Required by the brief and short-lived; a JS crawler snapshotting mid-load would see London. Fine today (only London is active).

**N5. Sitemap would list an active city with 0 teachers** (handover already says so). A thin page with a note; harmless while only London is active. Revisit when a second city activates.

### Checked and fine
- Flag OFF: `/teachers` renders the gate (the redirect never mounts), `/city/:slug/teachers` renders the gate, sitemap emits no teachers URL (mutation B proves the test), the 308 lands on a gated page. No leak found.
- Data: RPC gets `p_city_slug` (never null); switcher reads `cities` with `is_active = true` ordered by name; the fallback fetch for an inactive slug costs one extra empty RPC, harmless. Prod numbers match the fake (46 / 0 for Madrid).
- Redirect: `<Navigate replace>`, so no back-button trap; `/teachers` -> stored invalid slug lands on London + note (not a loop, not persisted: `CityContext` only writes `localStorage` for a valid slug). SSR: catchall renders null on the server, so the redirect is client-only (handover says so).
- Copy points at real controls ("filters ... name or style" = the Name/Style tabs; "Change city" = the switcher; "See another city" opens it). Switcher disabled with visible reason "Loading cities". Error state has Try again. HTML entities used (`&middot;`, `&rsquo;`); the emoji tab icons are pre-existing.
- Perf: 372.9 -> 373.0 KB, +76 B gz in the AnimatedRoutes chunk; the redirect is already lazy (static measured 373.5). The 1 KB bump is justified and documented; chunk/puller ratchets unchanged.
- Scope: `tests/e2e-phone/helpers.ts` and `people-nationality-flag.phone.spec.ts` changes only follow `/teachers` -> `/city/london-gb/teachers`; in scope. No migration, no flag flip, no density-exempt file.

## Not verified
- The Playwright phone suite (`teachers-city.phone.spec.ts`, 14 tests claimed) and the 390x844 walk: not run here.
- The edge-middleware finding B1 is by code reading (`middleware.ts:341-378`, `app/cityCanonical.ts:156`), not by a live bot-UA request against a preview.
- Full CI jobs, build and `check:bundle-budget` for the PR head: not re-run; the 1 KB figure is the PR's own measurement.
- PR #1049 GitHub check status: not read.

**Verdict: FIX-THEN-MERGE** -- add S1's gate test now; B1 must land before (or with) the flag flip, and is a small `app/cityCanonical.ts` change that could ride this PR.
