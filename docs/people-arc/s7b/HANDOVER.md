# People arc S7b -- dancer page cache tags + degraded TTL -- handover

- Branch: `claude/people-dancer-cache-tags` (from `main` 8d82d61, S7 #1011 merged). Brief:
  `briefs/PEOPLE-S7b-cache-tag-ttl-brief.md` on `brief/people-arc` (sha 87fab5ed).
- Head: the last commit on the branch (`git log -1 origin/claude/people-dancer-cache-tags`); this file is in that
  commit. PR: opened by the repo bot (bot-pr.yml) on the push; number in the worker's final report.
- Lane: normal. No SQL, no migration, no `supabase/**`, no RPC change. Both changes sit behind `flags.personWorlds`
  (OFF on prod), so nothing changes for visitors until the flag flips. Merge this BEFORE the flip.
- No design record: there is no visible change (headers only). Source of the two owner calls:
  `docs/design/people-s7-critique.md` sections 5 and 6 (owner said YES to both, 2026-10-24).

## What changed

| File | What |
|---|---|
| `app/cacheTags.ts` | `stampDancer(id, withRoleTags = false)`: with `true` it stamps `dancer-<id>,dj-<id>,teacher-<id>,dancers` (existing helpers, no new tag names). Default = today's `dancer-<id>,dancers`. `ALL_ROUTE_STAMPS` lists both forms so the conformance test sees them |
| `app/routes/dancers.tsx` | `stampDancer(ref.id, flags.personWorlds)`. The roles seed result is now read: `seeded = rolesSeed ? await rolesSeed : true`; the TTL bound is `degraded \|\| !seeded ? { edgeTtlBoundSeconds: DEGRADED_EDGE_TTL_SECONDS } : undefined` |
| `app/routes/dancers.cacheTags.test.ts` (new) | 54 tests through the REAL `cacheTags` / `taggedData` / `cacheHeaders` (served headers asserted) |
| `app/routes/dancers.rolesSeed.test.tsx` | the S7 rows "read fails" / "read late" now expect the 60 s bound (that is the owner call); the tag comparison removed there (it was against a mock; the real one is in the new file) |

`seedPersonSnapshot` is unchanged: it already returns `Promise<boolean>` (true = answered, the key written; false =
failed or past the deadline, nothing written), never rejects, and leaves 0 timers (its own 5-row test, from S7).
"Answers null" is an answer (true): the key is written and the page is not degraded.

## Purge path (checked before editing)

- There is no `scripts/check-cache-tag*`; parity is `app/cacheTags.test.ts` (stamp vs purge conformance) and
  `app/cloudflarePurge.test.ts` (every stamped tag kind has a Cloudflare rule). Both green; `dj-ID` / `teacher-ID`
  were already stamped (by `/djs/:id`, `/teachers/:id`) and purged, so no allowlist change.
- DB side (prod, read-only `pg_get_functiondef`): every DJ / teacher emit sends the PERSON id
  (`dancer_profiles.id`): `admin_save_person_v1`, `save_my_dancer_profile_v1/v2`, `admin_set_dance_roles_v1`,
  archive / unarchive / delete / disable / erase, and `save_my_role_v1` (emits ONLY the role it saves -- exactly the
  write the old tags missed). `/api/revalidate` turns `dj` + id into `dj-<id>` (`purgeTagsFor`), and
  `invalidateByTag` reaches every Vercel response carrying that tag, so `/dancers/<slug>` is now purged.
  Seen on a built page: `/dancers/b` serves `dj-ddb6bc80-...` = b's `dancer_profiles.id`.
- Header length: 4 tags, longest header 136 characters (all three roles; every person gets the same 4 tags, ids are
  36-char uuids). Vercel allows 128 tags per response and 256 characters per tag. Cloudflare does not read
  `Vercel-Cache-Tag` (it purges by URL, below).
- Why a person with no DJ / teacher role gets the extra tags too: a NEW DJ or teacher write (`save_my_role_v1`) must
  purge a page that has no tab yet; stamping only the roles the page shows would miss exactly that write. It does
  not widen the purge set: `purgeTagsFor` is unchanged (one tag, one id per write); the only new effect is that a
  DJ / teacher write for person X also invalidates `/dancers/<X>` (and its `.data`). No site-wide purge, and
  `dancers` stays STAMP_ONLY (nothing purges it).

## Shapes (prod `stsdtacfauprzrdebmzg`, read-only SELECT, counts only, 2026-10-24)

`dancer_profiles` (191) x `get_public_person_roles_v1` x archived (`archived_at` set). Built pages: local production
build on prod data (public anon key), flag OFF then ON.

| Shape | rows | walked | flag OFF served | flag ON served |
|---|---|---|---|---|
| dancer only | 29 | `ben` | 200, `dancer-<id>,dancers`, s-maxage=3600 | 200, `dancer-<id>,dj-<id>,teacher-<id>,dancers`, s-maxage=3600 |
| dancer + DJ | 10 | `kal` | same as main | 4 tags, 3600 |
| DJ, no dancer role | 4 | `bobby-blanco` | same as main | 4 tags, 3600 |
| dancer + teacher (pages closed on prod) | 36 | `lucas` | same as main | 4 tags, 3600 |
| teacher only | 62 | `paola` | same as main | 4 tags, 3600 |
| teacher + DJ | 1 | `nickchata` | same as main | 4 tags, 3600 |
| all three | 25 | `b` | same as main | 4 tags, 3600 (header 136 chars) |
| no role, live | 5 | `yenny-otero` | same as main | 4 tags, 3600 |
| no role, archived | 19 | `carlos` | 404, no tag, not edge-cached | 404, no tag |

"same as main" = `Vercel-Cache-Tag: dancer-<id>,dancers`, `Vercel-CDN-Cache-Control: public, s-maxage=3600,
stale-while-revalidate=86400`, as main serves it. Teacher pages open/closed changes the body (S7), not tags or TTL:
the tag list does not depend on roles by design.

## Tests (red first)

`app/routes/dancers.cacheTags.test.ts`: 5 shapes x flag ON/OFF x seed answers / answers null / fails / never answers
/ answers after the deadline (50 rows), plus: ON good answer == OFF edge directive; degraded public-page read still
bounds ON and OFF; archived -> 404 before any tag; header within Vercel limits (real `stampDancer`).

- Unfixed code (main): 25 red (every flag-ON row), 29 green (flag OFF + the rest).
- Mutants on the fix: drop the extra tags -> 25 red; drop the TTL bound -> 15 red (exactly the fails / never /
  late rows); stamp with the flag OFF -> 25 red.

## Checks run in the sandbox (per CI job)

| Job (workflow) | Steps run | Result |
|---|---|---|
| unit-tests | `TZ=Europe/London npm run test:unit` | 14110 pass, 15 fail in 4 files: `eventViewCompat.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract` (live-DB contract tests; the sandbox's Supabase env is a non-prod project without those RPCs) and `integrityCouldNotRun` (sandbox); the SAME 15 fail on `main` with this diff stashed. Not this PR's |
| unit-tests (isolation step) | `check:dancer-area-isolation` | OK (not a dancer-area PR) |
| architecture-guard | integrity, legacy-tables, legacy-program-rpcs, lint:architecture, `AUDIT_STRICT=1 check:images`, image-widths (+self-test), plan-hygiene self-test, workflow-artifact-policy (+self-test), mojibake self-test, prove:entry-point (+self-test), going-legacy-rpcs | all green |
| lint chain | `npm run lint` | 22 of 22 green (with `chmod +x bin/*.sh`, as CI does; mode change not committed) |
| typecheck | `check:rpc-typing`, `check:wallclock-brand`, plus `tsc --noEmit` | green |
| perf-budget | `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | green; `check:doc-weight` / lighthouse need a Vercel preview: not run |
| ci-budget-guard | `check-ci-budget.mjs` | could not run (needs `CI_BUDGET_GITHUB_TOKEN`; exit 2) |
| e2e-smoke, phone-qa, seo, og | not run in the sandbox (Playwright suites / live deploy) | see PR checks |
| real-data-verified, phone-qa-section | PR body sections below | filled |

## Review

Two `/code-review` rounds (stopping rule: user-facing cache change behind a flag, two rounds). Fixed: test titles /
assertions that compared mocks, the late-answer timer leaking into the next test, flag-OFF rows now compare the full
edge directive, the header-limit row uses the real `stampDancer`, `stampDancer` written once (spread). Not fixed
(owner calls, see next steps): items 1-4 below.

## Verified on real data

- Shapes surveyed: prod `stsdtacfauprzrdebmzg`, read-only counts, 2026-10-24: dancer only 29, dancer + DJ 10, DJ only 4, dancer + teacher 36, teacher only 62, teacher + DJ 1, all three 25, no role live 5, no role archived 19 (191); DB emit functions read (DJ / teacher emits use the person id).
- Checks run: 54-row tag / TTL matrix through the real headers path (25 red on main, 3 mutants red), S7 matrix updated, cacheTags + cloudflarePurge conformance; unit (only 15 env failures, same on main), lint chain 22/22, integrity, images strict, rpc-typing, wallclock-brand, tsc, build, bundle / first-load / chunk-cycle budgets; local production builds on prod data, flag OFF and ON: served `Vercel-Cache-Tag` and `Vercel-CDN-Cache-Control` on 9 profiles (one per shape), flag OFF identical to main, flag ON 4 tags with the person's real id, archived 404 untagged.
- NOT verified: the 60 s bound on a BUILT page (the seed did not fail on prod data; proven by the matrix only); a real purge on Vercel (no deploy from this worker); Cloudflare (see next steps 1); a Vercel preview; e2e / phone-qa Playwright suites (left to PR checks).

## Phone QA

- Sizes checked: 390x844 n/a: no visible UI change; served response headers checked with curl on local production builds (flag OFF and ON).
- Walked: `/dancers/` `ben`, `kal`, `bobby-blanco`, `lucas`, `paola`, `nickchata`, `b`, `yenny-otero`, `carlos` (archived) -- status, `Vercel-Cache-Tag`, `Vercel-CDN-Cache-Control`; body unchanged from S7 (no rendering change in this PR).
- Not verified: a real phone, Safari / iOS, a Vercel preview, signed-in (nothing here depends on them: headers only).

## Next steps / owner calls (found in review, NOT built -- outside the pinned brief)

1. **Cloudflare does not follow the new tags.** Cloudflare purges by URL; `CF_URL_RULES` maps `dj-<id>` to `/djs/<slug>`
   and `teacher-<id>` to `/teachers/<slug>` only. After a DJ write Vercel is purged, but Cloudflare can keep the old
   `/dancers/<slug>` for its ~300 s rule, and its next miss can fetch Vercel's soft-invalidated stale copy for one more
   ~300 s (not warmed). So the worst case drops from 1 h (+25 h SWR) to about 10 min, not to zero. Fix options: let a
   rule carry several base paths (`dj-<id>` -> `/djs` and `/dancers`), or purge `dancer-<id>` on DJ / teacher writes
   (purge side). Both touch flag-OFF behaviour, so they need the owner.
2. **Partial snapshot failure keeps the full TTL.** `loadPersonSnapshot` swallows a failed DJ read (`.catch(() => null)`)
   and a failed teacher RPC (`.catch(() => false)`) and answers with fewer roles, so `seeded` is true and the page
   (missing that tab) is cached for 1 h. Needs `loadPersonSnapshot` to report "partial" (module `person-page/reads.ts`).
3. **`/people/:id`** (behind `personHub`) serves the same snapshot but stamps `stampDancer(ref.id)` without role tags:
   same staleness there. One-line follow-up (`stampDancer(ref.id, true)` when its flag is on) once 1 is decided.
4. **60 s under DB pressure.** When the DB is slow every seed misses its deadline, so every dancer page drops to
   s-maxage ~55 and re-renders (4 reads each) about 60x more often, while the DB is slow. Same trade the public-page
   read already makes (`degraded`); the owner chose it. Watch it after the flip.
