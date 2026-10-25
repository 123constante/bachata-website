# People arc S7 -- roles in the /dancers/:id loader -- handover

- Branch: `claude/people-dancer-roles-in-loader` (from `main` 79b7cad, S6 #1008 merged). Brief:
  `briefs/PEOPLE-S7-roles-in-loader-brief.md` on `brief/people-arc` (sha 61fa4446).
- Head: the last commit on the branch (`git log -1 origin/claude/people-dancer-roles-in-loader`); this file is in
  that commit. PR: opened by the repo bot (bot-pr.yml) on the push; number in the worker's final report.
- Design record (before/after CLS table, owner calls): [`docs/design/people-s7-roles-in-loader.md`](../../design/people-s7-roles-in-loader.md).
- Lane: normal. No SQL, no migration, no RPC change (the RPC `get_public_person_roles_v1` already exists).

## Turning it on for a preview

`node scripts/preview-deploy.mjs --flag VITE_ENABLE_PERSON_WORLDS=true --flag VITE_ENABLE_TEACHER_DETAIL=true`
(drop the second flag to see prod's teacher-closed behaviour: teacher holders serve no teacher tab, no reserve).

## Files

| File | What |
|---|---|
| `app/routes/dancers.tsx` | flag ON only: `seedPersonSnapshot(qc, ref.id)` started right after the dancer read is issued, awaited after `publicPageLoad`, before `dehydrate`. Meta, OG, headers, tag, TTL untouched |
| `src/modules/person-page/seedPersonSnapshot.ts` (new) | `loadPersonSnapshot` (the same read as the hook and `/people/:id`) raced against `PUBLIC_PAGE_DEADLINE_MS`; never rejects; late answer dropped |
| `src/modules/person-page/usePersonRoles.ts` | `personSnapshotKey` exported (one key for hook + seed); doc comment says a loader may seed it |
| `src/modules/person-page/worlds/dancer/useDancerLower.ts` | comments only: the server now renders roles + reserve when seeded |
| `app/routes/dancers.rolesSeed.test.tsx` (new) | loader -> dehydrate -> hydrate -> renderToString -> hydrateRoot matrix (19 tests; 9 red on `main`) |
| `docs/people-arc/s7/cls-walk.cjs`, `cls-*.json` | CLS / served-HTML walk script and raw numbers (main vs S7, teacher pages open and closed) |

## Shapes (prod `stsdtacfauprzrdebmzg`, read-only SELECT, counts only, 2026-10-24)

`dancer_profiles` with `is_active is not false` (SQL, so 191 rows; the anon-visible set S6 used is 174) x
`get_public_person_roles_v1`:

| Roles held | photo + city | photo, no city | no photo, city | neither | total |
|---|---|---|---|---|---|
| none / dancer only | 30 | 2 | 6 | 15 | 53 (23 of them hold no public role at all) |
| DJ (no teacher) | 10 | 0 | 0 | 4 | 14 |
| teacher (no DJ) | 48 | 8 | 0 | 42 | 98 |
| teacher + DJ | 25 | 0 | 0 | 1 | 26 |

Dated / past / none per world (from S6, same day, anon): teacher 35 / 16 / 47; DJ 5 / 2 / 7; both: 14 with a dated
world. Walked one of each (below).

## Checks run in the sandbox (per CI job)

| Job (workflow) | Steps run here | Result |
|---|---|---|
| unit-tests | `npm run test:unit` | 13985 pass; 15 fail in 4 files, ALL pre-existing and environment-bound (identical on `main` in this sandbox): 3 live-DB `*.contract.test.ts` (need CI secrets), `tests/integrityCouldNotRun.test.ts` (5, sandbox TS-helper precondition). Touched areas (`src/modules/person-page`, `src/modules/dancer-app`, `src/pages`, `app/routes`): 105 files / 2694 tests green |
| architecture-guard | `bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, rest of `npm run lint` chain | green (22 of 22 lint links; integrity needs the job's `chmod +x bin/*.sh`, done and reverted) |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` (the job is message-scoped) | green; full `tsc` shows 0 errors in touched files (pre-existing errors elsewhere) |
| perf-budget | 3 self-tests, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | green (flag-OFF build) |
| e2e-smoke | `npm run test:e2e` with the job's env | 157 pass, 6 fail; re-run of the 6 on `main` and on this branch: the SAME 3 fail on both (`account-settings.spec.ts:64`, `:75`, `organiser-home.spec.ts:55`: pre-existing in this sandbox), the other 3 pass on both (load timing). None opens `/dancers/:id` |
| unit-tests: dancer-area-isolation | `--self-test`, `npm run check:dancer-area-isolation` | red on the first push (person-page imported a dancer-app constant), fixed (the route passes the deadline); green |
| eslint ratchet (pre-ship) | per touched file, base vs branch error count | 0/0, 1/1 (pre-existing `set-state-in-effect` in `usePersonRoles.ts`), 0 new |
| seo-check, og, live-qa, prod-smoke | need a deploy | NOT run |

PR body text (ready to paste):

## Verified on real data

- Shapes surveyed: prod `stsdtacfauprzrdebmzg`, read-only counts, 2026-10-24: dancer only 30 (+23 with no public role), DJ 14, teacher 98 (pages closed on prod), teacher + DJ 26, crossed with photo / city; dated / past / none from S6 the same day.
- Checks run: 19-test loader -> served HTML -> hydrate matrix (9 red on main, green here, incl. the REAL `loadPersonSnapshot` with the closed-teacher filter, the PGRST202 fallback, read failure, read timeout, flag OFF, no hydration mismatch with a negative control); unit, lint chain (22/22), integrity, images strict, rpc-typing, wallclock-brand, bundle / first-load / chunk-cycle budgets; local production builds on prod data: CLS main vs S7 for `brito` 0.161 -> 0.037, `bobby-blanco` 0.141 -> 0.017, `b` 0.128 -> 0.005, `ben` 0 -> 0 at 390 (360 within 0.004); flag-OFF served markup identical to main on 8 profiles (asset hashes aside), headers identical.
- NOT verified: on a Vercel preview (no deploy from this worker); a real phone; signed-in view; the cache-tag and degraded-TTL follow-ups in the design record (owner calls, not built).

## Phone QA

- Sizes checked: 390x844 and 360x800 (Chromium, mobile emulation, local production build on prod data).
- Walked: `brito`, `bobby-blanco`, `b`, `ben`, `aitor-angelica-tbf`, `pao-pao-army`, `florian`, `alex-boneva`, `alexa-bzuk26`, `kal`, `john-otaran`, `nickchata` with teacher pages closed (24 renders: 200, tabs served == tabs after load, 0 hydration errors, no sideways scroll, CLS <= 0.037); the brief's four also with teacher pages open.
- Not verified: a real phone, Safari / iOS, a Vercel preview, signed-in.

## Not verified

- Vercel preview (this worker pushes once; the orchestrator flips the flags) and a real phone.
- The edge cache behaviour of the served tabs after a DJ / teacher change (design record, owner call 1).
- `seo-check`, `og-image-check`, `live-qa`, `prod-smoke`: need a deployment.

## Next steps

1. Orchestrator: preview with the flags above; walk `brito`, `bobby-blanco`, `b`, `ben` on a phone.
2. Owner calls 1-2 in the design record (cache tags, degraded TTL) if wanted as a follow-up.

## S7 critique

**SHIP AFTER OWNER CALL**

Independent review by a fresh worker (brief `briefs/PEOPLE-S7-critique-brief.md` on `brief/people-arc`, sha
73714624). Full findings with the proof for each: [`docs/design/people-s7-critique.md`](../../design/people-s7-critique.md).
No blocker found. The two owner calls are the ones the builder listed; both are recommendations, NOT built.

### What changed in this pass

- `src/modules/person-page/seedPersonSnapshot.test.ts` (new, 5 rows): the seed settles by its deadline, never
  rejects, writes the key only on an answer, and leaves no timer behind. Red on two mutants (no `clearTimeout`:
  3 red; no race: 2 red); green on the PR's code (coverage, not a bug fix).
- `docs/design/people-s7-critique.md` (new), raw walk data + scripts in `docs/people-arc/s7/critique/`.
- No source change. Nothing touches a cache tag, a TTL, a read, or content.

### Owner calls (recommendation each)

1. **Cache tag** (stale tabs). The dancer page is tagged `dancer-<id>,dancers` only, so a DJ / teacher change
   does not purge it. Worst case: a page served from an edge copy up to 1 h old (25 h with SWR on a quiet page)
   shows a DJ tab that is gone for ~1-2 s, until the client re-read (5-min `staleTime`) removes it.
   Recommend: with the flag ON, stamp the page with `dancerTag(id), djTag(id), teacherTag(id), DANCERS`.
2. **Degraded TTL.** A failed or late seed does not set `degraded`, so that page is cached for the full
   `s-maxage=3600` with the old 1.7 s shift. Recommend: bound it with `DEGRADED_EDGE_TTL_SECONDS` (60 s) like
   `loadPublicPageV2`.

### Checks run in the sandbox (critique pass)

| Job (workflow) | Steps run here | Result |
|---|---|---|
| unit-tests | vitest on `src/modules/person-page`, `src/modules/dancer-app`, `src/pages`, `app/routes`; `check:dancer-area-isolation` | 106 files / 2699 tests green (builder's 2694 + 5 new); isolation OK |
| architecture-guard | `bin/check-integrity.sh` (bash), full `npm run lint` chain, `AUDIT_STRICT=1 check:images` | integrity ok (2506 files, 0 issues); lint 21/21 links green + integrity (exit 126 in the chain = the job's `chmod +x` step, not run here); images strict 0 missing |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` (in the lint chain) | green |
| perf-budget / e2e-smoke | not re-run: no source change in this pass; green on the PR head (`4ac71376`) on GitHub | -- |
| PR checks on `4ac71376` (GitHub) | all 32 check runs | success or skipped (deploy-bound jobs skipped) |
| Local production builds | 6 builds (main 79b7cad / branch x flag off / on / on + teacher open) on prod data | headers + `<head>` SAME 24/24; flag-OFF HTML 8/8 identical; 0 console errors; CLS reproduced; TTFB within noise |

### Verified / Not verified

- Verified: headers / meta unchanged in every mode; flag-OFF HTML identical on 8 profiles; no hydration warnings on
  every shape; CLS numbers; TTFB; fewer phone round trips (3 -> 1); client navigation (no double fetch, no flash);
  closed-teacher filter on built pages; shape counts.
- Not verified: a Vercel preview, a real phone, Safari / iOS, the signed-in view (no test account; the matrix has
  no signed-in row), edge purge behaviour on Vercel.

### PR body (ready to paste)

## Verified on real data

- Shapes surveyed: prod `stsdtacfauprzrdebmzg`, read-only counts, 2026-10-24: 191 dancer rows x `get_public_person_roles_v1`: dancer role only 29, no public role 24 (5 live + 19 archived), DJ 14, teacher 98 (pages closed on prod), teacher + DJ 26, each crossed with photo / city; walked one of every shape plus the longest name and no-photo-no-city rows.
- Checks run: 19-test loader -> served HTML -> hydrate matrix (seed mutation: 9 red; flag-guard mutation: 1 red) + 5-test seed deadline table (2 mutants red); unit (106 files / 2699 tests in touched areas), lint chain, integrity, images strict, dancer-area isolation; six local production builds on prod data (main vs branch x flag off / on / teacher open): response headers and `<head>` identical 24/24, flag-OFF served HTML identical 8/8, 0 console errors, CLS `brito` 0.161 -> 0.037, `bobby-blanco` 0.141 -> 0.017, `b` 0.128 -> 0.005, `kal` 0.161 -> 0.037, `ben` 0 -> 0, TTFB delta within +/-16 ms (noise), phone Supabase calls 3 -> 1.
- NOT verified: a Vercel preview; a real phone; Safari / iOS; signed-in view; edge purge behaviour (owner calls 1-2: cache tag and degraded TTL, recommended, not built).

## Phone QA

- Sizes checked: 390x844, 360x800 (Chromium mobile emulation, local production build on prod data).
- Walked: `brito`, `kal`, `bobby-blanco`, `b`, `nickchata`, `spyridoula`, `alex-boneva`, `alexa-bzuk26`, `aitor-angelica-tbf`, `ben`, `florian`, `llf-malva-marina-montenegro`, `unclaimed-b289dee1`, `unclaimed-db85dd0e` (404 on main too), teacher pages closed and open; client navigation `ben` <-> `brito`.
- Not verified: a real phone, Safari / iOS, a Vercel preview, signed-in.

### Next steps

1. Owner: decide calls 1-2 (cache tag, degraded TTL). Either is a one-line follow-up.
2. Orchestrator: preview with `--flag VITE_ENABLE_PERSON_WORLDS=true` (+ `VITE_ENABLE_TEACHER_DETAIL=true`), walk
   `brito`, `b`, `ben` on a phone.
