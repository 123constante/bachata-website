# R2 review: search v7 Website (`claude/search-v7-web` + `claude/person-page-web`)

Reviewer: independent R2 worker (read-only, no code changes to the slices). Date 2026-10-20.
Brief: `docs/briefs/search-v7/R2-review-web.md` (branch `brief/search-v7-2026-10-20`, blob d425ebf).

| branch | head | commits over main |
|---|---|---|
| `claude/search-v7-web` | `08aef77` | 2 |
| `claude/person-page-web` | `a9c5fe6` | 3 |
| main (both forked at `0a9d2d4`) | `8773023` | |

Prod state (read-only SELECT, 2026-10-20): `search_public_v6`, `get_public_teacher_detail_v1`, `get_public_dj_v1`, `dancer_area_gate_v1` exist.
**`search_public_v7` and `get_public_person_roles_v1` do NOT exist** (PostgREST returns `PGRST202` for the roles RPC; seen with the anon key).
So on prod today the person page would run its inferred FALLBACK path, and `searchV7` cannot be switched on at all (that RPC is missing).

Everything marked **CLAIM** below is a proposed fix. I did not apply it.

---

## Findings, most severe first

### F1 (blocker for flipping `searchV7`): confirmed. Teacher-only people get a wrong page, or a 404, instead of today's "coming soon"
Files: `src/modules/person-page/personRoles.ts:42-50`, `src/modules/person-page/reads.ts:81-93`, `src/lib/searchRpc.ts:202-206`.

Prod facts: 63 active personas hold ONLY `teaching` (COMMON.md says 62; my count does not exclude archived personas).
**61 of those 63 get ZERO rows from `get_public_teacher_detail_v1`** (only 2 get a row). Of the 62 personas with teaching plus another role, 5 get zero rows.
Example from prod: `aitor-angelica-tbf` (teaching only, 0 teacher-detail rows). Today `search_public_v6('aitor')` lists that person under `teachers` and nowhere else.

What a visitor sees today (search v6): they tap the Teacher row and go to `/teachers/aitor-angelica-tbf`. With `teacherDetail` off that page shows the "Coming soon - Teacher" gate (200 + noindex). I confirmed this locally on a production build.

With `searchV7` on, the row reads "Teacher" and links to `/people/aitor-angelica-tbf`:

| `teacherDetail` | roles RPC | what `/people/:id` renders |
|---|---|---|
| off | missing (prod today) | `isTeacher=false`, `isDj=false`, so the "no other role" default gives `[dancer]`. The page shows chip "Dancer", the Dancing tab (v2 dancer body), canonical `/dancers/<slug>` and "Open full dancer page". **It shows a role the person does not hold**, and the search row said "Teacher". |
| off | present | `publicRoles=['teacher']` with teacher hidden gives `[]`, so **404 + noindex** "Profile not found". A search result leads to a dead end. |
| on | missing | `get_public_teacher_detail_v1` has 0 rows for 61/63, so it still shows `[dancer]` (same false Dancer page). |
| on | present | `[teacher]`, so a Teaching tab. Its body is `TeacherProfile`, whose own read also returns 0 rows for 61/63. That body is the not-found state of the teacher page. I did not walk it live (see Not verified). |

The "never shows Dancing to a teacher-only person" comment (personRoles.ts:33-39) and the handover's "Teacher-only + flag off = 404" are true only when the RPC is present.

**CLAIM (fix):**
- (a) Search side: when `!flags.teacherDetail`, drop `teacher` from `roles` before building the row, using the same list helper the person page uses (see F2).
- (b) If the row then has no roles (teacher-only), keep today's href `hrefFor('teacher', id)`, which goes to the coming-soon gate. Do not link to `/people/:id`.
- (c) In the inferred fallback, `reads.ts` should call `get_public_teacher_detail_v1` regardless of the flag. Then `isTeacher` stops the "no other role" Dancer default. Visibility is still decided by `teacherPagesOpen` inside `derivePersonRoles`.
- (d) The 61 personas with no teacher-detail row are a data/RPC question for the owner. Either `get_public_teacher_detail_v1` filters them out (unpublished teacher profile?) or the role is stale. Until that is answered, a "Teacher" chip on search can point at a teacher page that 404s even with the flag on.

### F2 (major): search row and person page disagree on roles for every teacher combo while `teacherDetail` is off
Files: `src/lib/searchEntities.ts:54-66` versus `src/modules/person-page/personRoles.ts:8-12,42-44`.

Search uses `roles` straight from the RPC and never looks at `teacherDetail`. The person page hides teacher. So the row text points at a tab that is not on the page (this breaks the CLAUDE.md DoD rule "no copy that points at a control that is not on screen"). Matrix from the real functions (scratch vitest on the merged tree, `derivePersonRoles` + `roleLine`):

