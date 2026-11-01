# Review: React #421 fix (`claude/hydration-421-fix` @ a935d822, PR #878)

Independent review, ticket dt_7e7cfa82ec90, brief `docs/briefs/hydration-421-review.md`
(sha 291e43a2). I changed no source on the fix branch. Base: `main` @ 995c841.
Date: 2026-10-20. Sandbox: production builds of both trees served by
`scripts/_serve-build.mjs` against prod Supabase (public anon key on the command
line, `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`).
Screenshots are in `docs/review-hydration-421-fix/`.

## Verdict

**No blockers.** The fix does what it says. The e2e spec fails 6/6 on main and passes 6/6 on
the branch, the bundle budgets and first-load request pins don't move, and the level card
looks the same. Two should-fix items (S1, S2) and four nits, below.

## Findings, ranked

### Blocker
None.

### Should-fix
- **S1. The warm-up fetches the RsvpBlock chunk on every `/event` load, but
  `GOING_CHECKIN_ENABLED` is `false`** (`src/lib/goingCheckin.ts:14`, owner decision
  2026-10-18), so RsvpBlock never renders. Measured at runtime, prod build, 390x844, CPU 4x,
  same run order, 4 runs each:

  | build | ongoing: JS requests | ended: JS requests | lazy chunks fetched |
  |---|---|---|---|
  | main | 53 | 51 | LevelRatingPrompt, DerivedLevelBadge |
  | fix  | 55 | 53 | **RsvpBlock**, DerivedLevelBadge, LevelRatingPrompt |

  That is +2 JS requests on every event view (RsvpBlock plus one dependency) for code that
  never runs. `check:first-load-requests` and `check:bundle-budget` don't see it, because
  they only read the static first-load graph. Fix: wrap `void importRsvpBlock()` in
  `if (GOING_CHECKIN_ENABLED)`. The RSVP half of the fix currently guards a boundary that
  is never mounted in production, which also means the trace's "RsvpBlock" #421 can't
  happen on prod today.
