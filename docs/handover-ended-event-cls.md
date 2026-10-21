# Handover: ended-event-cls

Branch `claude/ended-event-cls`. Brief: `briefs/ended-event-cls.md` on `brief/ended-event-cls`.

## Done

**Element and cause.** On an ended series, `BentoPage` renders the organiser
"door" (`MoreEventsSection` with `blocks=['organiser']`, `DOOR_BLOCKS`) ABOVE the
bento grid. Its two queries (`get_organiser_next_occurrences_v1` + `event_views`
for "More from {organiser}", and `get_organiser_event_counts` +
`organiser_profiles` for the "Other organisers you might like" fallback) ran on
the client only. The server HTML had no door; when the data landed (~4.5 s at
4x CPU) the door appeared and pushed the grid (first tile, date tile, venue
tile...) down 120-177 px. PerformanceObserver `layout-shift` sources at 390x844
on `the-camden-tuesdays`: `DIV "GalleryTUESDAY6OCTOBEREnded..." y 370 -> 546`,
value 0.1212.

**Fix.** `app/routes/event.tsx` prefetches the door's two queries
(`prefetchEndedDoor`, exported from `MoreEventsSection.tsx`) when
`snap.event.lifecycleStatus === 'ended'` and the page is not a festival
(FestivalDetail renders no door). It runs in parallel with the existing
og-image resolve and festival prefetch, inside the same loader timeout. The
hooks and the prefetch share `queryOptions` factories, so keys and fetchers are
the same. The door is now in the server HTML and dehydrated cache: first paint.
No design change; nothing hidden. Live and festival pages are untouched (gate).

**Red-first numbers** (production build served by `scripts/_serve-build.mjs`,
built against the prod Supabase anon key, CDP CPU 4x, 7 s settle):

| page | viewport | CLS before | CLS after |
|---|---|---|---|
| ended `the-camden-tuesdays` | 390x844 | 0.1213 (grid moved 177 px) | 0.0001 |
| ended `the-camden-tuesdays` | 360x640 | 0.1234 (176 px) | 0.0002 |
| ended `bachata-pasos-libres` | 390x844 | 0.0826 (120 px) | 0.0001 |
| ended `bachata-pasos-libres` | 360x640 | 0.0837 (119 px) | 0.0002 |
| live, all dates past `sensual-saturdays-3` | 390x844 / 360x640 | 0.0001 / 0.0002 | 0.0001 / 0.0002 |
| live `ronald-alba-halloween-edition-sensual-vibes` | 390x844 / 360x640 | 0.0268 / 0.0267 | 0.0268 / 0.0267 |
| festival `budapest-bachata-festival` | 390x844 / 360x640 | 0.0314 / 0.0486 | 0.0314 / 0.0486 |

**E2E.** `tests/e2e/event-ended-cls.spec.ts` (added to `test:e2e`): 2 ended
slugs x 390x844 + 360x640; fails when CLS >= 0.1 or the bento grid's top moves
> 4 px. On unfixed main: 4/4 FAIL (numbers above). With the fix: 4/4 pass.
`event-hydration-421.spec.ts` also passes with the fix (door SSR-rendered, no
hydration errors). Like that spec it SKIPS in CI: CI keys are placeholders, so
SSR event pages 404.

**How to reproduce locally.** The sandbox's `VITE_SUPABASE_URL` points at a
non-prod project, so every event SSRs as 404. Build with the prod URL + public
anon key (`get_publishable_keys` on `stsdtacfauprzrdebmzg`) and run node with
`NODE_USE_ENV_PROXY=1` behind the agent proxy.

## Left

- The live site / Vercel preview was not measured (www.bachatacalendar.com is
  blocked by the sandbox proxy; no Vercel token).
- Live events still shift slightly (0.027, the date/venue tiles at ~2.7 s) and
  festivals 0.03-0.05; both under 0.1 and out of scope.
- Door prefetch has its own 1.5 s budget (`ENDED_DOOR_BUDGET_MS`): on a miss
  the page renders as before (door late, shift back) rather than timing out.
- Known residual (review finding): edge-cached HTML older than the door's
  5-min `staleTime` refetches the door on mount. If the organiser's live events
  changed since the render (fallback cards <-> event cards, or empty <-> some),
  the door can change height after load. The fallback's random organiser pick
  is frozen in cached HTML and swaps after such a refetch (same size, no shift).
  Not fixed: it needs a cache-purge or refetch policy decision.
- The bottom strip ('thisWeek') is still client-fetched; it is below the grid
  and moves nothing above it.

## Next

- After merge, re-run the brief's live check on an ended event at 390x844 with
  4x CPU and confirm CLS < 0.1.

## Fix pass (review S1, N1-N3; brief `briefs/ended-event-cls-fix.md`)

### What changed
- **S1** `src/modules/event-page/sections/MoreEventsSection.tsx`, `otherOrganisersQuery`:
  reads `error` from `get_organiser_event_counts` and from the `organiser_profiles`
  select and throws each. A failed door fetch is now an errored query: `prefetchQuery`
  swallows it, `dehydrate` skips it, and the client fetches the door itself instead of
  hydrating a cached "no other organisers" from edge-cached HTML. Client render is
  unchanged (errored -> `data` undefined -> `[]` -> nothing). `event_views` in
  `organiserEventsQuery` left alone, as the review says.
