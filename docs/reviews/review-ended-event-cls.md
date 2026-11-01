# Review: Website PR #913, ended-event-cls (head b87e817)

Independent review per `briefs/ended-event-cls-review.md` (ticket dt_270500f0f5d5).
Reviewer did not touch `claude/ended-event-cls`.

## Verdict: FIX FIRST (small)

The fix is correct and does what it says. The organiser "door" is the element
that moved. Prefetching it removes the shift on both ended shapes at both
viewports (CLS 0.08-0.12 down to 0.0001-0.0002, grid movement 119-177 px down to 0).
Live, all-past-live and festival pages are unchanged. There are no hydration
errors, and the door is not fetched again on the client while the HTML is fresh.

Before merge, the fix worker needs to do two things:

1. **B1 (blocker, PR body only, no push):** change the real-data heading so
   `real-data-verified` goes green.
2. **S1 (should, about 6 lines):** stop a failed fallback RPC from being cached
   as an empty success. Today that hides the fallback door.

Everything else is a nit.

## Findings

### B1 blocker: `real-data-verified` is red because of the heading text
- **Evidence:** the PR body has `## Verified on real data (required)`.
  `scripts/check-pr-real-data-verified.mjs:44` requires the whole line to match
  `^##\s+verified\s+on\s+real\s+data\s*#*\s*$`, so the "(required)" suffix
  fails it. I reproduced it locally:
  - the body section with `(required)`: `FAIL - Section "## Verified on real data" is missing`, exit 1;
  - the same text without `(required)`: `OK`, exit 0.
- **The three lines already pass.** They are `- Shapes surveyed:`, `- Checks run:`
  and `- NOT verified:`, each over 12 characters and not template text.
- **Fix:** edit the PR body and rename the heading to exactly
  `## Verified on real data`. Change nothing else. A body edit re-runs the
  check (`edited` trigger) and costs no Vercel build.
- **Root cause, not this PR's:** `.github/pull_request_template.md:46` itself
  ships `## Verified on real data (required)`. So every PR that keeps the
  template heading fails this check. Raise it with the owner as a separate
  one-line PR: either drop "(required)" from the template, or let `HEADING_RE`
  accept an optional `(required)` (and add a self-test case). Do not widen
  #913 for it.
- **`phone-qa-section` is GREEN on the current body** (check run 119236452844,
  success at 13:01:13Z). It accepts the `## Phone QA` section as written, so it
  needs no change. The red the brief mentions was an earlier run.

### S1 should: a failed `get_organiser_event_counts` is dehydrated as an empty success, which hides the fallback door
- **Where:** `src/modules/event-page/sections/MoreEventsSection.tsx`,
  `otherOrganisersQuery` queryFn (head lines ~143-171).
  `const { data: countsData } = await supabase.rpc(...)` ignores `error`.
  The same goes for the `organiser_profiles` select. An RPC error returns `[]`,
  and the query counts that as a **success**.
- **Why the PR makes it worse:** on main, a failed fetch hid the door for one
  visitor. With the prefetch, the server dehydrates the `[]` success into the
  HTML. That HTML is edge-cached (`s-maxage=3600`, SWR 86400). Every viewer then
  hydrates "no fallback". The client does not re-fetch until the data is older
  than its 5 min staleTime, so the door stays hidden for that window. After
  that it re-fetches, and the door appears late with the old shift. This is
  hiding content, which the owner ruled out.