| prod combo (count) | search row | page, flag OFF, RPC present | page, flag OFF, RPC missing (today) | page, flag ON, RPC present | page, flag ON, RPC missing |
|---|---|---|---|---|---|
| teaching only (63) | Teacher | **404** | **Dancer (false)** | Teaching | Teaching only if a teacher-detail row exists (2/63), else **Dancer (false)** |
| dancing+teaching (34) | Teacher · Dancer | Dancer | Dancer | Teaching, Dancing | Teaching (+Dancing only if dancer content) |
| dj+teaching (1, `nickchata`) | Teacher · DJ | DJ | DJ | Teaching, DJ | `nickchata` has 0 teacher rows, so **DJ only** |
| dancing only (19) | Dancer | Dancing | Dancing | Dancing | Dancing |
| dj only (4, `bobby-blanco`) | DJ | DJ | DJ | DJ | DJ |
| dancing+dj+teaching (22) | Teacher · DJ · Dancer | DJ, Dancing | DJ (+Dancing only with content) | all three | Teaching, DJ (+Dancing only with content) |

There are also two copies of the role vocabulary: `searchEntities.ts` (`ROLE_ORDER`, `ROLE_LABEL`, `PersonRole`) and `personRoles.ts` (`ROLE_ORDER`, `CHIP_LABEL`, `PersonRole`). This is the "two copies of one fact" that CLAUDE.md DoD #2 forbids, and it is the reason F2 can happen.

**CLAIM (fix):** one module owns the role list, labels and the teacher-visibility filter (`visibleRoles(roles, flags.teacherDetail)`). Search, `/search`, the overlay, the omnibox, `PersonPage` chips and `AlsoRoles` all call it. To avoid the chunk-ratchet cost that the S2a worker hit, it could live in `searchEntities.ts`, with `personRoles.ts` importing from there. Add a matrix test: for each of the rows above, search row roles == page tabs.

### F3 (major, process): `check:dancer-area-isolation` is red on `claude/person-page-web` and on the merged tree
Run on the merged tree, exit 1:

- "dancer-area PR: rules a+b+c", 60 violations.
- Rule (a): every changed non-seam file, including 32 `docs/screenshots/**` files. `docs/screenshots/` is not a `docPrefix`.
- Rule (c), 2 hits:
  - `app/routes/people.tsx` imports `@/modules/dancer-app/public-page/loadPublicPage`.
  - `src/modules/person-page/PersonPage.tsx` imports `type { PublicPageV2Data }` from `@/modules/dancer-app/public-page/model`. The guard's `importSpecifiers` does not exempt `import type`.

The PR becomes a "dancer-area PR" only because `src/modules/dancer-app/public-page/PublicDancerPageV2.tsx` changed (the `embedded` prop).

Is any rule (c) import a real isolation problem? **No.**
- `people.tsx` calls `loadPublicPageV2` exactly as the existing seam `app/routes/dancers.tsx` does: the same loader contract and the same degraded-TTL rule.
- The `PersonPage` import is type-only: there is no runtime edge into the module.

**CLAIM (legitimate path to green, orchestrator decision per the script header):**
1. Split S2b2's v2 part into its own dancer-area PR: `PublicDancerPageV2.tsx` + `public-page/__tests__/embedded.test.tsx` + snapshot + the `embedded={embedded}` pass-through in `src/pages/DancerProfile.tsx` (already a seam). That PR passes rule (a) as-is: every file is in dancer-app, a test, or a seam.
2. The person-page PR is then NOT a dancer-area PR, so only rule (c) runs. Add `app/routes/people.tsx` to `seams`, with a `seamNote` mirroring the one for `app/routes/dancers.tsx` (it reads the open flag + extras for the Dancing tab). Remove the `PersonPage.tsx` import, e.g. type the prop as `NonNullable<React.ComponentProps<typeof DancerProfile>['publicPage']>` through the seam `DancerProfile.tsx`, or re-export the type from `DancerProfile.tsx`.
3. Alternatively keep one PR and add `docs/screenshots/` to `docPrefixes` and every person-page file to `seams`. I do NOT recommend this: it widens the seam list with about 20 files that never touch the dancer area.

### F4 (minor, visual regression on standalone pages): the DJ page gains an empty padded wrapper for everyone
`src/pages/DJProfile.tsx:200-202` adds `<div className="... pt-4 md:pt-6"><AlsoRoles/></div>` unconditionally. When `AlsoRoles` returns null (all SSR renders, every single-role DJ, every embedded DJ tab), the div still takes 16px (24px at md). Every `/djs/:id` page shifts down. The brief says the Also row is the ONLY change to old pages.

