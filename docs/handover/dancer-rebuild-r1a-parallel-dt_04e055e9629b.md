# Handover: Dancer Rebuild R1a integration (Website, `claude/dancer-app-r1a`)

Briefs: `briefs/dancer-rebuild-r1a-integration.md` (steps 1-8) and `briefs/dancer-rebuild-r1a-finish.md`
(branch `arc/briefs-dancer-rebuild`). The integration worker did steps 1-5 and 7 and stopped without a
handover at 9b6fcee; the finish worker (this doc) did step 6, the perf proof and step 8.

## Done, by integration step

| Step | Commit | What |
|---|---|---|
| 1 merge W2b | c399bd7 | `arc/dancer-app-w2b` @ 0a435d7e merged. Only conflict: `package.json` `test:e2e` (see below). |
| 1 merge W2e | 70cde48 | `arc/dancer-app-w2e` @ ed2dfa22 merged. Only conflict: `package.json` `test:e2e`. |
| 2 + 3 | de31b90 | Four per-screen `useMyDancerEdit` copies (W2a onboarding, W2b home, W2c me, W2d photo) and Options' inline query deleted; one hook in `api/useMyDancerEdit.ts`, key `['my-dancer-edit', userId]`; per-screen options kept (Home staleTime 60s; Onboarding refetchOnMount always, no retry). `renderInShell` mounts `CityProvider` (W2b ask) + jsdom ResizeObserver stub. Base reds: `reminderBanner.today` R0 rows for `/app`, `/app/home` flipped to hidden (the snapshot was wrong: W1's `/app` seam is owner-specified), `/apps` prefix-guard row added; Edit client refusals read `copyFor()`; two today tests' eslint `react-hooks` globals errors fixed. |
| 4 perf | c9cb300 | Event route grew +0.7 KB gz with the dancer app (level-rating modules cut into a shared chunk): over the 0.5 KB line, so `DerivedLevelBadge` + `LevelRatingPrompt` are now lazy in `BentoPage`. dancer-app rows raised (310 -> 360 KB, 41 -> 57 chunks) with justification in `perf-budgets.json`. Numbers re-measured below. |
| 5 sandbox sign-in | bf87602 | `organiserFake` stores the session under `sb-<ref>-auth-token` with `<ref>` read from `VITE_SUPABASE_URL`; `playwright.config.ts` webServer defaults `VITE_ENABLE_ORGANISER_SELF_SERVE='true'` like `e2e-smoke.yml`; dates from the fake's frozen clock; reachability mocks `my_dancer_edit_v1`; photo spec asserts own-prefix delete and the legacy-foreign-URL no-delete case. Edit city picker 48px, Options "Account settings" link 44px. |
| 7 review pack | 9b6fcee | `docs/review-pack/r1a/` 42 shots (7 screens x 6 shapes) + `measurements.md`, MOCKED RPCs. Nights links 44px. Avatar falls back to the initial on a blocked image (prod survey: 2 rows on a host outside `app/csp.ts` img-src); `tests/client/dancerAppAvatar.test.tsx` red on the unfixed code. |
| 6 CI per job | this commit | Full sweep below; three real r1a-only reds found and fixed (next section). |
| 8 handover | this commit | This file. |

### Merge conflict resolutions (step 1)

Both merges conflicted ONLY in `package.json` `test:e2e`. Resolution each time: the UNION of both sides' spec lists.
After W2b: `...reachability, onboarding, home-nights`. After W2e: also `me-edit` (W2c) and `photo` (W2d), which
the orchestrator's server-side W2c/W2d merges had not kept, plus `options` (W2e). Final dancer-app list:
reachability, onboarding, home-nights, me-edit, photo, options. No shell file conflicted.

## Fixes made by the finish worker (step 6 found them; each red on 9b6fcee, green after)

