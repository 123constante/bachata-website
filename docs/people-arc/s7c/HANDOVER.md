# People arc S7c -- dancer page purge follow-ups -- handover

- Branch: `claude/people-purge-followups` (from `main` c92ff550). Brief: `briefs/PEOPLE-S7c-purge-followups-brief.md`
  on `brief/people-arc` (sha 7f8afc8f). Items 1-3 of `docs/people-arc/s7b/HANDOVER.md` "Next steps"; item 4 is
  watch-only, not built.
- Head: the last commit on the branch (`git log -1 origin/claude/people-purge-followups`); this file is in it.
  PR: opened by the repo bot (bot-pr.yml) on the push; number in the worker's final report.
- Lane: normal, one PR, two review rounds (done). No SQL, no migration, no `supabase/**`, nothing in
  `src/modules/dancer-app/`. No design record (no visible change: headers, purge list). Merge BEFORE the
  `personWorlds` flip.

## What changed

| Item | File | What |
|---|---|---|
| 1 | `app/cloudflarePurge.ts` | An entity rule carries several base paths (`basePaths`). `dancer-<id>` -> `/dancers`, `/people`; `dj-<id>` -> `/djs`, `/dancers`, `/people`; `teacher-<id>` -> `/teachers`, `/dancers`, `/people`. Each base path gets uuid + slug URL (+ `.data`), a prefix, and a warm of its slug page |
| 1 | `app/routeStampCalls.ts` (new, test-only) | Reads the stamp calls each route module really makes; both conformance tests use it |
| 1 | `app/cacheTags.test.ts`, `app/cloudflarePurge.test.ts` | Every id-keyed stamp a route makes (flag ON and OFF) is in `ALL_ROUTE_STAMPS`; every (tag kind x page) pair a route stamps has that base path in its Cloudflare rule; purge table rows per tag kind; the all-three-roles purge fits one call |
| 2 | `src/modules/person-page/reads.ts` | `PersonSnapshot.partial?: true`, present only when a swallowed read lost something: the DJ read failed and the DJ tab or DJ photo could show (inferred roles, DB says dj, or no avatar), or the teacher RPC failed on the inferred-roles path. A missing function (42883 / PGRST202) is a deploy gap, not partial. Callers that ignore it see no change |
| 2 | `src/modules/person-page/seedPersonSnapshot.ts` | Returns true only for a complete answer. Partial: the key IS written (better than nothing), with `updatedAt: 0` so the client hook reads again after mount, and returns false |
| 2 | `app/personPageTtl.ts` (new) | `personPageTtlBound(degraded, snapshotComplete, boundSeconds)`: the ONE TTL rule of both person pages (degraded or not complete -> 60 s). The routes pass `DEGRADED_EDGE_TTL_SECONDS` (they are the dancer-app seam files; this file is not, `check:dancer-area-isolation`) |
| 2 | `app/routes/dancers.tsx` | Uses the helper; `seeded` renamed `snapshotComplete` |
| 3 | `app/routes/people.tsx` | `stampDancer(ref.id, flags.personHub)`; TTL `personPageTtlBound(degraded, !(flags.personHub && person.partial), ...)`. Flag OFF: main's tag and TTL |

### Item 1: why "several base paths" and not "purge `dancer-<id>` on DJ / teacher writes"

The purge-side option changes `purgeTagsFor`, so every DJ / teacher write would ALSO invalidate Vercel's
`dancer-<id>` pages (and their Cloudflare copies) with the flags OFF -- a wider purge on two CDNs, plus the
stamp/purge contract grows a cross-kind edge. The rule option stays inside the Cloudflare module: the Vercel
tag set is untouched, no new tag name, no site-wide purge, and the conformance test can now derive the
right answer from the routes (a page that carries a tag is purged when that tag is).

Flag OFF: `/dancers` with `personWorlds` OFF does not carry `dj-` / `teacher-`, so Vercel is not purged for it;
Cloudflare drops its copy and the warm refetches the same, not-stale copy -- harmless, one wasted warm render
per DJ / teacher write. The rule is correct the moment the flag flips (the flip is a build).

`/people` was added because the route scan showed it: it stamps `dancer-<id>` today (main), and Cloudflare
never purged `/people` for it (a pre-existing gap), and with item 3 it stamps `dj-` / `teacher-` too.

