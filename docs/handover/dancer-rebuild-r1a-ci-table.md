# R1a: every CI job step, run in the sandbox (full table)

Measured on 9b6fcee by a sub-agent. The three real reds it found (`check:images`, `prove:entry-point`, `check:dancer-area-isolation`) were fixed in 3e5fc13 and re-run there: all three exit 0. See `dancer-rebuild-r1a.md` for the summary.

# Local CI run: claude/dancer-app-r1a vs main (base 4a63921)

**Commit note.** I started on bf87602 as asked. At 06:44:55 a new commit, **9b6fcee** ("390x844 review pack (MOCKED RPCs)..."), landed on the branch while the run was going. It came from outside this run and touched 49 files, including the committed `docs/review-pack/r1a/*`. I re-ran every step that had first run before 06:45 (the guards, build, perf, typecheck, isolation and lint) in a clean detached worktree at 9b6fcee. Every step after 06:45 (unit offline, pre-ship, e2e, phone-qa) already ran on 9b6fcee. **The results below are for 9b6fcee** unless a row says otherwise.

Logs are in `.../scratchpad/ci/*.log`. The re-runs on 9b6fcee are in `.../scratchpad/ci/v2/*.log`.

| Workflow / job | Step command | Exit | Result | Same on main? |
|---|---|---|---|---|
| architecture-guard / integrity | `npm install -g npm@11`, `npm ci` | - | SKIPPED: node_modules is already installed | - |
| architecture-guard / integrity | `chmod +x bin/*.sh` | - | Not applied to the main tree: `bin/*.sh` is mode 100644 in git, on main too. The check ran via `bash`. In the clean worktree I did chmod. | same (644 on main) |
| architecture-guard / integrity | PyYAML ensure | 0 | present | - |
| architecture-guard / integrity | `bash bin/check-integrity.sh` (no exec bit, so run via bash) | 0 | ok (1602 files, 0 issues) | - |
| architecture-guard / integrity | `npm run check:legacy-tables` | 0 | ok | - |
| architecture-guard / integrity | `npm run check:legacy-program-rpcs` | 0 | ok | - |
| architecture-guard / integrity | `npm run lint:architecture` | 0 | ok | - |
| architecture-guard / integrity | `AUDIT_STRICT=1 npm run check:images` | **1** | **RED**: 2 `<img>` tags without a `loading` attribute: `src/modules/dancer-app/screens/me/ui.tsx:53` and `src/modules/dancer-app/screens/photo/PhotoScreen.tsx:329`. On bf87602 there were 3; `HomeScreen.tsx:69` has since been fixed. | **No**: main passes (exit 0). Introduced by this branch. |
| architecture-guard / integrity | `npm run check:image-widths:self-test` / `check:image-widths` | 0 / 0 | 49/49 ok; ok (53 calls) | - |
| architecture-guard / integrity | `npm run check:plan-hygiene:self-test` | 0 | PASS | - |
| architecture-guard / integrity | `check:workflow-artifact-policy:self-test` / `check:workflow-artifact-policy` | 0 / 0 | 393 cases PASS; ok (33 files, 48 jobs, 329 steps) | - |
| architecture-guard / integrity | `npm run check:mojibake:self-test` | 0 | 11 cases PASS | - |
| architecture-guard / integrity | mojibake `git grep` guard | 0 | clean | - |
| architecture-guard / integrity | `npm run prove:entry-point:self-test` | 0 | 54/54 PASS | - |
| architecture-guard / integrity | `npm run prove:entry-point` | **2** | **RED** (cannot run): "these files dispatch through isEntryPoint but are not in TARGETS ... `scripts/check-dancer-area-isolation.mjs`" | **No**: main passes (42 entry points). The new script is not registered in TARGETS in `scripts/prove-entry-point-dispatch.mjs`. |
| typecheck / wallclock-brand | `npm run check:rpc-typing` | 0 | ok | - |
| typecheck / wallclock-brand | `npm run check:wallclock-brand` | 0 | ok | - |
| unit-tests / unit (London, full) | `node scripts/ci-live-db-gate.mjs` (dry run as a PR: `--event pull_request --base origin/main --head HEAD`) | 0 | live=**true** (33 of 198 changed files are DB-facing), so CI runs `test:unit` with real secrets | - |
| unit-tests / unit (London, full) | `npm run test:unit` (inside pre-ship, on 9b6fcee) | 1 | 7913 passed, **15 failed**, 16 skipped. The 15 = 10 contract tests ("Invalid API key") + 5 in `integrityCouldNotRun` ("precondition gone"). On bf87602 directly: 7910 passed, the same 15 failed. | **Yes**: the same 15 fail on main (main-wt run of those 4 files: 15 failed / 71 passed) |
| unit-tests / unit (London, full) | `npm run test:unit:offline` (offline env as in CI) | 1 | 7898 passed, **5 failed** (all in `tests/integrityCouldNotRun.test.ts`), 16 skipped | **Yes**: same 5 fail on main |
| unit-tests / unit (London, full) | `npm run test:unit:timing` | 0 | 65 passed | - |
| unit-tests / unit (New_York) | `TZ=America/New_York npx vitest run --no-file-parallelism <9 files>` | 0 | 213 passed | - |
| unit-tests / unit (Sydney) | `TZ=Australia/Sydney npx vitest run ...` | 0 | 213 passed | - |
| unit-tests / dancer-area-isolation | `node scripts/check-dancer-area-isolation.mjs --self-test` | 0 | 55 cases OK | n/a (script is new on this branch) |
| unit-tests / dancer-area-isolation | `npm run check:dancer-area-isolation` (= `node scripts/check-dancer-area-isolation.mjs`), clean tree at 9b6fcee | **1** | **RED**: 46 violations of rule (a), "changed file is neither inside src/modules/dancer-app/, nor a test, nor a seam". The files: `src/modules/event-page/bento/BentoPage.tsx`, `playwright.config.ts`, plus 44 committed `docs/review-pack/r1a/*` (42 PNGs, `measurements.json`, `measurements.md`). On bf87602 (clean) there were 2 violations: BentoPage.tsx and playwright.config.ts. | n/a (script does not exist on main). Red is caused by the branch contents. |
| e2e-smoke | `npx playwright install --with-deps chromium` | - | SKIPPED: browsers already installed | - |
| e2e-smoke | `npm run test:e2e` (workflow env, no CI, so retries=0) | 1 | 144 passed, **2 failed**, 1 skipped. Both failures are in `dancer-home.spec.ts`: `:105` (Execution context was destroyed) and `:168` (URL not `/finish-profile?returnTo=...`) | See next row |
| e2e-smoke | `CI=true npm run test:e2e` (as in CI: retries=1) | 0 | 146 passed, 1 skipped, 0 flaky. Also, `dancer-home.spec.ts` alone x2 repeats: 28/28 passed | Flake under full-suite load; not reproducible |
| perf-budget / bundle-budget | `check:bundle-budget:self-test`, `check:first-load-requests:self-test`, `check:chunk-cycles:self-test` | 0/0/0 | 135 / 63 / 36 cases PASS | - |
| perf-budget / bundle-budget | `npm run build` (perf-budget placeholder env) | 0 | built | - |
| perf-budget / bundle-budget | `npm run check:bundle-budget` | 0 | all budgets respected | - |
| perf-budget / bundle-budget | `npm run check:first-load-requests` | 0 | 6/6 routes match their pin | - |
| perf-budget / bundle-budget | `npm run check:chunk-cycles` | 0 | 234 chunks, no cycle | - |
| perf-budget / lighthouse | `npm run check:lighthouse` | - | SKIPPED: needs the Vercel preview URL, GITHUB_TOKEN and the bypass secret | - |
| perf-budget / doc-weight | `npm run check:doc-weight` | - | SKIPPED: needs the live preview deploy and secrets | - |
| phone-qa / phone-qa (path filter matches src/**/*.tsx) | `npx playwright test --config playwright.phone.config.ts` (no CI, so retries=0) | 1 | 173 passed, **1 failed**, 64 skipped. Failure: `scroll-reset.phone.spec.ts:114 [phone-360x640]` /faq -> /organisers/ritmo-phone-qa, "the new page committed: expected not null, received null" | **Yes**: intermittent on main too. Re-run x3 on branch: 1 of 21 failed. On main x3: 2 of 21 failed. |
| phone-qa / build-smoke | `npm run build` (fake Supabase preload env) | 0 | built | - |
| phone-qa / build-smoke | `npx playwright test --config playwright.build.config.ts` | 0 | 3 passed | - |
| workflow-lint / bom-check | BOM loop (`xxd` is missing in the sandbox, so used `od`) | 0 | No BOMs | - |
| workflow-lint / masking-check | `node scripts/lint-workflow-masking.mjs` | 0 | ok (33 files) | - |
| workflow-lint / notification-check | `lint-workflow-notification.mjs --self-test` / plain | 0 / 0 | 19 cases PASS; ok | - |
| db-contract-check / live-db-gate | `ci-live-db-gate.mjs --self-test` / plain | 0 / 0 | PASS; live (event unknown locally, true as a PR) | - |
| db-contract-check / contract-check | `node scripts/check-migration-stamps.mjs` | 0 | ok | - |
| db-contract-check / contract-check | offline steps: `check-guest-list-contract --self-test`, `check-day-rollover-consistency-v1`, `check-script-conventions --self-test` and plain | 0 (all) | ok | - |
| db-contract-check / contract-check | `--self-test` halves: added-session-room, festival-detail-span, upcoming-event-cover, occurrence-delete-booking-safety, program-day-offsets, og-scrape-evidence, og-render-health, event-truth-v1, image-refs-live | 0 (all 9) | PASS | - |
| db-contract-check / contract-check | `precheck-supabase-secrets` and the ~45 live `check-*.mjs` DB checks | - | SKIPPED: need the VITE_SUPABASE_* secrets and the live prod DB | - |
| ci-budget-guard / canary (push path filter: package.json) | `node scripts/check-ci-budget.mjs --self-test` | 0 | PASS | - |
| ci-budget-guard / measure | - | - | SKIPPED: job `if` is false on a non-main push; it also needs a secret and `gh api` | - |
| deployment-storage-check / canary (package.json) | `check-deployment-storage.mjs --self-test` | 0 | PASS | - |
| deployment-storage-check / measure | - | - | SKIPPED: `if` is false on a non-main push; needs VERCEL_TOKEN | - |
| firewall-drift-check / canary (package.json) | `check-firewall-drift.mjs --self-test`; `apply-firewall.mjs --self-test` | 0 / 0 | PASS | - |
| firewall-drift-check / measure | - | - | SKIPPED: `if` is false on a non-main push; needs VERCEL_TOKEN | - |
| og-image-check / og-preview | `npm run check:og:self-test` | 0 | PASS | - |
| og-image-check / og-preview | `resolve-preview-url.mjs`, `npm run check:og` | - | SKIPPED: needs GITHUB_TOKEN, the live preview deploy and the bypass secret | - |
| seo-check / seo-preview | `npm run check:seo:self-test` | 0 | PASS | - |
| seo-check / seo-preview | resolve preview, `npm run check:seo` | - | SKIPPED: live preview deploy and secrets | - |
| synthetic-ssr-monitor / synthetic-preview | `npm run synthetic:ssr` | - | SKIPPED: live preview deploy and secrets | - |
| phone-qa-section | `check-pr-phone-qa.mjs --self-test` | 0 | PASS | - |
| phone-qa-section | `check-pr-phone-qa.mjs` | - | SKIPPED: needs the PR body and the changed-file list from GitHub context | - |
| real-data-verified | `check-pr-real-data-verified.mjs` | - | SKIPPED: needs the PR body (GitHub context) | - |
| bot-pr / open-pr | curl to the GitHub API | - | SKIPPED: secret and GitHub writes | - |
| bot-automerge (pull_request_target) / dependabot-automerge | - | - | SKIPPED: GitHub context and `gh`; job conditions do not apply | - |
| types-drift (PR path filter: types.ts) | - | - | Not triggered (types.ts unchanged) | - |
| (requested) | `npm run build` (plain) | 0 | built | - |
| (requested) | `npm run typecheck` | 2 | **96** `error TS` lines; baseline is 106, so the gate is GREEN | - |
| (requested) | `npm run lint` in the main tree | 1 | 15 of 16 links pass. `check:integrity` exits 126 ("Permission denied": the bin script has no exec bit), so eslint is skipped | Yes: same mode on main (environment cause) |
| (requested) | `npm run lint` in a clean worktree after `chmod +x bin/*.sh` | 0 | 16 of 16 links green. eslint shows as WARN, which is informational | - |
| (requested) | `npm run pre-ship` | 1 | Did not refuse on any git, receipt or review-stamp precondition. Result: FAILED, with 2 FAIL links. `check:integrity` failed with exit 126 (exec bit). `test:unit` failed on the same 15 known reds. Everything else passed: build:ship, bundle-budget, first-load-requests, chunk-cycles, typecheck (96 of 106), scoped eslint (held level, 1 pre-existing), test:unit:timing. `test:e2e` was skipped because the repo-only checks failed; it was run separately above. Scope-drift WARN is advisory. | Both reds are environmental or reproduce on main |

