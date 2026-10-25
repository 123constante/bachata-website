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

## Review fixes (worker dt_368c8ffe2ee6, 2026-10-15)

Brief: `briefs/dancer-rebuild-r1a-fix.md` (arc/briefs-dancer-rebuild @ 0f9dc56). Work list: the independent review
`docs/handover/dancer-rebuild-r1a-review.md` (arc/dancer-app-r1a-review @ 7176604). Base 3a6aa23. All fixes are in
ONE commit, `fix(dancer-app): R1a review fixes ... PARTIAL`; this handover rides in the same push.

Red-first: the two new test files were written FIRST and run on the unfixed head 3a6aa23 (only the test files
added): `tests/client/dancerAppReviewFixes.test.ts` **22 failed / 64 passed**, then
`tests/client/dancerAppReviewFixesScreens.test.tsx` **19 failed / 1 passed**. Quotes below are from those runs.
After the fixes: 97/97 and 20/20.

| Finding | Fix (files) | Test that went red on 3a6aa23 -> failure quote |
|---|---|---|
| **B1** no-photo shape impossible | `api/fixtures.ts` new `noPhoto` shape (55%, next step photo) joins every table test; `tests/e2e/dancer-app/review-pack.spec.ts` builds every pack shape through `withDerived`, asserts `pct >= 70 <=> complete` and that Home / Me / Onboarding say "Add your photo to reach 70%." on the no-photo shape; `home-nights.spec.ts` 70% row now has a photo | screens: `S2 + B1 ... > noPhoto` -> `Unable to find an element by: [data-testid="tile-strength-next"]` (the shared next-step line did not exist on Home) |
| **S1** Retry resent a stale delta | `screens/edit/EditScreen.tsx`: Retry calls `submit()` (delta recomputed from the CURRENT draft + server shape); after a save the draft resets to the server shape ONLY if it was not edited while the save was in flight | `S1 ... fail, edit while the error shows, retry` -> `expected { languages: [ 'French' ] } to deeply equal { languages: [ 'French' ], ...(1) }` (the bio typed after the error was dropped) |
| **S2** three next-step tables, two band tables | NEW `api/nextStep.ts`: `NEXT_STEP` (label + target), `nextStepShort` / `nextStepLine`, `ROLE_CHOICES`, ONE `YEAR_BANDS` table. Home tile (`tile-strength-next`), Me (`me-next-step`) and Onboarding (new `onboarding-next-step` under the meter) render `nextStepLine`; `home/homeCopy.ts` table deleted; `me/model.ts` and `onboarding/model.ts` re-export the shared vocabulary. Bands are now "Just started / 1 to 2 years / 3 to 5 years / 6 years or more" in BOTH screens | screens: 16 shapes `S2 + B1 > <shape>` -> `Unable to find an element by: [data-testid="tile-strength-next"]`; pure: `S2: one next-step table` -> `Cannot find module '@/modules/dancer-app/api/nextStep'`. New: band round-trip test (Onboarding pick reads back as the same Edit band) |
| **S3** `is_active` ignored, "Saved" fallback | `screens/nights/nightsModel.ts`: `Night.listed` (= `is_active !== false`); unlisted nights are never the hero, never counted, never nudged; `STATUS_LABELS` covers the live CHECK vocabulary (`going`, `interested`, `not_going`) and the older `registered` / `attended` / `cancelled`; anything else reads "Status unknown". `NightsScreen` shows "This event is no longer listed." and no vote on such a row. Edit's done line is "Your changes are live." (was "Saved") | `S3 ... unlisted night` -> `expected { seriesId: 'e1', name: 'Night', ...(8) } to be null`; `status "" reads "Status unknown"` -> `expected 'Saved' to be 'Status unknown'`; `status "not_going"` -> `expected 'Not_going' to be 'Not going'`. New: a source scan that no dancer-app string is "Saved" |
| **S4** chip toggle twice wrote | `api/delta.ts`: `favorite_styles` compared as a SET (order-insensitive); everything else unchanged | `S4 ... toggling a style off and on again is no change` -> `expected { favorite_styles: [ ...(2) ] } to deeply equal {}` |
| **S5** `profile_strength_70` missed the photo path | `api/useMyDancerEdit.ts` `writeMyDancerEdit`: the ONE cache write (save, `usePutMyDancerEdit`) fires the event when the cached pct goes from < 70 to >= 70, once per profile per page session; Photo now writes through `usePutMyDancerEdit`; Onboarding's own copy removed | `S5 ... a photo-path cache write (55 -> 70) fires exactly once` -> `expected [] to deeply equal [ [ 'profile_strength_70', ...(1) ] ]` (*) |
| **S6** Me/Edit name ignored surname + hide flag | NEW `api/publicName.ts` `ownPublicName` / `ownInitial`: mirrors `get_public_dancer_names_v1` (`_public_surname_v1`, `_public_display_name_v1`, `_public_person_name_v1`, read from prod) and resolves through `src/lib/publicName.ts renderPublicName`; `me/model.ts profileName` and the Avatar initial use it | `S6 ... shape 0` -> `expected 'Ana' to be 'Ana Lopez'`; `shape 4` (hidden surname, display name only) -> `expected 'Ana Lopez' to be 'Ana'` |
| **S7** casts at the API boundary | `api/rpc.ts`: `dance_role`, `strength.next_step`, `strength.missing` filtered through `DANCE_ROLES` / `STRENGTH_STEPS`; unknown -> null / dropped + one `console.warn` per value; no casts left | `S7 ... unknown next_step` -> `expected 'bogus' to be null` |
| **S8** raw Unicode punctuation | every hit in `src/modules/dancer-app` replaced by its JS escape (all were inside string literals or comments) | `S8 ...` 7 files red, e.g. `src/modules/dancer-app/screens/me/model.ts` -> `expected [ ...(6) ] to deeply equal []`. The scan stays as a unit test (not a lint-chain link: `scripts/run-lint-chain.mjs` is outside the seam list) |
| **S9** event route server HTML unpinned | NEW `tests/ssr/eventLevelBadgeSsr.test.tsx` (node, real `app/routes/event.tsx` + dehydrated state, anonymous): settled HTML carries the event name and exactly one "Dancers rate:" badge; the first pass vs settled pass are byte-identical once the lazy badge slot (and the separately lazy RSVP section) is removed; below threshold no badge | proved able to fail: with `derivedLevel: null` -> `expected '<div role="region" aria-label="Notifi...' to contain 'Dancers rate:'`. Not a bug test: the branch was already right, so there is no "red on 3a6aa23" |
| **S10** allow-list in code, self-amendable | NEW `scripts/dancer-area-isolation-allowlist.json` (docPrefixes, seams, seamNotes, protected); the script's RULES read it (unreadable/malformed = exit 2, "could not measure"); a test fails if RULES differs from the JSON or names any allowed path in code | `S10 ...` -> `ENOENT: no such file or directory, open '.../scripts/dancer-area-isolation-allowlist.json'` |
| **S11** stored styles outside the presets | `screens/edit/editModel.ts` `styleChipOptions` / `chipFor`: each stored value shows ONCE, compared trimmed + case-insensitive, so "zouk" selects the "Zouk" preset; the 100% fixture now holds prod-shaped values ("Bachata Sensual", "Bachata Influence") | `S11 ...` -> `Zouk: expected 2 to be 1`. New: every prod `favorite_styles` value from the survey yields exactly one chip |
| **S12** nationality free text | Edit uses the shared `NationalityPicker` (shows the name); `editModel.ts nationalityCodeForPick` turns the pick back into the ISO code | `S12 ... a stored "ES" reads "Spain"` -> `expected '' to match /Spain/`. e2e (`me-edit.spec.ts`): ES shows Spain, picking France saves `{ nationality: 'FR' }` |
| **S13** ~10px help text | `theme/dancer.css`: inside the dancer app the shared switch's label reads 15px and its help text / disabled reason 14px (the protected component is untouched) | e2e `me-edit.spec.ts` "hide-surname help text and its disabled reason are at least 13px": run by the continuation worker with the `theme/dancer.css` S13 block removed -> `expect(received).toBeGreaterThanOrEqual(expected) Expected: >= 13 Received: 10.179`; block restored -> 1 passed |
| **Perf** | `perf-budgets.json`: `attribution.baseline.routes` gains the dancer-app row (357.2 KB / 58 chunks / 3 pullers, perf-budget.yml env); `chunkRatchet` dancer-app 57 -> 58 (the new chunk is `assets/publicName-*.js`, bought by S6) | `check:bundle-budget` red before the edit: `[OVER] chunk ratchet: dancer-app ... 58 first-load chunk(s), allowance 57`; green after |