On multi-role people, the row appears only after mount (client-only, no hydration mismatch). It is 44px tall and pushes content down after first paint, a layout shift on all three old pages (`DancerProfile.tsx:375,408`, `TeacherProfile.tsx:285`).

**CLAIM:** move the padding into `AlsoRoles` so null means no box. Reserve height or accept the shift knowingly. Lighthouse CLS was not measured.

### F5 (minor): every old role page now fires four client reads, one of which fails on prod
`AlsoRoles`, through `usePersonRoles` and `loadPersonSnapshot` (`src/modules/person-page/usePersonRoles.ts`), runs four reads on every `/teachers|/djs|/dancers/:id` view after mount:
- the dancer row
- `get_public_dj_v1`
- `get_public_person_roles_v1`, which is `PGRST202` (a 404 in the console) until the migration lands
- `get_public_teacher_detail_v1` (when the flag is on)

The dancer and DJ reads reuse the loader's query keys, so they hit cache on SSR-hydrated pages, but the roles read never does. Also, a non-42883/PGRST202 roles error throws inside `loadPersonSnapshot`, so the Also row silently disappears. That is fine there, but on `/people/:id` the same throw fails the whole loader (500), while a DJ-read error is caught (`reads.ts:78`). This follows the brief ("surface it"), but say it to the owner: a roles-RPC blip takes the whole person page down.

**CLAIM:** none needed beyond awareness. Optionally, `usePersonRoles` could call only the roles RPC once it is on prod.

### F6 (minor): an old `/search?type=teachers|djs|dancers` link renders a blank body with `searchV7` on
`src/pages/SearchResults.tsx:62` adds the `people` facet. With v7 the teachers/djs/dancers arrays are always empty, so `showSection` hides everything except the requested (empty) facet. `total > 0` suppresses the empty state, so the visitor sees chips and no results or guidance. The reverse also holds: `?type=people` with the flag off. The class is pre-existing (any facet with 0 hits), but v7 makes it certain for shared or back-navigated URLs.

**CLAIM:** with `searchV7` on, map `type=teachers|djs|dancers` to `people`. More generally, show the empty state when the active facet has 0.

### F7 (nit): raw Unicode middle dot in source
`src/modules/person-page/PersonPage.tsx:114` and `src/lib/searchEntities.ts:65` join with a literal `' · '` (U+00B7). CLAUDE.md "HTML entities over raw Unicode" forbids raw punctuation because of the cp1252 round-trip. `check:mojibake` passes, so it is not gated, and `AlsoRoles.tsx` already uses `&middot;`. **CLAIM:** use `'·'` (as `DjTiles.tsx` does).

### F8 (nit): embedded tabs
- The embedded v2 dancer body (`DancerProfile.tsx:374`) keeps `pb-24`, so "Open full dancer page" sits about 96px below the tab content.
- The v2 header still shows `roleCity` (`PublicDancerPageV2.tsx:181`), e.g. "Follower · London", under the person page's own city line. The city appears twice.

---

## Brief checklist (refuted or OK)