## Reds explained

1. **`check:images` (AUDIT_STRICT=1), real branch defect.** Two new dancer-app `<img>` tags have no `loading` attribute: `screens/me/ui.tsx:53` and `screens/photo/PhotoScreen.tsx:329`. Main is green. This would fail the architecture-guard `integrity` job in CI.
2. **`prove:entry-point`, exit 2, real branch defect.** The new `scripts/check-dancer-area-isolation.mjs` dispatches through `isEntryPoint`, but nobody added it to TARGETS in `scripts/prove-entry-point-dispatch.mjs`. Main is green. This would fail the architecture-guard `integrity` job.
3. **`check:dancer-area-isolation`, real red caused by branch contents.** On the clean 9b6fcee tree, rule (a) flags 46 files. `BentoPage.tsx` and `playwright.config.ts` are outside the allowed area/seam lists, and 9b6fcee also committed 44 `docs/review-pack/r1a/*` files. This would fail the unit-tests `dancer-area-isolation` job. The script is new, so there is no comparison on main.
4. **Contract tests (10 failures across `eventViewCompat`, `occurrenceProgram` and `publicEventPageLineup` `.contract.test.ts`).** They fail with "Invalid API key" because the sandbox has no DB credentials. They fail identically on main. In CI the live-db gate says live=true for this PR, so they will run against real secrets there.
5. **`tests/integrityCouldNotRun.test.ts` (5 failures).** The error is "typescript resolved in the temp repo -- precondition gone", a sandbox-environment issue. They fail identically on main.
6. **`check:integrity` exit 126 inside `npm run lint` and `pre-ship`.** `bin/check-integrity.sh` is mode 100644 in git, on main too. CI does `chmod +x` first. With the exec bit set, it passes.
7. **e2e `dancer-home.spec.ts` :105 and :168.** These failed only in the first full run without retries. They passed in the CI-mode run (retries=1, 0 flaky) and in two isolated repeats. This is a load-related flake.
8. **phone-qa `scroll-reset.phone.spec.ts:114` [360x640].** Intermittent: 1 of 21 failed on the branch, 2 of 21 on main. This flake already exists on main. CI's retries=1 normally absorbs it.

## Side effects in the working tree

- The e2e run was not clean. Specs `tests/e2e/dancer-app/{photo,options,onboarding,home-nights}.spec.ts` write screenshots into tracked `docs/handover/dancer-rebuild-w2*`. As a result the main tree now shows `M` on 3 PNGs (`w2a/namecity-4-photo.png`, `w2d/3-preview.png`, `w2d/7-offline.png`) and untracked `docs/handover/dancer-rebuild-w2b/` and `w2e/`. I left them as they are. Do not commit them: they would also add isolation violations.
- `build/` was last produced by the phone-qa build-smoke build, which used the fake-Supabase env.
- Temporary worktree `/home/user/branch-wt` was removed. `/home/user/main-wt` was left in place.