(*) The S5 red quote came from the first version of the test, which did not yet publish the analytics identity
(the probe route sits outside the shell). The unfixed `usePutMyDancerEdit` contained no tracking call at all
(`git show 3a6aa23:src/modules/dancer-app/api/useMyDancerEdit.ts`), so it cannot pass either way.


### STATUS: PARTIAL (owner context gate at 30%; this worker stopped)

Done: every SHOULD-FIX code change (S1-S8, S10-S13), B1 fixtures + pack spec edits, S9 test, N1/N2/N8/N10/N16/N23.
Green in the sandbox (NODE_PATH= set empty): `tests/client/dancerApp*`, `src/modules/dancer-app`, `tests/catchallClientPaths.test.ts`,
`tests/regression/today`, `tests/ssr` = 34 files, 1178 tests passed, 0 failed (run before the fixture `noPhoto`
shape was added: 1161; after: 1178).

CI per-job (sandbox, this worker, before the stop):

| Job | Command | Exit |
|---|---|---|
| architecture-guard | PyYAML present; `bin/check-integrity.sh`; `check:legacy-tables`; `check:legacy-program-rpcs`; `lint:architecture`; `AUDIT_STRICT=1 check:images`; image-widths (self-test + guard); plan-hygiene self-test; workflow-artifact-policy (self-test + guard); mojibake self-test; mojibake `git grep`; `prove:entry-point` (self-test + guard) | 0 (all 12) |
| typecheck | `check:rpc-typing`; `check:wallclock-brand` | 0, 0 |
| unit-tests / dancer-area-isolation | `--self-test` | 0 (55 cases) |
| unit-tests / dancer-area-isolation | `npm run check:dancer-area-isolation` | 0 after `git fetch origin main` (the sandbox's stale origin/main made it exit 2 "could not measure" first; a `chmod +x bin/*.sh` mode change was reverted so it is not committed) |
| unit-tests | `NODE_PATH= TZ=Europe/London npm run test:unit:offline` (offline stub URL/key, as the live=false CI leg) | 0: 312 files, 8024 passed, 26 skipped (continuation worker). It again rewrote 10 `tests/regression/today` + 1 organiser `.snap` in the working tree; restored with `git checkout -- '*.snap'`, NOT committed |
| unit-tests | `NODE_PATH= TZ=Europe/London npm run test:unit:timing` | 0: 6 files, 65 passed |
| workflow-lint | BOM scan of `.github/workflows/*.yml`; `lint-workflow-masking.mjs`; `lint-workflow-notification.mjs --self-test` + guard | 0, 0, 0, 0 |
| db-contract (no-secret step) | `node scripts/check-migration-stamps.mjs` | 0 |
| perf-budget | 3 canaries (`check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test`); `npm run build` with the workflow env; `check:bundle-budget`; `check:first-load-requests`; `check:chunk-cycles` | 0,0,0; 0; 1 -> 0 after the perf row (see Perf above); 0; 0 |
| lint chain | `npm run lint` | 16/16 links green, eslint informational (exit 1, red on main too). NOTE: in this sandbox `bin/check-integrity.sh` is checked out 100644 (same on main), so the integrity link exits 126 unless the file is made executable; it was run with `chmod +x` and the mode REVERTED before commit (`bash bin/check-integrity.sh` alone: 0) |
| dancer-area-isolation | `--self-test`; `npm run check:dancer-area-isolation` (after `git fetch origin main`) | 0; 0 (221 changed files, 26 protected checked) |
| dancer-app e2e | `npx playwright test tests/e2e/dancer-app --project=chromium` | 1: 45 passed, 43 skipped (the review pack, which needs `REVIEW_PACK_DIR`), 2 failed in `reachability.spec.ts` (`/account` stayed on `/account`, expected `/auth?` and `/app/home`). Re-run of that spec alone: 14/14 passed. Order/load dependent, NOT root-caused; flagged for the orchestrator |
| e2e-smoke | `npm run test:e2e` (the CI list, chromium, e2e-smoke.yml placeholder env) | 1: 147 passed, 1 skipped, 1 failed: `dancer-home.spec.ts` "I organise events" opens the unchanged onboarding (`locator.fill: Timeout 15000ms`, `onboarding-search`). Re-run of that spec alone: 14/14 passed. Same class as above (timing under a 4-core sandbox), NOT root-caused |
| phone-qa | `npx playwright test --config playwright.phone.config.ts`; build with the fake-Supabase env + `playwright.build.config.ts` | 0: 174 passed, 64 skipped; build 0; smoke 0: 3 passed |
| review pack | `REVIEW_PACK_DIR=docs/review-pack/r1a npx playwright test tests/e2e/dancer-app/review-pack.spec.ts --project=chromium --workers=1` | 0: 43 passed. Shots regenerated; `measurements.json` changed only on welcome x no-photo (now lands on the photo step); `measurements.md` updated |

### What is left (exact next steps for the next worker, on `claude/dancer-app-r1a`)

1. `git fetch origin main` first (else the isolation check exits 2). Never `chmod +x bin/*.sh` without reverting the mode before commit.
2. Run the no-secret CI steps above that are NOT RUN; fill the table. `test:unit:offline` with `NODE_PATH=`; afterwards
   `git status` and `git checkout -- '*.snap'` if any snapshot moved (do not commit snapshot rewrites).
3. Perf: build with the perf-budget workflow env, `npm run check:bundle-budget`, then add the dancer-app row to
   `perf-budgets.json` `attribution.baseline.routes` (`firstLoadGzipKB`, `chunks`, `pullers` as measured) with a `//` note.
4. e2e: `npx playwright test tests/e2e/dancer-app` (the `me-edit.spec.ts` S12 picker test and S13 font-size test are
   new and UNRUN; show S13 red by running it with the `theme/dancer.css` S13 block removed, then green). Then the
   `test:e2e` list and phone-qa.
5. Regenerate the review pack: `REVIEW_PACK_DIR=docs/review-pack/r1a npx playwright test tests/e2e/dancer-app/review-pack.spec.ts --project=chromium`
   (B1: the seven `*--no-photo.png` shots change; complete-extras edit shot changes for the prod-shaped styles).
6. 390x844 browser walk on prod-shaped data; `/code-review` per CLAUDE.md; then a final commit whose subject ends
   `[worker-done dt_368c8ffe2ee6]`.

### Continuation (worker dt_1afc14232667, 2026-10-15)

Brief `briefs/dancer-rebuild-r1a-fix-2.md`. Did items 1-5 of "What is left" above; item 6's browser walk and
`/code-review` are the orchestrator's per that brief. Changes committed: `perf-budgets.json` (baseline row + chunk
allowance 58 with a note), the regenerated `docs/review-pack/r1a` shots + measurements, this section. No source change.