- **S1 test** `src/modules/event-page/__tests__/prefetchEndedDoor.error.test.ts`: rpc
  errors -> no `more-events:other-organisers` in `dehydrate(qc)`; profiles select errors
  -> same; both succeed -> the door IS dehydrated (control).
- **N3** `app/routes/event.tsx`: the 1.5 s budget timer id is kept and cleared in
  `.finally()` on the race.
- **N2** `tests/e2e/event-ended-cls.spec.ts`: a skip now `console.warn`s its reason and
  passes it to `test.skip`. The skip moved out of the `try`: `test.skip` throws, so the
  old `catch` swallowed the first skip and replaced its reason with "server not reachable".
- **N1** spec header: "serial mode: a red run shows only the first failing case".

### Red-first evidence (S1)
| Code | Command | Result |
|---|---|---|
| UNFIXED (b87e817) | `npx vitest run src/modules/event-page/__tests__/prefetchEndedDoor.error.test.ts` | exit 1: 2 failed / 1 passed. `expected [ 'more-events:other-organisers' ] to not include 'more-events:other-organisers'` (rpc-error and profiles-error cases) |
| FIXED | same | exit 0: 3 passed |

### Gates (sandbox, this head)
| Job / step | Command | Exit |
|---|---|---|
| architecture-guard: integrity | `bash bin/check-integrity.sh` | 0 (126 when run without CI's `chmod +x bin/*.sh`: the sandbox checkout has no exec bit) |
| architecture-guard | `npm run check:legacy-tables` | 0 |
| architecture-guard | `npm run check:legacy-program-rpcs` | 0 |
| architecture-guard | `npm run lint:architecture` | 0 |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | `check:image-widths:self-test && check:image-widths` | 0 |
| architecture-guard | `check:plan-hygiene:self-test` | 0 |
| architecture-guard | `check:workflow-artifact-policy:self-test && ...policy` | 0 |
| architecture-guard | `check:mojibake:self-test` | 0 |
| architecture-guard | `prove:entry-point:self-test && prove:entry-point` | 0 |
| typecheck | `npm run check:rpc-typing` | 0 |
| typecheck | `npm run check:wallclock-brand` | 0 |
| (info) | `npm run typecheck` (raw tsc) | 2: 99 pre-existing errors, none in a touched file; CI does not gate raw tsc |
| unit-tests | `node scripts/check-dancer-area-isolation.mjs --self-test && npm run check:dancer-area-isolation` | 0 |
| unit-tests | `npm run test:unit:offline` | 1: 5 failed, all in `tests/integrityCouldNotRun.test.ts` ("typescript resolved in the temp repo -- precondition gone": sandbox `NODE_PATH` has a global typescript). With `env -u NODE_PATH`: 67 passed, exit 0. Other 460 files: 10535 passed |
| lint | `npm run lint` (with CI's chmod, `env -u NODE_PATH`) | 0: 20 of 20 links green |
| perf-budget | `npm run build` | 0 |
| perf-budget | `check:bundle-budget` (+ self-test) | 0 |
| perf-budget | `check:first-load-requests` (+ self-test) | 0 |
| perf-budget | `check:chunk-cycles` (+ self-test) | 0 |
| perf-budget | `npm run check:doc-weight` | NOT RUN: needs a Vercel preview (`GITHUB_REPOSITORY` / deployments API); `claude/*` builds no preview |
| e2e-smoke | `npm run test:e2e` | 1: 153 passed, 7 skipped, 5 failed (auth-magic-link x2, dancer home-nights, organiser-home, organiser-layout). Rerun alone: 24 passed / 1 failed on this head AND 24 passed / 1 failed on the unfixed base b87e817, so it is not this change. The other 4 passed when rerun alone (load during the full run) |
| local-only | `npx playwright test tests/e2e/event-ended-cls.spec.ts` | 0: 4 skipped, each printing `SKIP <slug>: SSR ... -> 404, no bento grid; ...` (N2 working; the sandbox build has non-prod keys) |
| pre-commit | `node scripts/check-source-integrity.cjs` | 0 (2096 files, 0 corrupted) |

### Verified
- S1: the failure path is proven by the unit test, red on the unfixed code and green on the fix.
  The success control proves the door still dehydrates on a healthy fetch.
- N2: a real local run printed the skip reasons.
- Production build and all of its bundle/first-load/chunk gates are green.

### Not verified
- The ended-CLS spec was NOT re-run against real prod data in this pass. The sandbox build
  has non-prod keys, so every event SSRs 404 and the spec skips. The first pass's CLS
  numbers (0.0001-0.0002) are for the prefetch itself. This pass changes only the error path,
  which the unit test covers.
- The review's fault-injection check (both door RPCs answering 500 on a real build) was not
  repeated in a browser.
- doc-weight / lighthouse (need a Vercel preview) and the live site were not measured: no Vercel
  token is used, and the proxy blocks www.bachatacalendar.com.
- PR CI checks for this head: see the PR. GitHub Actions may be refused for billing.