- **Evidence (fault injection):** I ran the head build with a preload that
  makes both door RPCs return HTTP 500 (port 4404):
  - `bachata-pasos-libres`, whose organiser has no live events, so the door is
    the fallback: the door section is **absent**
    (`sections=...|Rate the dancing level...|More events`; no "Other organisers
    in this city"). The client re-fetched only
    `get_organiser_next_occurrences_v1`, which throws on error, so it was not
    dehydrated. It never re-fetched `get_organiser_event_counts`.
  - `the-camden-tuesdays`: the organiser query throws properly, so the door
    came back on the client, with the shift (CLS 0.1213), as designed.
- **Fix (exact):** in `otherOrganisersQuery`'s queryFn, read both errors and
  throw:
  ```ts
  const { data: countsData, error: countsError } = await supabase.rpc('get_organiser_event_counts' as never, { p_city_slug: citySlug } as never);
  if (countsError) throw countsError;
  ...
  const { data: orgData, error: orgError } = await supabase.from('organiser_profiles')...;
  if (orgError) throw orgError;
  ```
  - **Client render is unchanged:** an errored query gives `data` undefined,
    which falls back to `= []`, so nothing renders, as before. It now gets
    `retry: 1` like the other query.
  - **Server:** `prefetchQuery` swallows the error. Errored queries are not
    dehydrated, so the client fetches the door itself, as the PR's own comment
    promises.
  - **Test:** add a unit test that mocks the rpc to `{ data: null, error }`.
    `prefetchEndedDoor` + `dehydrate(qc)` must then contain no
    `more-events:other-organisers` entry. Run it against the unfixed code
    first; it fails there today.
  - **Leave alone:** `event_views` in `organiserEventsQuery` ignores its error
    too. It only affects the sort order, so leave it.

### N1 nit: the spec's serial mode hides the red-first evidence after the first failure
- `test.describe.configure({ mode: 'serial' })` stops the file at the first
  failure. Against unfixed main it reports `1 failed`, and the other three
  cases never run. The author's 4/4 red table came from separate runs.
- **Fix (optional):** keep one server per file, but drop serial. For example,
  start the server in `globalSetup`, or pick `PORT + test.info().workerIndex`.
  Or just say in the header comment that a red run shows only the first case.

### N2 nit: the spec skips silently if the two slugs ever stop rendering
- If `the-camden-tuesdays` or `bachata-pasos-libres` is later archived (410),
  the guard turns into a skip with no signal. The spec is local-only like
  hydration-421, so this is acceptable. Optional: log the skip reason with
  `console.warn` so a local run shows it.

### N3 nit: the budget timer is never cleared
- `app/routes/event.tsx`: the `setTimeout(resolve, 1500)` in the race keeps
  running after the prefetch wins. It is harmless, since a resolved promise is
  ignored and the timer does not hold the response.
- **Optional fix:** keep the id and `clearTimeout` it in a `.finally()` on the
  race.

### N4 nit: the "no double fetch" claim only holds for HTML under 5 minutes old
- I faked HTML older than staleTime by moving the client clock forward
  10 minutes. The client then re-fetches both door queries on hydration
  (`clientDoorRPCs=get_organiser_next_occurrences_v1+get_organiser_event_counts`).
  The CLS stays 0.0001 because the data had not changed.
- With a 1 h edge TTL, most real views hit this path:
  - the fallback's random shuffle can swap which organisers appear after
    hydration (same height);
  - the door can resize only if the organiser's live events changed since the
    render.
- The PR body already lists this as a residual. No change asked; it is the same
  pattern as the snapshot query (30 s staleTime).

## Checks with evidence

### 1. Cause, re-measured (production build, prod data read-only, CDP CPU 4x, 7 s settle)
Setup:
- I built main (fb91b8a) and the head (b87e817) separately with prod's public
  URL and anon key. The sandbox env keys point at a non-prod project, where
  every event page 404s.
- Each build was served by `scripts/_serve-build.mjs` (main on :4401, head on
  :4402).
- I recorded `layout-shift` sources with a PerformanceObserver and tracked the
  grid top on every frame (reviewer sandbox script, not committed).

| page | viewport | main CLS / grid moved | head CLS / grid moved |
|---|---|---|---|
| ended `the-camden-tuesdays` (door = organiser events) | 390x844 | 0.1122 / 177 px | 0.0001 / 0 |
| ended `the-camden-tuesdays` | 360x640 | 0.1234 / 176 px | 0.0002 / 0 |
| ended `bachata-pasos-libres` (door = other-organisers fallback) | 390x844 | 0.0826 / 120 px | 0.0001 / 0 |
| ended `bachata-pasos-libres` | 360x640 | 0.0837 / 119 px | 0.0002 / 0 |

- **Main's shift sources:** at 4465 ms, value 0.0825, `[DIV 370->490, BUTTON 354->474, A 452->572, ...]`,
  then at 4753 ms, 0.0296, `[DIV 490->547 ...]`. These are the first grid cells
  moving down by the door's height. **The door is the cause:** the main server
  HTML has no "More from"/"Other organisers" text, while the head's server
  HTML has it.
- **The PR's own spec:** run against main it fails (`bento grid moved 177px`,
  CLS 0.1213, the first case, then serial mode stops). Run against the head it
  passes 4/4 in 58 s.