Event route first-load (owner rule <= +0.5 KB gz vs main), perf-budget.yml env, same command on both: main 4a63921
379.8 KB / 47 files; this branch 376.4 KB / 47 files = **-3.4 KB**.

Verified (sandbox, this worker): every no-secret CI step in the table above; S13 red (10.179px) then green; S12
picker e2e green; review pack regenerated and the no-photo shots show "Add your photo to reach 70%."

Not verified: browser walk on prod-shaped (real) data and `/code-review` (orchestrator); the live-DB contract
suites (`test:unit` with secrets) and Lighthouse (need secrets/network); real PR CI (no PR opened by this worker);
the two e2e flakes above are not root-caused (each spec passes alone); Vercel preview not checked.

Untracked, deliberately not committed: `docs/handover/dancer-rebuild-w2b/` and `-w2e/` (screenshots other e2e
specs write as a side effect); tracked w2a/w2d shots the same runs rewrote were restored.

### NOTEs

| Note | Outcome |
|---|---|
| N1 empty delta sent without `current` | FIXED (`api/rpc.ts`: reads the person, sends nothing). Red: `expected [ 'save' ] to not include 'save'` |
| N2 explicit `undefined` counted as a change | FIXED (`api/delta.ts`). Red: `expected [ 'first_name' ] to deeply equal []` |
| N3 admin-only codes unmapped | Not changed: deliberate (no Website wrapper calls an admin RPC); recorded here as the INTERFACE deviation the review asked to record |
| N4 unconfirmed email | Spec gap, not code: needs an orchestrator decision on how the client can tell "unconfirmed" from "unlisted" |
| N5 fake backend rule gaps | Not done: test-only breadth, no user-visible effect; left for a test-hardening slice |
| N6 photo delete host / `%2F` | Not done: needs the admin delete function's key semantics confirmed first (admin repo) |
| N7 5 MB cap on the original | Not done: `src/lib/upload-validation.ts` is outside the seam list (needs an orchestrator decision) |
| N8 "to reach 70%" on every required step | FIXED via S2: only the last missing required step "reaches" 70%, earlier ones move "towards 70%" (pure test N8) |
| N9 nudge card wording / window | Not done: copy decision for the owner ("Rate last night's event" for a 3-day-old night) |
| N10 one vote per past occurrence | FIXED: one vote per series, on its most recent past night (`NightsScreen.tsx`; `dancerAppHomeNights.test.tsx` vote test now pins 1 prompt for 3 past dates of one series) |
| N11 "Boost to 100%" with bio not asked | Brief-dictated label: for the orchestrator |
| N12 `first_going_tap` / `first_level_vote` fire nowhere | Not done: conscious 1a gap (W2-SHARED); recorded |
| N13 disabled-without-reason / rollover | Not done |
| N14 duplicated error copy | Not done (cosmetic; one copy is in a protected file) |
| N15 `useDancerArea` ready while auth resolves | Not done: safe behind `AuthGuard`, recorded |
| N16 bare `/app` not in robots | FIXED: `public/robots.txt` adds `Disallow: /app$` (exact; does not catch `/apps...`) |
| N17-N25 | Not done except: N23 `me-edit.spec.ts` "a teacher does" now really opens the teacher shape; N24 adds the true no-photo shape (B1), `is_active: false` and every RSVP status (S3), toggle-twice (S4), Retry-after-edit (S1). The rest of N24/N25 (more pack shapes, real-photo shots, 360x640, focus trap) is a separate pack slice |