- **Flag `searchV7` off = identical behaviour.**
  - Same RPC (`v7 ? … : v6 ? …`).
  - Same args (`p_level` only when v6).
  - Same query key (the `'v7'` tail is appended only when on).
  - Same envelope (`people` is spread only when v7).
  - The `people` facet is hidden at count 0.
  - The `searchRpc.ts` `v6` alias is `searchV6 || searchV7`, so it is unchanged when off.
  - OK. I did not do a byte-level DOM diff on a live flag-off build (the authors' strict-equal v6 test passes).
- **Telemetry:**
  - `/search` and the overlay log `telemetryKindFor(primary_role)`, which is teacher/dj/dancer. No caller can log `person`.
  - The header omnibox logs no clicks (pre-existing; unchanged).
  - OK.
- **Links and one row per person:** one `person` row per `people[]` entry in the omnibox, the overlay (group "People", cap 5) and `/search`. Href `/people/:id` (by id; the loader redirects a uuid to the slug). OK, assuming `search_public_v7` really returns one row per id: it is not on prod, so not verified against data.
- **Empty states:** `/search` copy is unchanged ("Try a different word…" / did-you-mean); counts use `total_count`. OK except F6.
- **a11y:**
  - The person rows get `aria-label` "Name, Teacher, DJ".
  - The `/people` tabs use `role=tab`/`tabpanel` with `aria-controls` and `labelledby`; Back has an `aria-label`; one h1.
  - Tabs, Back, "Open full … page" and the Also links are all `min-h-[44px]`.
  - The `/search` facet chips are `py-1.5` (pre-existing, below 44px).
  - OK.
- **`/people/:id` loader:**
  - Unknown id: 404 + `X-Robots-Tag: noindex` (verified on a local prod build).
  - Found: `noindex,nofollow`, with canonical = strongest visible role page.
  - Title `"<masked name> - Bachata Calendar"`; the name comes from `attachPublicDancerName` (privacy helper).
  - `stampDancer` tag + `cacheHeaders`; the degraded-v2 rule `edgeTtlBoundSeconds: DEGRADED_EDGE_TTL_SECONDS` exactly as `app/routes/dancers.tsx:85`.
  - Not in any sitemap.
  - OK (see F1 for which canonical a teacher-only person gets).
- **`get_public_person_roles_v1` handling:** only `42883`/`PGRST202` return null and fall back; anything else throws (`reads.ts:42-43`). `derivePersonRoles` is the one mapper on the person page. OK, but the search side has its own copy (F2).
- **Embedded v2 Dancing tab:**
  - `embedded` drops the label/photo/h1 and Back, so the name appears once.
  - Standalone markup is unchanged (snapshot test written before the prop).
  - `publicPage` null gives the classic grid with its identity tile hidden.
  - OK.
- **Chunk/bundle:** `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` = 0 on the merged build.
- **SSR hydration of "Also":** client-only after mount (`usePersonRoles` is gated on `mounted`), so SSR and first client render are both null. No hydration mismatch by construction; layout shift per F4.
- **Merge:** the two branches plus current main merge cleanly (octopus merge, auto-merge of `PublicDancerPageV2.tsx` only).

## CI steps run on the MERGED tree (main `8773023` + both branches, merge `aef53e7`, local)

| job / step | command | exit |
|---|---|---|
| typecheck | `npm run typecheck` | 2: **97 errors = the pre-existing baseline, 0 new** |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0, 0 |
| architecture-guard | `bin/check-integrity.sh` | 0 (1845 files, 0 issues) |
| architecture-guard | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0, 0, 0 |
| architecture-guard | `AUDIT_STRICT=1 check:images` | 0 |
| architecture-guard | `check:plan-hygiene:self-test`, `check:mojibake:self-test`, `check:mojibake` | 0, 0, 0 |
| perf-budget (claude/ branch leg) | `npm run build` | 0 |
| perf-budget | `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0, 0, 0 |
| unit-tests | `vitest run --exclude **/*EdgeTtl.test.ts` | 1: 15 failed / 9569 passed in 4 files: 3 live-DB contract files + `integrityCouldNotRun`. None touched by either slice; the same 4 files both authors report failing on main |
| unit-tests / dancer-area-isolation | `check-dancer-area-isolation.mjs --self-test` | 0 |
| unit-tests / dancer-area-isolation | `npm run check:dancer-area-isolation` | **1, see F3** |
| lint | `npm run lint` (chain) | 0 (trailing eslint informational, exit 1, does not gate) |
| other | `check:route-boundaries` | 0 |

Not run: e2e-smoke (needs browsers + secrets), lighthouse/doc-weight (non-`claude/` legs only), seo-check (needs a preview deploy), db-contract-check (live DB jobs), real-data-verified (needs a PR body).

## Verified
- The merge is clean. Build, typecheck (0 new), lint chain, image/bundle/chunk/request guards and the integrity guard are all green on the merged tree; unit failures are pre-existing only.
- The F1/F2 matrix comes from the real `derivePersonRoles` + `roleLine` functions, combined with prod facts gathered by SELECT only:
  - role-combo counts
  - teacher-detail row counts per persona
  - v6 listing `aitor-angelica-tbf` under teachers
  - the missing v7 and roles functions
  - `PGRST202` from the roles RPC with the anon key
- `/teachers/<teacher-only>` with `teacherDetail` off renders "Coming soon - Teacher" 200 + noindex (local prod build). `/people/<unknown>` gives 404 + `X-Robots-Tag: noindex`.
- `check:dancer-area-isolation` output and the reason it trips (F3).

## Not verified
- **A browser walk of `/people/:id` with real data.** My local production server could not reach Supabase through the sandbox proxy: its SSR loaders timed out, so every detail route returned 404. Screens per combo are therefore derived from code + prod SELECTs, not seen. That includes what the Teaching tab body shows for a persona with no teacher-detail row.
- The live site: plain GET to www.bachatacalendar.co.uk was blocked from this sandbox.
- `search_public_v7` behaviour (one row per person, `total_count`, ranking): the function is not on prod, and I created no Supabase branch.
- Contrast ratios, CLS from the Also row (F4), and 360px wrapping of long names: not measured by me.
- Running the 4 failing unit files on bare main myself: I relied on both authors' reports.