- **S2. The loosened gating regex no longer pins the behaviour.** I mutated the branch's
  `BentoPage.tsx` (throwaway, reverted) and ran `derivedBadgeGating.test.ts`:
  - `{isCancelled ? badge :` changed to `{!isCancelled ? badge :`: **2 passed** (the mutant survives).
  - `isCancelled={Boolean(occurrence?.isCancelled)}` changed to `isCancelled={false}`:
    **2 passed** (the mutant survives; the old regex pinned the `occurrence?.isCancelled`
    source, the new one doesn't).

  The inversion mutant also survives on main's regex, so that half is pre-existing. The
  wiring half is new. The behaviour itself is correct; see Q1. Suggested fix: add
  `/isCancelled=\{Boolean\(occurrence\?\.isCancelled\)\}/` and anchor the first regex as
  `/\{isCancelled \? badge :/`. Better still, add a render test of `LevelSlot` like my
  throwaway in Q1.

### Nits
- **N1. Unhandled rejection on a failed warm-up.** `void importX()` has no `.catch`. A
  stale-deploy 404 on a lazy chunk would raise an `unhandledrejection` (Sentry noise) on
  top of `lazyWithRetry`'s heal. This copies the existing FestivalDetail precedent
  (`src/pages/EventPage.tsx:25`), so it is consistent with the repo, but `.catch(() => {})`
  costs nothing. There is no duplicate fetch: each `import()` specifier resolves to one
  module record, which matches the table above (each chunk fetched once).
- **N2. The warm-up isn't gated on the SSR DOM.** FestivalDetail's warm-up only fires
  when `.cinematic-festival` is present; the BentoPage one fires whenever the module loads
  in a browser, including client-side navigations. That only costs the requests in S1.
  The SSR guard (`typeof document !== 'undefined'`) is correct.
- **N3. Spec server ownership under `fullyParallel: true`.** Each worker's `beforeAll`
  spawns `_serve-build.mjs` on the fixed port 4391, and the first worker's `afterAll`
  kills it. In theory a second worker could then skip, or pass vacuously. I could not
  reproduce it: `--workers=4 --repeat-each=3` gave 6/6 pass on the fix and 6/6 fail on
  main. Low risk because it is a local-only spec (CI skips it, see Q3).
- **N4. Pre-existing, not this PR:** the ended page has a layout shift of CLS 0.121 at
  about 3.3 to 4 s (the bento grid relayouts: the Gallery/Date/Venue tiles move 176 px and
  one tile collapses to 0). It is identical on main (0.1213 / 0.1122) and the fix (0.1213 / 0.1213).
  It is just over the 0.1 "good" threshold. Worth its own ticket.

## Q1. BentoPage correctness

**Are the props stable?** All `LevelSlot` props are primitives: `eventId` string,
`isCancelled` boolean, `derivedLevel` is `'mostly_beginners' | 'mixed' | 'strong' | null`
(`src/modules/event-page/types.ts:78`), `levelVoteCount` number|null. The badge element is
built inside the slot. `RsvpSlot` takes strings plus `occurrence =
snapshot.occurrenceEffective`. That object is parsed in `queryFn`
(`useEventPageQuery.ts:290`, `:366`), not in `select`, so react-query's structural sharing
keeps its reference across re-renders unless the data really changes. `snapshotQueryKey`
is built inside `RsvpSlot`, so a new array only appears when the slot re-renders anyway.
No new literal reaches either memo from the parent (I read the diff hunks at
`BentoPage.tsx:764-785` on the branch).

**Is behaviour unchanged?**
- *Cancelled vs not.* Throwaway render test (I temporarily exported `LevelSlot`, mocked
  both lazies, then reverted; `git status` clean afterwards):
  `cancelled: bare badge, no prompt` and `not cancelled: prompt with badge fallback`:
  **2 passed**. On main the gate was `occurrence?.isCancelled ? badge : ...`; on the branch
  it is `Boolean(occurrence?.isCancelled)`, which is the same for null/undefined/false/true.
- *No occurrence.* `isCancelled` becomes `false`, so the prompt shows, same as main (`undefined`
  is falsy). The RSVP gate `snapshot.occurrenceId &&` is unchanged and sits outside the slot.
- *Ended / ongoing.* The visual walk (Q5) shows the same card on both builds.
- *Logged in vs out.* The slots read no auth state; auth reaches the lazies through context,
  same as on main. I only verified logged out.
- *Derived level present vs absent.* Passed through as a primitive. My throwaway covered
  `'mixed'` and `null`.
- `npx vitest run src/modules/event-page` on the branch: **27 files, 225 passed**. On main,
  `src/modules/event-page` plus `src/lib/__tests__`: 65 files, 1223 passed.
- `tsc --noEmit`: exit 0. eslint on the 4 changed files: 1 error
  (`react-hooks/set-state-in-effect`, line 220) and 1 warning (line 393), both on main too.

## Q2. Module-scope warm-up

- SSR guard: `if (typeof document !== 'undefined')`, so it is client only. Correct.
- Unhandled rejection: possible, see N1. Duplicate fetch: none, see S1 table.
- Static first-load is unchanged (prod build, `node scripts/check-bundle-budget.mjs`,
  `node scripts/check-first-load-requests.mjs`, both exit 0 on both trees):

  | | main | fix |
  |---|---|---|
  | `/event/:id` first-load JS | 378.5 KB / 43 files | 378.6 KB / 43 files (budget 381) |
  | `/city/:slug` | 207.4 KB / 39 | 207.4 KB / 39 |
  | first-load request pins | all 6 match | all 6 match |

  Runtime requests do go up by 2 (S1).

## Q3. e2e spec

`npx playwright test tests/e2e/event-hydration-421.spec.ts --project=chromium --repeat-each=3`
on the prod build (spec copied into main for the main run, then deleted):

| tree | result |
|---|---|
| main 995c841 | **6 failed**, each `[hydration] Minified React error #421` |
| fix a935d822 | **6 passed** (none skipped) |
| main, `--workers=4` | 6 failed |
| fix, `--workers=4` | 6 passed |

- It is in `test:e2e` by name (`package.json` diff: inserted after `account-settings.spec.ts`).
- It skips cleanly: `HYDRATION_BASE_URL=http://127.0.0.1:1 ...` gives **2 skipped**. In CI,
  `e2e-smoke.yml` doesn't build, so `build/` is missing, `beforeAll` returns, the fetch
  throws, and both tests skip. So in CI it is a permanent skip, which the author also notes.

## Q4. The three contract unit files

`npx vitest run tests/eventViewCompat.contract.test.ts tests/occurrenceProgram.contract.test.ts tests/publicEventPageLineup.contract.test.ts`:
on both main and branch, **10 failed / 9 passed in 3 files**. After stripping timings, the
FAIL and Error lines of the two runs are byte-identical (`diff` prints nothing). Cause: the
container's `VITE_SUPABASE_*` points at the test project, so these get `Invalid API key`
(5x), with null-data assertions following from it. This is environmental, not the PR.

## Q5. Visual, 390x844, CPU 4x, prod build

Screenshots (viewport only, PNG8, 40-50 KB each), scrolled to the level card when it first
appears in the DOM ("first paint") and 3 s later:
`main|fix`-`ongoing|ended`-`firstpaint|after3s`.png. RSVP block: **not rendered on either
build** (flag off), so there is nothing to compare. Level card: same on main and fix, same
at first paint and after 3 s, at the same document y in each build (ongoing 1731 / 1731;
ended 1738 at 3 s). Zero hydration errors in these unthrottled-network loads on both builds.
One trap I checked: in 3 of 4 fix/ended runs the card first appeared at y 1562 and then
moved to 1738. That is the pre-existing grid shift in N4; the fix's earlier chunk arrival
just puts the card in the DOM before the shift. CLS is identical on both builds.
Cover/listing images are broken in every shot because the sandbox blocks the
`*.r2.dev` image host (connect_rejected). That is environmental and the same on both builds.

## Verified
- Q1 prop stability (read), cancelled gating (throwaway render test), unit tests, tsc.
- Q2 SSR guard, static budgets and pins unchanged, runtime requests +2 (measured).
- Q3 red 6/6 on main, green 6/6 on branch, wired by name, skips cleanly.
- Q4 identical failures on main and branch.
- Q5 screenshots, level card positions, CLS on both builds.

## Not verified
- Logged-in rendering, and a real derived-level/vote-count shape from prod for the badge.
  I didn't log in, and no shape survey ran beyond the two event slugs.
- A real phone, a real network, Vercel (the live site is blocked by the sandbox).
- Cancelled and no-occurrence events in a browser (only the unit-level throwaway covered them).
- The RSVP visual (it is not rendered while `GOING_CHECKIN_ENABLED=false`).
- PR #878's GitHub checks (not read; plain git only per the brief).
- Images (the r2.dev host is blocked).