### Isolation allow-list (S10) -- for the orchestrator to mirror into INTERFACE section 5

`scripts/dancer-area-isolation-allowlist.json` is now the ONLY copy the guard reads. Contents (paths):

- docPrefixes: `docs/handover/`, `docs/review-pack/`
- seams: `src/components/AnimatedRoutes.tsx`, `src/components/AppChrome.tsx`, `src/lib/profileCompletion.ts`, `src/components/profile/ProfileCompletionChrome.tsx`, `src/components/catchallClientPaths.ts`, `tests/catchallClientPaths.test.ts`, `public/robots.txt`, `package.json`, `perf-budgets.json`, `src/lib/analytics.ts`, `.github/workflows/unit-tests.yml`, `scripts/check-dancer-area-isolation.mjs`, `src/modules/event-page/bento/BentoPage.tsx`, `playwright.config.ts`, `scripts/prove-entry-point-dispatch.mjs`, `scripts/dancer-area-isolation-allowlist.json`
- protected: `src/pages/Account.tsx`, `src/pages/AuthCallback.tsx`, `src/components/account/DancerProfileGate.tsx`, `src/components/auth/AuthGuard.tsx`, `src/components/account/DancerHome.tsx`, `src/pages/FinishProfile.tsx`, `src/components/profile/DancerDashboard.tsx`, `src/pages/EditProfile.tsx`, `src/components/EventAttendanceButtons.tsx`, `src/hooks/useAttendance.ts`, `src/modules/event-page/hooks/useOccurrenceRsvp.ts`, `src/pages/AccountSettings.tsx`, `src/lib/accountSettings.ts`, `src/hooks/useMyProfileVisibility.ts`, `src/components/profile/HideSurnameSwitch.tsx`, `src/components/account/HideSurnameCard.tsx`, `src/lib/publicDancerNames.ts`, `src/pages/PracticePartners.tsx`, `app/routes/sitemap.tsx`, `src/pages/Auth.tsx`, `src/components/auth/AuthStepper.tsx`, `src/pages/DancerProfile.tsx`, `app/routes/dancers.tsx`, `src/modules/event-page/bento/blocks/RsvpBlock*.tsx`, `src/pages/FestivalHub.tsx`