1. `architecture-guard` / Image-attribute audit (`AUDIT_STRICT=1 npm run check:images`): exit 1, "missing loading: 2":
   `screens/me/ui.tsx:53` (Avatar) and `screens/photo/PhotoScreen.tsx:329` (preview). Both now `loading="eager"`
   (above the fold, the screen's subject). After: missing loading 0, exit 0.
2. `architecture-guard` / Entry-point dispatch proof (`npm run prove:entry-point`): exit 2, "dispatch through
   isEntryPoint but are not in TARGETS: scripts/check-dancer-area-isolation.mjs" (R0's script, never registered).
   Added to TARGETS. After: 43 entry points proven, exit 0.
3. `unit-tests` / Dancer-area isolation check: exit 1, 51 violations on 9b6fcee: 44 x `docs/review-pack/r1a/*`
   (step 7 output), `src/modules/event-page/bento/BentoPage.tsx` (step 4's lazy split), `playwright.config.ts`
   (step 5), plus 5 x `bin/*.sh` that are only the sandbox `chmod +x` (git mode unchanged; CI's isolation job does
   not chmod). The first three were ORDERED by the integration brief, so RULES now allow them: `docs/review-pack/`
   joins DOC_PREFIXES; BentoPage, playwright.config.ts and `scripts/prove-entry-point-dispatch.mjs` (fix 2) join
   SEAMS with a comment naming the brief step. After: "dancer-area isolation: OK", self-test 55 cases, exit 0.
   **Owner question 1** below: INTERFACE section 5 should say the same.

## Per-job table (sandbox, every `run:` step of the PR-triggered workflows that can run without secrets)

"main" = `origin/main` @ 4a63921 in a worktree, same commands, same machine. "9b6fcee" = branch head before this
worker; "final" = this commit.

| Job (workflow) | Command | main | 9b6fcee | final | Counts / note |
|---|---|---|---|---|---|
| architecture-guard | `chmod +x bin/*.sh` | 0 | 0 | 0 | |
| architecture-guard | `bin/check-integrity.sh` | 0 | 0 | 0 | |
| architecture-guard | `npm run check:legacy-tables` | 0 | 0 | 0 | |
| architecture-guard | `npm run check:legacy-program-rpcs` | 0 | 0 | 0 | |
| architecture-guard | `npm run lint:architecture` | 0 | 0 | 0 | |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 | **1** | 0 | 89 img; missing loading 2 -> 0 (fix 1) |
| architecture-guard | `check:image-widths:self-test` + `check:image-widths` | 0 | 0 | 0 | |
| architecture-guard | `check:plan-hygiene:self-test` | 0 | 0 | 0 | |
| architecture-guard | `check:workflow-artifact-policy` (self-test + guard) | 0 | 0 | 0 | |
| architecture-guard | `check:mojibake:self-test` | 0 | 0 | 0 | |
| architecture-guard | mojibake `git grep` | 0 | 0 | 0 | no hits |
| architecture-guard | `prove:entry-point:self-test` + `prove:entry-point` | 0 | **2** | 0 | self-test 54/54; 43 entry points (fix 2) |
| typecheck | `npm run check:rpc-typing` | 0 | 0 | 0 | |
| typecheck | `npm run check:wallclock-brand` | 0 | 0 | 0 | |
| unit-tests (London) | `node scripts/ci-live-db-gate.mjs` | 0 | 0 | 0 | sandbox event "unknown" -> RUN; see Not verified |
| unit-tests (London) | `TZ=Europe/London npm run test:unit:offline` | 1 | 1 | 0 | see below |
| unit-tests (London) | `npm run test:unit:timing` | 0 | 0 | 0 | |
| unit-tests (New_York) | tz-sensitive `vitest --no-file-parallelism` list | 0 | 0 | 0 | |
| unit-tests (Sydney) | same list | 0 | 0 | 0 | |
| unit-tests / dancer-area-isolation | `check-dancer-area-isolation.mjs --self-test` | n/a | 0 | 0 | 55 cases (script not on main) |
| unit-tests / dancer-area-isolation | `npm run check:dancer-area-isolation` | n/a | **1** | 0 | 51 violations -> OK (fix 3) |
| workflow-lint | `lint-workflow-masking.mjs` | 0 | 0 | 0 | |
| workflow-lint | `lint-workflow-notification.mjs` (self-test + lint) | 0 | 0 | 0 | |
| db-contract-check | `check-migration-stamps.mjs` | 0 | 0 | 0 | other steps need prod secrets: not run |
| perf-budget | 3 canaries | 0 | 0 | 0 | |
| perf-budget | `npm run build` (placeholder Supabase env, as the workflow) | 0 | 0 | 0 | production build |
| perf-budget | `npm run check:bundle-budget` | 0 | 0 | 0 | |
| perf-budget | `npm run check:first-load-requests` | 0 | 0 | 0 | |
| perf-budget | `npm run check:chunk-cycles` | 0 | 0 | 0 | |
| e2e-smoke | `npm run test:e2e` (CI=1, workflow env) | - | - | 0 | 143 passed, 1 skipped, 3 flaky-on-retry (auth-magic-link-returnto, dancer-home x2: legacy specs, run overlapped the main unit sweep); the 6 dancer-app specs = 45 tests, all first-try green |
| phone-qa | `playwright test --config playwright.phone.config.ts` | - | - | 0 | 174 passed |
| phone-qa (build smoke) | `npm run build` (fake Supabase preload) + `playwright.build.config.ts` | - | - | 0 / 0 | 3 passed |
| (local lint chain) | `npm run lint` | 0 | 0 | 0 (16 of 16 links; trailing eslint informational) | needs `chmod +x bin/*.sh` in the sandbox (git mode is 100644 on main too); passes after |

`test:unit:offline`, the only remaining red, is IDENTICAL on main and r1a and is the sandbox, not code:
- 9b6fcee: 1 file / 5 tests failed (all `tests/integrityCouldNotRun.test.ts`), 7888 passed, 26 skipped.
- main: the same 5 `integrityCouldNotRun` tests, plus `SurnameSwitchReachable` and `eventTruth.matrix` (timeouts
  while my e2e run shared the CPU; both re-run green on main, 479/479, and are green on r1a).
- Cause: the sandbox sets `NODE_PATH=/usr/local/lib/node_modules_global`, so a global typescript resolves in the
  test's temp repo ("typescript resolved in the temp repo -- precondition gone"). With `NODE_PATH=` the file
  passes 67/67 (14 skipped). CI runners have no such NODE_PATH.
- final (with `NODE_PATH=`): 309 files passed, 7903 tests passed, 16 skipped, 0 failed, exit 0.

## Perf: event-route first-load (same command: workflow build env + `npm run check:bundle-budget`, gzip)

| Tree | Event `/event/:id` first-load | Files |
|---|---|---|
| main 4a63921 | 379.8 KB gz | 47 |
| r1a before c9cb300 (integration worker's measure) | 380.4 KB gz (+0.7) | 48 |
| r1a 9b6fcee | 376.4 KB gz (**-3.4 KB vs main**) | 47 |
| r1a final | 376.4 KB gz (unchanged; the fixes touch no event code) | 47 |

The owner rule (raise dancer-app rows only if the event route grows <= 0.5 KB gz) holds: the event route
SHRANK 3.4 KB, chunk ratchet 47/47, puller ratchet 2/2. dancer-app: 355.4 KB gz / 57 chunks, budget 360.
The bundle-budget run notes "NO baseline row for dancer-app" in `attribution.baseline.routes`: informational,
not gating; a baseline row is an owner/orchestrator call at merge.

## Verified

- Every PR-triggered job step above that runs without secrets, on this head, exit codes as tabled.
- All 6 dancer-app e2e specs (45 tests) green first try at 390-wide fakes; full `test:e2e` gate exit 0.
- Production build (perf-budget env and phone-qa fake env) both exit 0; build smoke 3/3.
- The integrityCouldNotRun red is environmental (proved with `NODE_PATH=`), identical on main.

## Not verified

- Live-DB contract suites (`npm run test:unit` with prod secrets; `db-contract-check` steps beyond
  migration-stamps; `types-drift`): no Supabase secrets in the sandbox. The gate decides per-PR paths in CI.
- Lighthouse / doc-weight (`perf-budget` PR job 2), `live-qa`, `prod-smoke`, `seo-check`, `og-image-check`,
  `synthetic-ssr-monitor`: need a deployed preview. No Vercel token used.
- `phone-qa-section`, `real-data-verified`: read a PR body; no PR exists (none opened, per brief).
- GitHub Actions on the branch: not read (no `gh api`).
- Review pack is MOCKED RPCs, not a real signed-in walk on prod data; no browser walk with a real account.
- No `/code-review` round ran on the finish worker's three fixes.

## Open owner questions

1. **INTERFACE section 5 vs RULES.** `scripts/check-dancer-area-isolation.mjs` now also allows `docs/review-pack/`,
   `BentoPage.tsx`, `playwright.config.ts` and `scripts/prove-entry-point-dispatch.mjs` (all from the integration
   brief's own steps). The script says INTERFACE section 5 is the source of truth; please add them there (or say
   which to revert: BentoPage reverting re-breaks the 0.5 KB event rule).
2. **Terms / Privacy pages do not exist** (W2a + W2e). The onboarding consent line is text-only and the Options
   Terms/Privacy row is disabled with a reason. Need the pages (or URLs) before public launch.
3. dancer-app baseline row in `perf-budgets.json` `attribution.baseline.routes`: add at merge?

## Next steps

PR from `claude/dancer-app-r1a` to main (orchestrator/owner; workers do not open it), then the CI the sandbox
could not run (live-DB, preview-deploy jobs) and `/code-review` before merge.