- **CLS run to run:** main's camden 390 result was 0.1122 in my script and
  0.1213 in the spec run. Same element, one shift or two depending on timing.

### 2. The 1.5 s budget (fault-injected head builds, ended pages, 390x844)

| case | TTFB (one curl) | page | door | CLS |
|---|---|---|---|---|
| door RPCs +3 s (:4403) | 2.20 s (head normal: about 0.65 s) | 200, renders | appears later from the client | 0.1122 camden / 0.0826 pasos (the shift returns, same as main) |
| door RPCs HTTP 500 (:4404) | 0.78 s | 200, renders | camden: appears later; **pasos: never appears (S1)** | 0.1213 camden / 0.0001 pasos |

- **Slow DB:** the page is never blocked longer than about 1.5 s past the other
  parallel work, and it degrades to main's behaviour.
- **Error:** fine for the organiser query; S1 for the fallback.

TTFB on the local server, sandbox to Supabase, 6 runs each, median (min-max):

| page | main | head | change |
|---|---|---|---|
| ended `the-camden-tuesdays` | 0.434 (0.405-0.513) | 0.646 (0.605-0.807) | +0.21 s |
| ended `bachata-pasos-libres` | 0.451 (0.412-0.485) | 0.623 (0.570-0.666) | +0.17 s |
| live `latin-bay` | 0.486 (0.461-0.565) | 0.475 (0.459-0.523) | none |
| festival `bos-mallorca` | 0.503 (0.477-0.664) | 0.467 (0.440-0.597) | none |

- **Only ended pages get slower, by about 0.2 s,** and only on an edge-cache
  MISS. The cost is the two-step door chains (rpc, then
  `event_views`/`organiser_profiles`), which start after the snapshot.
- **Live and festival are unchanged:** the code path there is `Promise.resolve()`.
- **Caveat:** absolute numbers depend on the sandbox's latency to Supabase.
  Vercel's latency is different. The comparison between main and head is what
  counts here.

### 3. Scope
- **Gate:** `snap.event.lifecycleStatus === "ended" && !isFestival`.
  `BentoPage` renders the door on `isEnded`, and
  `buildEventPageModel.ts:90` defines that as exactly
  `snapshot.event.lifecycleStatus === 'ended'`. The inputs match too:
  `organisers[0].id`, `locationDefault.city.slug`, and `eventId` from the loader.
  So the prefetch runs exactly where the door renders.
- **Prod shapes (read-only SELECT, counts only):** I confirmed the 21 ended
  series and both test slugs (ended_on 2026-10-13 and 2026-10-19). Also:
  ended + festival = 0; ended with no organiser = 0; ended with no default
  city = 0. There are 17 live series whose dates are all in the past; for
  example, `ealing-latin-nights` is unchanged (CLS 0.0001, no door, no server
  prefetch).
- **Not re-checked:** the archived 653, paused 2 and draft 2 counts. My
  group-by query returned only its last statement. Archived and draft pages
  are 404/410 before this code runs, so this does not matter for scope.
- **Cancelled:** the gate reads the series lifecycle only. A cancelled
  occurrence of a live series does not prefetch, as before.

### 4. Hydration
- **Errors:** zero React #418/#421/hydration console errors in every run
  (14 page loads across both builds and the fault servers).
- **Same render on server and client:** the dehydrated cache carries the
  computed `dateLabel` (formatDate is timezone-free, since it slices the ISO
  date) and the shuffled organiser list. The client renders the cached value,
  so the shuffle cannot cause a mismatch.
- **No client re-fetch within 5 min:** the head shows `clientDoorRPCs=none` in
  all 4 ended runs. After 5 min it re-fetches (N4).
- **`event-hydration-421.spec.ts`:** passes 2/2 per the author. I did not
  re-run it separately; `test:e2e` in CI is green.

### 5. Cache, requests, Vercel
- **Headers:** unchanged. `headers()` and `cacheHeaders` were not touched.
  Browser `no-store`, edge `s-maxage=3600`, SWR 86400, and the cache tag are
  as before.
- **Requests reaching Vercel:** unchanged in count. Function time grows about
  0.2 s on an ended-page MISS only (21 low-traffic series).