Note for INTERFACE Round-3: it names `src/pages/BentoPage.tsx`, which does not exist; the real path (and the JSON
entry) is `src/modules/event-page/bento/BentoPage.tsx`. CODEOWNERS on the script (review S10) is not added: a new
`.github/CODEOWNERS` is outside the seam list (orchestrator decision).

### Decisions made without asking

- Band labels: "Just started / 1 to 2 years / 3 to 5 years / 6 years or more" with Edit's stored years (0/1/4/8 back):
  Onboarding's old "1 to 3 years" stored 2 years back, which Edit read as "1-2 years"; one table now.
- Me shows `nextStepLine` (same words as Home and Onboarding) plus a separate line "Going and Interested unlock at
  70%." while incomplete; the main button keeps the short label.
- The name rule follows the PUBLIC page exactly: with a first name set, a display name is NOT what the public sees
  (`_public_person_name_v1` prefers first name + surname), so Me/Edit no longer show the display name in that case.
- Unlisted nights stay in the lists (with "This event is no longer listed.") rather than being hidden.
- `favorite_styles` is diffed as a set; `favorite_songs` / `achievements` / `languages` keep in-order compare.
- Done copy after a save: "Your changes are live." (the banned word was "Saved").
- `robots.txt`: `Disallow: /app$` instead of `Disallow: /app` (which would also match any `/app...` prefix).