Cloudflare limit: a person with all three roles, one write = 4 pages x (uuid + slug) x (page + `.data`) =
**16 URLs** <= `CF_MAX_URLS_PER_CALL` (30; Free plan's documented limit is 100) -> 1 call per pass, 2 passes, plus
1 prefix call (8 prefixes). Warms: 4 SSR renders (was 3).

Printed from the real `planCloudflarePurge` (person `b`, all three roles, prod id):

```
tags: dancer-ddb6bc80-fd55-4dbc-8b25-a99cb22510df, dj-ddb6bc80-..., teacher-ddb6bc80-...
urls (16): https://www.bachatacalendar.co.uk/{dancers,people,djs,teachers}/{ddb6bc80-fd55-4dbc-8b25-a99cb22510df,b}{,.data}
  /dancers/ddb6bc80-...  /dancers/ddb6bc80-....data  /dancers/b  /dancers/b.data
  /people/ddb6bc80-...   /people/ddb6bc80-....data   /people/b  /people/b.data
  /djs/ddb6bc80-...      /djs/ddb6bc80-....data      /djs/b     /djs/b.data
  /teachers/ddb6bc80-... /teachers/ddb6bc80-....data /teachers/b /teachers/b.data
prefixes (8): www.bachatacalendar.co.uk/{dancers,people,djs,teachers}/{ddb6bc80-...,b}
warm (4): https://www.bachatacalendar.co.uk/{dancers,people,djs,teachers}/b
```

### Item 2 semantics: written-but-bounded

A partial answer is still the best data we have, so it is seeded (the page has the tabs it could read),
but: the edge TTL is bounded to 60 s (same as a missed seed, S7b), and the seeded entry is stale on arrival
so the browser re-reads it. Prod has `get_public_person_roles_v1`, so in prod only a failed DJ read for a
person who is a DJ (or has no avatar) is partial; a failed teacher RPC there loses nothing (its answer is
not used) and keeps the full TTL.

## Shapes (prod `stsdtacfauprzrdebmzg`, read-only SELECT, counts only, 2026-10-24)

Same 191 as S7b. Built pages: local production build on prod data (public anon key), flags OFF
(`personWorlds`, `personHub` both false) then ON (both true). `teacherDetail` unset (closed, as prod).

| Shape | rows | walked | flags OFF `/dancers` + `/people` | flags ON `/dancers` + `/people` |
|---|---|---|---|---|
| dancer only | 29 | `ben` | 200, `dancer-<id>,dancers`, s-maxage=3600 (= main) | 200, `dancer-,dj-,teacher-<id>,dancers`, 3600 |
| dancer + DJ | 10 | `brito` | = main | 4 tags, 3600 |
| DJ only | 4 | `bobby-blanco` | = main | 4 tags, 3600 |
| dancer + teacher | 36 | `alex-boneva` | = main | 4 tags, 3600 |
| teacher only | 62 | `aitor-angelica-tbf` | `/dancers` = main; `/people` 404 (teacher pages closed -> no role; = main) | `/dancers` 4 tags; `/people` 404 |
| teacher + DJ | 1 | `nickchata` | = main | 4 tags, 3600 |
| all three | 25 | `b` | = main | 4 tags, 3600 |
| no role, live | 5 | `pao-pao-army` | `/dancers` = main; `/people` 404 (= main) | `/dancers` 4 tags; `/people` 404 |
| no role, archived | 19 | `boadicea-richards` | 404, untagged | 404, untagged |

"= main": `Vercel-Cache-Tag: dancer-<id>,dancers`, `Vercel-CDN-Cache-Control: public, s-maxage=3600,
stale-while-revalidate=86400`. No read failed on prod data, so no built page showed the 60 s bound.

## Tests (red first) and mutants

New / extended: `app/cloudflarePurge.test.ts`, `app/cacheTags.test.ts`, `app/routes/people.loader.test.ts`
(tags x TTL table, real `stampDancer`), `app/routes/personPages.partialSnapshot.test.ts` (new: real
`loadPersonSnapshot` / seed / tags / headers for `/dancers` and `/people`: roles DB / inferred x DJ fails /
teacher fails / both / neither x flag ON / OFF, 32 rows), `reads.test.ts` (partial rows),
`seedPersonSnapshot.test.ts` (partial row).

- Unfixed code (main c92ff550), first test version: 34 red; every flag-OFF row green (flag OFF = main).
- Mutants on the final code (all caught; tests failing out of 217): drop `/dancers` from dj rule 2; from
  teacher rule 2; planner uses first base path only 5; seed ignores partial 6; partial seeded fresh 1; `/people`
  ignores partial 6; reads never partial 15; teacher partial with DB roles 3; missing function counted as
  failure 1; `/people` without role tags 14; `/dancers` role tags with flag OFF 33; `/people` role tags with
  flag OFF 12; `/people` bounds partial with flag OFF 6.

## Checks run in the sandbox (per CI job)

| Job (workflow) | Steps run | Result |
|---|---|---|
| unit-tests | `TZ=Europe/London npm run test:unit` | 14233 pass, 15 fail in the same 4 env files as S7b (`eventViewCompat.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract`, `integrityCouldNotRun`: sandbox / non-prod Supabase). Run before review round 1's fixes; after them, `src/modules/person-page`, `app`, `tests/regression` re-run: 3353 / 3353 |
| unit-tests (isolation) | `check-dancer-area-isolation --self-test`, `check:dancer-area-isolation` | OK (it caught a first version of `app/personPageTtl.ts` importing dancer-app; fixed) |
| architecture-guard | integrity, legacy-tables, legacy-program-rpcs, lint:architecture, `AUDIT_STRICT=1 check:images`, image-widths (+self-test), plan-hygiene self-test, workflow-artifact-policy (+self-test), mojibake self-test | all green |
| lint chain | `npm run lint` (with `chmod +x bin/*.sh` as CI; mode not committed) | 22 of 22 green |
| typecheck | `check:rpc-typing`, `check:wallclock-brand`, `tsc --noEmit` | green |
| perf-budget | self-tests, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | green; lighthouse / doc-weight need a preview: not run |
| e2e-smoke, phone-qa, seo, og, ci-budget | not run in the sandbox | see PR checks |

## Review

Two `/code-review` rounds (stopping rule stated: user-facing cache change, two rounds). Round 1 fixed: partial
seeded stale; teacher failure not partial when roles come from the DB; missing function not partial; one
shared route-stamp scanner that throws on an unknown helper; comments made accurate. Round 2 fixed (UNREVIEWED,
per the stopping rule): DJ missing function not partial; DJ failure partial only when the tab or photo could
show; test title narrowed; this file. Not fixed: see owner calls.

## Owner calls (found in review, NOT built -- the brief pins them)

1. **`/people/:id` with `personHub` OFF shows DJ / Teaching tabs too** (`PersonPage.tsx`: OFF = the tabbed
   page). The brief says "when its flag is on ... flag OFF unchanged", so with the flag OFF `/people` still
   stamps only `dancer-<id>` and a partial snapshot keeps the full TTL: a DJ / teacher write leaves it stale
   up to 1 h (+SWR) on Vercel, and Cloudflare's purge of it re-warms the stale copy. One-line change if wanted:
   `stampDancer(ref.id, true)` and `!person.partial`. `/people` is noindex and not in the sitemap.
2. **`/people` partial never recovers in the browser**: its snapshot is loader data, not the hook's key, so
   only the 60 s edge bound helps. `/dancers` re-reads after mount.
3. **Cloudflare prefix purge `.../dancers/b`** may also match `/dancers/ben` etc. if Cloudflare prefix
   matching is not segment-bounded (pre-existing since the purge module; not checked here).
4. **`event-<id>` stamped on `/festival/:id`** is not purged from Cloudflare by an event-type write (only by
   `festival-<id>`, which every festival write sends). Pre-existing; listed in the test as reviewed.
5. Watch (S7b item 4): 60 s under DB pressure.

## Verified on real data

- Shapes surveyed: prod `stsdtacfauprzrdebmzg`, read-only counts, 2026-10-24: dancer only 29, dancer + DJ 10, DJ only 4, dancer + teacher 36, teacher only 62, teacher + DJ 1, all three 25, no role live 5, no role archived 19 (191, same as S7b).
- Checks run: red-first matrix (34 red on main, flag-OFF rows green), 13 mutants all caught, cacheTags + cloudflarePurge conformance (route-derived tag kind x base path); unit (only the 15 env failures, same as S7b), lint chain 22/22, integrity, images strict, image-widths, rpc-typing, wallclock-brand, tsc, dancer-area isolation, build, bundle / first-load / chunk-cycle budgets; local production builds on prod data, flags OFF and ON: served `Vercel-Cache-Tag` and `Vercel-CDN-Cache-Control` on `/dancers/<slug>` and `/people/<slug>` for 9 profiles (one per shape); the Cloudflare purge URL list for an all-three-roles person printed from the real `planCloudflarePurge` (16 URLs, one call).
- NOT verified: a real Cloudflare purge (no token in the sandbox; the list is printed, not sent); the 60 s bound on a built page (no read failed on prod data; proven by the matrix only); a real Vercel purge; a Vercel preview; e2e / phone-qa Playwright suites (left to PR checks); owner calls 1-4 above.

## Phone QA

- Sizes checked: 390x844 n/a: no visible UI change; served response headers checked with curl on local production builds (flags OFF and ON).
- Walked: `/dancers/` and `/people/` for `ben`, `brito`, `bobby-blanco`, `alex-boneva`, `aitor-angelica-tbf`, `nickchata`, `b`, `pao-pao-army`, `boadicea-richards` (archived) -- status, `Vercel-Cache-Tag`, `Vercel-CDN-Cache-Control`; plus the printed Cloudflare purge list for `b`.
- Not verified: a real phone, Safari / iOS, a Vercel preview, signed-in (nothing here depends on them: headers and purge list only).