- **Supabase calls on ended pages only:** up to 4 server reads per edge MISS.
  In return, the client saves its 4 reads for 5 min after each render. Net
  load is about the same or lower; stale views pay the client 4 as before.

### 6. The e2e spec
- **Fails on unfixed main and passes on the head:** confirmed (section 1).
- **CI skip:** e2e-smoke has no prod keys and no `build/`, so the spec skips.
  That is the same local-only skip as `event-hydration-421.spec.ts`, and
  acceptable under that precedent. Its value is as a local and pre-ship guard.
- **The `package.json` change:** it only appends the spec to the explicit
  `test:e2e` list. CLAUDE.md says a new spec joins the gate only when named
  there. Correct.

### 7. Red PR checks
- `real-data-verified`: see B1. The heading must read exactly
  `## Verified on real data`.
- `phone-qa-section`: green now, so no change is needed.

### 8. CI job steps, run locally on the head worktree (prod-key build)

| job / step | command | exit |
|---|---|---|
| architecture-guard: integrity | `bash bin/check-integrity.sh` | 0 |
| architecture-guard | `npm run check:legacy-tables` | 0 |
| architecture-guard | `npm run check:legacy-program-rpcs` | 0 |
| architecture-guard | `npm run lint:architecture` | 0 |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard | `npm run check:plan-hygiene:self-test` | 0 |
| architecture-guard | `npm run check:mojibake:self-test` | 0 |
| typecheck | `npm run check:rpc-typing` | 0 |
| typecheck | `npm run check:wallclock-brand` | 0 |
| unit-tests: dancer-area-isolation | `node scripts/check-dancer-area-isolation.mjs --self-test` / `npm run check:dancer-area-isolation` | 0 / 0 |
| unit-tests | `npm run test:unit:offline` | 1: 5 fail, all in `tests/integrityCouldNotRun.test.ts`, a sandbox artifact (the same 5 fail on main); 10542 pass |
| unit-tests | `npx vitest run src/modules/event-page` | 0 |
| workflow-lint | `lint-workflow-masking.mjs`, `lint-workflow-notification.mjs` (+self-test), `check-no-preview-prefixes.mjs --self-test`, `ci/docs-only.mjs --self-test` | all 0 |
| db-contract-check | `node scripts/check-migration-stamps.mjs` | 0 (live-DB steps need repo secrets; contract-check is green in CI) |
| phone-qa-section / real-data-verified | `--self-test` canaries | 0 / 0 |
| real-data-verified | the checker on the PR body's section | 1 (B1); 0 once the heading is fixed |
| perf-budget | bundle-budget, first-load-requests, chunk-cycles: self-tests + real runs | all 0 |
| build | `npm run build` (main and head) | 0 / 0 |
| e2e (new spec) | `playwright test tests/e2e/event-ended-cls.spec.ts` on main / head | 1 / 0 |
| extra (not a CI step) | `npx tsc --noEmit -p tsconfig.app.json` | 2: pre-existing errors (99 on head, 114 on main), none in the changed files |

Not re-run locally: the full `test:e2e`, the phone suite and build-smoke (all
green in CI on b87e817), plus lighthouse, seo and og (skipped by design on
`claude/*`).

GitHub checks on b87e817:
- red: `real-data-verified` (2 runs);
- green: every other job listed (integrity, typecheck/wallclock-brand, unit
  x3 timezones, dancer-area-isolation, e2e-smoke, phone-qa, build-smoke,
  contract-check, live-db-gate, workflow-lint, phone-qa-section);
- skipped by design: lighthouse, seo, og, synthetic.

## Verified / Not verified
- **Verified:**
  - the cause and the fix, on a production build with prod data at
    390x844 and 360x640 with CPU 4x;
  - the spec fails on main and passes on the head;
  - live, all-past-live and festival pages are unchanged (CLS and TTFB);
  - slow-DB and error behaviour, by fault injection;
  - stale-HTML behaviour, with a faked clock;
  - no hydration errors;
  - the cause of the red check, reproduced;
  - CI steps (table above).
- **Not verified:**
  - the Vercel preview or the live site (not attempted; local builds only);
  - a real phone, and WebKit;
  - TTFB from Vercel's region (sandbox numbers only);
  - a re-run of the paused/draft/archived counts.