### Observed, not in scope

- `get_my_event_attendance_v2.start_time` is a `timestamptz` (live definition, read-only), but `mapNight` only
  accepts `HH:MM...`, so the Nights / Home time is always blank on real data. Needs a London wall-time read; left
  for the orchestrator (not a review finding).
- The S9 SSR render of an anonymous upcoming event shows "RSVPs are closed for this event" in the RSVP block
  (seeded snapshot without attendance data; may be the fixture, may be real: worth a look on main).

### Shapes surveyed (prod `stsdtacfauprzrdebmzg`, read-only, counts only)

- `event_attendance`: 3 rows; status CHECK = going / interested / not_going; going x inactive series past 1,
  going x live past 1, interested x live past 1 (so `is_active: false` is a REAL shape today).
- Name rule: bodies of `_public_surname_v1`, `_public_display_name_v1`, `_public_person_name_v1`.
- `favorite_styles` and `nationality` shapes: from the review's survey (values listed in S11; 18 ISO codes / 149 empty).

## Real-data fixes (F1-F3) (worker dt_95c2fb1ca8dd, 2026-10-15)

Brief `briefs/dancer-rebuild-r1a-fix-3.md` (sha 7b4d2fe). Base d50046f; fix commit 4243bee. New prod-shaped fixture
`linkNoBio` in `api/fixtures.ts` (90%, next step bio_social, website `www.` without a scheme, 1-letter Facebook,
36-char Instagram, no bio, `other_roles: ['organising']`, no WhatsApp number) joins every table test and the review pack.
New test file `tests/client/dancerAppRealDataFixes.test.tsx`. Prod counts come from the brief (orchestrator's survey);
this worker did not re-query prod.

| Finding | Fix | Red on d50046f (quote) |
|---|---|---|
| **F1** "Add a bio and a link" shown to a person with links (68/167) | `api/nextStep.ts` NEW `nextStepFor(profile)`: the ONE reading; bio_social -> link and no bio "Add a short bio" (focus bio), bio and no link "Add your Instagram, Facebook or website" (focus instagram, new `EditFocus` + Edit `FOCUS_IDS` entry), neither keeps "Add a bio and a link". `nextStepShort` / `nextStepLine` take the profile; Home, Me (`mainAction`, `nextStepCopy`) and the Onboarding `Meter` (now `profile` prop) all call it | `F1 ... link, no bio` -> `TypeError: nextStepFor is not a function`; `Home, Me and the onboarding meter` -> Home rendered the old label, then `TypeError: Cannot read properties of undefined (reading 'pct')` on the meter; `the Edit focus for "bio, no link"` -> `expected '' to be 'instagram'`; existing table `main action ... > linkNoBio` now pins the new label |
| **F2** untouched stored value blocks every save (7 profiles) | `screens/me/model.ts`: the rules live in `ruleFindings`; `validateDraft(d, profile)` keeps only fields in `buildDelta` (as the server validates only the delta); NEW `storedValueHints` / `STORED_VALUE_HINT` give an untouched failing value a calm note (website: "Add https:// at the start so this works as a link."). `fields.tsx` `Field` gains `note` (muted 14px `<p>`, no `role=alert`, no aria-invalid, hidden while an error shows); Edit passes it for display name, bio, Instagram, Facebook, website, WhatsApp | `F2 untouched` -> `expected <p id="website_url-error" ...> to be null`; `change only the first name` -> `expected true to be false` (Save stayed disabled); existing tables `dancerAppMeEdit > linkNoBio: Save disabled with the reason` -> received `Fix the fields marked above, then save.`, `dancerAppMeEditModel untouched ... > linkNoBio` red. The "edit the website to another bad value" test passed on d50046f too (that behaviour was already right; it pins it) |
| **F3** "Show my WhatsApp: On" with no number (166/167) | `EditScreen.tsx`: while the number field is empty the switch is `disabled`, `aria-describedby="whatsapp-switch-reason"`, with "Add your number above to show it on your page." It keeps its stored value; an untouched save sends nothing; typing a number enables it | `F3 ...` -> `expected false to be true` (switch not disabled) |

Test updates (signature only): `dancerAppReviewFixes.test.ts` S2/N8 pass a no-bio/no-link profile to `nextStepShort`;
`dancerAppMeEditModel.test.ts` main-action table compares with `nextStepFor`.

### CI per job (sandbox, on 4243bee; `git fetch origin main` first, origin/main = 4a63921)

| Job / step | Command | Exit / result |
|---|---|---|
| typecheck | `npm run typecheck` | 2: **96** `error TS` lines = the baseline the job compares against (none in dancer-app) |
| typecheck | `check:rpc-typing`; `check:wallclock-brand` | 0; 0 |
| integrity | `bash bin/check-integrity.sh`; `AUDIT_STRICT=1 npm run check:images`; `npm run prove:entry-point`; `lint:architecture` | 0 (1613 files); 0; 0 (43 entry points); 0 |
| dancer-area-isolation | `--self-test`; `npm run check:dancer-area-isolation` | 0 (55 cases); 0 |
| db-contract (no-secret) | `node scripts/check-migration-stamps.mjs` | 0 |
| unit | `NODE_PATH= TZ=Europe/London npm run test:unit:offline` | 0: 313 files, 8043 passed, 26 skipped (it rewrote the `tests/regression/today` + organiser `.snap` files again; restored, NOT committed) |
| unit timing | `NODE_PATH= TZ=Europe/London npm run test:unit:timing` | 0: 65 passed |
| dancer-app unit | `NODE_PATH= npx vitest run tests/client/dancerApp src/modules/dancer-app` | 0: 18 files, 782 passed |
| lint chain | `npm run lint` (run with `chmod +x bin/*.sh`, mode reverted before commit: 0 mode changes) | 0: 16/16 links |
| eslint (changed files) | `npx eslint src/modules/dancer-app <changed tests>` | 1 error, pre-existing: `EditScreen.tsx` "Cannot access refs during render" (`draftRef.current = draft`, S1 code, also 1 error on d50046f); 8 warnings |
| e2e-smoke | `CI=true npm run test:e2e` (includes all six dancer-app specs) | 0: 147 passed, 1 skipped, 1 flaky (`dancer-home.spec.ts:168` organiser /account/o, untouched spec, passed on retry) |
| phone-qa | `npx playwright test --config playwright.phone.config.ts` | 0: 174 passed, 64 skipped |
| perf-budget | 3 self-tests; `npm run build` (workflow env); `check:bundle-budget`; `check:first-load-requests`; `check:chunk-cycles` | 0,0,0; 0; 0; 0; 0 |
| review pack | `REVIEW_PACK_DIR=docs/review-pack/r1a npx playwright test tests/e2e/dancer-app/review-pack.spec.ts --project=chromium --workers=1` | first run 1 (cold-start: `welcome x new-stub` navigation timeout, 15 s); full re-run 0: 50 passed |

Perf: event route first-load (owner rule <= +0.5 KB gz vs main), perf-budget.yml env: this branch **376.4 KB / 47
files**, main 4a63921 379.8 KB / 47 files (measured by the previous worker on the same main commit; main has not
moved) = **-3.4 KB**, unchanged by F1-F3. Dancer-app route 357.7 KB / 58 chunks (was 357.2; budget 360, allowance 58):
`perf-budgets.json` not edited, its attribution baseline row still reads 357.2 (gate green; the orchestrator may
re-baseline).

Review pack: new `link-no-bio` shape (7 shots, 7 measurement rows, all 390/390, no control < 44px, primary on it); the
spec asserts Home/Me "Add a short bio towards 100%.", Edit's website note visible with no error, Save reason "Nothing
has changed yet...", the WhatsApp switch reason visible. Every other shot and row is byte-identical.

### Verified
- F1-F3 red on d50046f then green; every dancer-app table test runs `linkNoBio`; every CI step above.
- Edit x link-no-bio screenshot inspected: calm hint under the website, switch dimmed with its reason, Save off only
  for "Nothing has changed yet".

### Not verified
- Browser walk on the owner's real profile and `/code-review` (orchestrator, per the brief).
- Live-DB contract suites (`test:unit` with secrets), Lighthouse; real PR CI on 4243bee not read by this worker
  (`gh api` is off-limits); Vercel preview not checked.
- The hint copy for Instagram / Facebook / display name / bio / WhatsApp is my wording (only the website hint was
  given by the brief); the 2 Instagram and 1 Facebook prod values that fail the handle rule were not looked at.
- The F2 class covers the client; that the server validates ONLY the delta is taken from the brief, not re-read.
