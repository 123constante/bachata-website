# Handover: Dancer Rebuild R1a INTEGRATION (Website, `claude/dancer-app-r1a`)

Brief: `briefs/dancer-rebuild-r1a-integration.md` (branch `arc/briefs-dancer-rebuild`, sha 7dd415a5). Ticket dt_1fb0098b917b.
Started from df43188 (main + R0 + W1 + W2a + W2c + W2d). No PR opened, nothing merged to main (per brief).

## What changed, by brief step

1. **Merges** (70cde48 and the commit before it): `arc/dancer-app-w2b` @ 0a435d7, then `arc/dancer-app-w2e` @ ed2dfa22.
   The only conflict both times was `package.json` `test:e2e`. I resolved it as the UNION of every slice's specs. I also added
   W2c's `me-edit.spec.ts` and W2d's `photo.spec.ts`, which existed but were missing from the list. The list now names six
   dancer-app specs: reachability, onboarding, home-nights, me-edit, photo, options. No shell file conflicted.
2. **One `useMyDancerEdit`** (de31b90). W1 never exported a hook, so "use W1's" had nothing to point at. I put the ONE copy in
   `src/modules/dancer-app/api/useMyDancerEdit.ts`, with key `['my-dancer-edit', userId ?? null]` (INTERFACE). Removed:
   - the four per-screen copies (W2a onboarding, W2b home, W2c me, W2d photo);
   - Options' inline query, whose key used `'anon'`.

   Each screen keeps its own options: Home `staleTime 60s`; Onboarding `refetchOnMount: 'always'` and `retry: false`.
   `save` and `usePutMyDancerEdit` moved into the same file. `renderInShell` now mounts `CityProvider` (W2b's ask), and W2b's
   test mock gained a pass-through `CityProvider`.
3. **Base reds**:
   - `tests/client/dancerAppApi.test.tsx` (`fetchGate`): green on df43188 and on every run here, alone and in the full suite.
     I did not reproduce it, so nothing changed.
   - `reminderBanner.today` (2 tests): the **snapshot was wrong**. R0 recorded `/app` and `/app/home` as SHOWN before the
     rebuild. W1's seam deliberately added `/app` and `/app/*` to `BANNER_HIDDEN_ON`; the file's own header said that row
     would flip. I flipped both rows, added a `/apps` prefix-guard row, and dropped the obsolete snapshots.
   - Two more base reds, not in the brief, now mine:
     - `dancerAppMeEdit` "invalid url": the test expected the generic copy. Edit's client checks had hand-written copy.
       **Code fixed:** `screens/me/model.ts` now calls `copyFor()`, the ONE mapping in `api/errors.ts`, and the test expects
       the field-named copy.
     - `dancerAppShell` `/app/me/edit`: jsdom has no `ResizeObserver`, which Edit's Radix Switch needs. The stub now lives in
       `renderInShell`.
   - `docs/session-handover-2026-10-15-dancer-w1.md` was no longer at the repo root, so there was nothing to move. The
     isolation check is green.
   - Pre-ship eslint: `renderInShell.tsx` has warnings only (react-refresh) and 0 errors. `account.today` and
     `authCallback.today` had a `react-hooks` globals ERROR. Their `Probe` now writes its module variable in an effect.
4. **Perf** (c9cb300). Measured with the same bare `npm run build` + `npm run check:bundle-budget` on both trees:

   | Tree | /event/:id first-load JS (gz) | Files |
   |---|---|---|
   | main 4a63921 | 379.7 KB | 47 |
   | r1a, before any fix | 380.4 KB | 48 |
   | r1a, after the fix | **376.3 KB** | **47** |

   Before the fix, the route grew **+0.7 KB**, over the 0.5 KB line. The cause: the level-rating modules
   (`useSeriesLevelRating`, `levelRatingModel`, `pendingLevelRating`), now shared with the dancer app's Nights and Home, were
   cut into their own chunk. The fix makes `DerivedLevelBadge` and `LevelRatingPrompt` lazy in `BentoPage.tsx`, the same
   pattern as `RsvpBlock`. The event route is now **3.4 KB below main**.

   Only then did I raise the dancer-app rows: 355.4 KB / 57 chunks measured, so budget 310 -> 360 and chunk allowance
   41 -> 57. A one-line justification is in `perf-budgets.json` (`//dancer-app-2026-10-15-r1a`).
5. **Deterministic sandbox sign-in** (bf87602). Root cause: the sandbox's `VITE_SUPABASE_URL` points at the E2E project, but
   `organiserFake` stored the session under the hard-coded prod key `sb-stsdtacf...-auth-token`. supabase-js never found
   it, so every signed-in spec landed on `/auth`. Changes:
   - The fake now reads the ref from `VITE_SUPABASE_URL`, the same env the dev server is started with.
   - `playwright.config.ts` webServer defaults `VITE_ENABLE_ORGANISER_SELF_SERVE` to `'true'`, as `e2e-smoke.yml` sets it.
     Without it `/account` `<Navigate>`s to `/`. An explicit env still wins.
   - home-nights and onboarding dates come from the fake's frozen clock (`NOW`), not the machine clock.
   - reachability mocks `my_dancer_edit_v1`, because real screens replaced the placeholders.
   - The photo spec's old photo is now an own-prefix upload. W2d's later fix d515401 deletes only those; the old foreign URL
     made "delete" never happen. The spec now asserts the delete body, and a new case checks that replacing a legacy
     foreign photo sends **no** delete.
   - Two real tap-target defects the spec then caught were fixed: Edit city picker 340x34 -> min-h 48; Options "Account
     settings" link 103x16 -> min-height 44.
6. **Every CI job step** is in the per-job table below; full detail in `dancer-rebuild-r1a-ci-table.md`.
7. **Review pack** (9b6fcee). `docs/review-pack/r1a/`: 7 screens x 6 shapes = 42 PNGs, plus `measurements.md` and `.json`.
   All on **MOCKED RPCs**. Regenerate with `tests/e2e/dancer-app/review-pack.spec.ts`; it runs only when `REVIEW_PACK_DIR`
   is set, so it is not in `test:e2e`.

   Result: 42/42 have scrollWidth 390/390, 0 controls under 44px, and `elementFromPoint` at the primary control lands on it.
   The walk found and I fixed:
   - Nights night-name links were 23px tall; now min-height 44.
   - A broken-image icon for avatars the browser refuses. Prod has **2** dancer avatars on a host outside `app/csp.ts`
     `img-src`. `Avatar` now falls back to the initial `onError`, and Home reuses `Avatar`.
8. CI-found fixes (3e5fc13):
   - `loading="eager"` on two `<img>` (`AUDIT_STRICT` `check:images`).
   - R0's `check-dancer-area-isolation.mjs` added to `prove-entry-point-dispatch.mjs` TARGETS. `prove:entry-point` had exit 2.
   - Isolation RULES gained:
     - `docs/review-pack/` as a doc prefix;
     - seams for `BentoPage.tsx`, `playwright.config.ts` and `prove-entry-point-dispatch.mjs`, each with its reason.

## Decisions and INTERFACE deviations
- **INTERFACE section 5 deviation:** four isolation-rule additions that INTERFACE does not list: three seams and one doc
  prefix. The INTERFACE file is on `arc/briefs-dancer-rebuild`, which this worker may not push; the owner or orchestrator
  should add them there.
- The canonical hook lives in `api/`, not `shell/` or `gate/`, because W2c's own comment said "unify into api/".
- `Avatar` initial uses `display_name || first_name`. Home's old inline circle used `first_name || display_name`, so Home's
  placeholder letter can differ for a display-name-only profile. That gives one mapping, as the owner's rule requires.
- The event-page level badge now appears after its chunk loads. The rating card already loaded async behind a query.

## Shapes surveyed (prod, read-only, counts only)
- `dancer_profiles.avatar_url`: none 66, r2.dev 99, other host 2 (the 2 the CSP blocks).
- Profile shapes come from W1's fixture survey (`DANCER_SHAPES`, 152 profiles). I did not re-survey those.

## Red-first proof
| Test | Failure on the unfixed code |
|---|---|
| `tests/client/dancerAppAvatar.test.tsx` "falls back to the initial..." | `AssertionError: expected <img ...(4)></img> to be null` |
| `reachability.spec.ts` 7 routes | 6 failed before the fake fix: "waiting for getByTestId('dancer-screen-me')"; `/account` landed on `/city/london-gb`. After the fake fix: `shortControls` returned `"London 340x33.921875"`, `"Account settings 103.1875x16"` |
| `photo.spec.ts` replace / retry | `expect(order).toEqual([... 'delete'])`: Received had no delete (spec stale vs d515401) |
| review-pack Nights | `Soho Sensual Thursdays 182x23 \| Camden Social 109x23 \| Brixton Bachata Night 160x23` |
| `dancerAppMeEdit` invalid url | `expected 'Your website must start with http:// ...' to be 'That link must start with http:// or ...'` (red on df43188) |
| `dancerAppShell` /app/me/edit | `ReferenceError: ResizeObserver is not defined` (red on df43188) |
| `reminderBanner.today` /app, /app/home | `expected false to be true` |

## CI per-job table (sandbox; GitHub Actions not used)
| Job | Command | Exit | Result |
|---|---|---|---|
| architecture-guard / integrity | `bash bin/check-integrity.sh`, legacy guards, `lint:architecture`, image widths, mojibake, plan hygiene, workflow-artifact policy | 0 | all ok (bin scripts lack the exec bit in git, as on main, so they were run via bash) |
| architecture-guard / integrity | `AUDIT_STRICT=1 npm run check:images` | 1 -> **0** | 2 `<img>` without `loading`; fixed in 3e5fc13 |
| architecture-guard / integrity | `npm run prove:entry-point` | 2 -> **0** | isolation script missing from TARGETS; fixed; 43 entry points proven |
| typecheck | `npm run typecheck` | n/a | **96** `error TS` lines, baseline 106: green (re-run on 3e5fc13) |
| typecheck / wallclock-brand | `check:rpc-typing`, `check:wallclock-brand` | 0 | ok |
| unit-tests / unit | `npm run test:unit` | 1 | 7913 passed, 15 failed: 10 `*.contract.test.ts` "Invalid API key" (no live DB creds) + 5 `integrityCouldNotRun` "precondition gone". **The same 15 fail on main** |
| unit-tests / unit | `npm run test:unit:offline` | 1 | 7898 passed, 5 failed (`integrityCouldNotRun`, same on main) |
| unit-tests / timing, NY, Sydney | `test:unit:timing`; the TZ runs | 0 | 65 / 213 / 213 passed |
| unit-tests / dancer-area-isolation | `--self-test`; `npm run check:dancer-area-isolation` | 0; 1 -> **0** | 55 cases ok; 46 rule-(a) hits fixed in 3e5fc13 (OK, 199 changed files) |
| e2e-smoke | `npm run test:e2e` (retries 0) | 1 | 144 passed, 2 failed, both in `dancer-home.spec.ts` (a pre-rebuild spec) |
| e2e-smoke | `CI=true npm run test:e2e` (retries 1, as CI) | 0 | 146 passed, 0 flaky; that spec alone x2: 28/28 |
| e2e dancer-app (all six specs) | `npx playwright test tests/e2e/dancer-app/` | 1 then 0 | full run at bf87602: 43 passed, 2 failed (the two tap targets); after the fix the three specs involved (reachability, options, me-edit) re-ran 29/29 |
| perf-budget | 3 self-tests, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 | all green |
| phone-qa | `playwright.phone.config.ts` | 1 | 173 passed, 1 failed: `scroll-reset.phone.spec.ts:114`, which also flakes on main (2/21 there vs 1/21 here) |
| phone-qa / build-smoke | build + `playwright.build.config.ts` | 0 | 3 passed |
| workflow-lint, db-contract offline halves, canaries (ci-budget, storage, firewall, og, seo, phone-qa-section) | self-tests | 0 | PASS |
| lint | `npm run lint` | 1 (exec bit) / 0 after `chmod +x` | 16/16 links; eslint informational |
| pre-ship | `npm run pre-ship` | 1 | only `check:integrity` (exec bit, 126) and `test:unit` (the 15 above) fail; both reproduce on main |
| SKIPPED | lighthouse, doc-weight, og/seo/synthetic preview, live DB contract checks, real-data-verified, phone-qa-section body | n/a | need secrets, a live preview deploy or the PR body |

## Verified
- Merges carry every slice's behaviour, and all dancer-app unit/client/regression tests pass (27 files, 1004 tests).
- Production build passes, and the perf gate is green. The event route's first-load is 3.4 KB below main.
- All six dancer-app e2e specs and the review pack (42 shots) pass in the sandbox at 390x844, with deterministic sign-in.
- Isolation, entry-point, images, typecheck and eslint (0 errors in touched files) are green on 3e5fc13.

## Not verified
- **Real data in a browser:** every screenshot is MOCKED RPCs. There was no walk against prod data, and no real phone.
- **GitHub Actions:** not run by me. Contract tests with real secrets run only in CI (the live-DB gate says live=true).
- The two other-host prod avatars: I counted them only and did not look at the hosts. The fallback is tested on a mocked URL.
- `dancerAppApi` `fetchGate` red: not reproduced, so not fixed. If it reappears it is likely order-dependent.
- The full dancer-app e2e run after 3e5fc13: that commit only adds `loading` attrs and guard config. I did not re-run all
  six specs on it.
- Vercel preview: not checked (no token used).

## Open owner questions
1. **Terms and Privacy** (W2a + W2e): no Terms or Privacy pages exist. The onboarding consent line is text-only, and the
   Options row is disabled with a reason. Build the pages, or keep it as is?
2. Add R1a's three seams and the `docs/review-pack/` doc prefix to INTERFACE section 5.
3. The `/event/:id` budget (381) now has 4.7 KB of headroom. Tighten it?

## Parallel worker on this branch
A second session (ticket dt_04e055e9629b) pushed 3a6aa23 to this branch while this worker ran. It made the same three CI fixes as 3e5fc13 and wrote its own R1a handover, which I kept unchanged as `dancer-rebuild-r1a-parallel-dt_04e055e9629b.md`. I merged its commit without a force-push and took its version of the shared lines. The duplicate TARGETS line the auto-merge produced was removed. One finding of its own: the `integrityCouldNotRun` red comes from the sandbox `NODE_PATH` (a global typescript). With `NODE_PATH=` the offline unit suite is 7903/7903.

## What is left
Nothing from the brief, apart from the Not-verified items above. Next: a PR from this branch, with a real-data browser walk
and a phone check.
