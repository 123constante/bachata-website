# Handover: Dancer Rebuild W1 foundation (branch `arc/dancer-app-w1`)

Status: **COMPLETE.** Built by the first W1 session (stopped at its context gate, commit
`2794f07`); finished by the W1-finish session (brief `briefs/dancer-rebuild-w1-finish.md`,
ticket dt_7d024420e330): Round-2 error map, R6 save wrapper, every gate run and tabled.
No PR (the orchestrator merges this sub-branch with R0 into `claude/dancer-app-r1a`).

## What changed (files)

New, `src/modules/dancer-app/` (folder contract for wave 2: `src/modules/dancer-app/README.md`):
- `dancer-app.tsx` lazy chunk entry (emits `assets/dancer-app-*.js`).
- `shell/` `routes.ts` (the one route table), `DancerAppRoutes.tsx` (AuthGuard -> gate -> shell; `/app` and unknown `/app/x` -> `/app/home`; noindex via `useNoindexMeta`), `DancerAppShell.tsx` (logo "Bachata Calendar" -> `/`, "Dancer" label, "Events" -> `/`, tabs Home/Nights/Me/Options, 44px targets, safe-area insets), `PlaceholderScreen.tsx`, `renderInShell.tsx` + `testAuth.ts` (test util).
- `theme/` `dancer.css` (one custom-property set scoped to `[data-profile="dancer"]`, imported by the shell only), `tokens.ts`.
- `gate/` `useDancerArea.ts`, `RedirectIfAllowed.tsx` (eager, small), `AllowedRedirect.tsx` (lazy organiser half), `redirectModel.ts`, `DancerAreaGate.tsx`.
- `api/` `types.ts`, `errors.ts` (`copyFor`, `DancerApiError`), `rpc.ts` (four wrappers), `gateRpc.ts` (backend slot + raw gate read), `delta.ts` (`diffDelta`), `fakeBackend.ts`, `fixtures.ts` (all 18 plan section-3 shapes).
- `analytics/events.ts` (`trackDancerEvent`, no-op when signed out).
- `screens/{onboarding,home,nights,me,edit,photo,options}/<Name>Screen.tsx` placeholders.

Seams (INTERFACE section 5, items 1-4 only):
1. `src/components/AnimatedRoutes.tsx`: `<Route path="/app/*">` -> one `lazyWithRetry` import; `RedirectIfAllowed` around the `/account`, `/account/dancer`, `/finish-profile` ELEMENTS; Routes key shared by every `/app` URL so the shell stays mounted across tabs.
2. `src/components/AppChrome.tsx`: GlobalHeader, header spacer, footer, bottom spacer, BottomNav hidden on `/app`, `/app/*` (case-folded); `ProfileCompletionChrome` stays mounted.
3. `src/lib/profileCompletion.ts`: `BANNER_HIDDEN_ON` += `/app`, `/app/*`. `ProfileCompletionChrome.tsx` NOT touched.
4. `src/components/catchallClientPaths.ts` (+8 concrete `/app` paths) + `tests/catchallClientPaths.test.ts` (splat expanded from the route table; `/app/not-a-screen` stays a 404); `public/robots.txt` `Disallow: /app/`; `package.json` `test:e2e` += the new spec; `perf-budgets.json` (dancer-app row + auth puller 3 -> 2, reasons in the `//dancer-app-2026-10-15` note); `src/lib/analytics.ts` six `AnalyticsEventMap` entries.

Tests: `tests/client/dancerAppShell.test.tsx` (91), `dancerAppApi.test.tsx` (91), `dancerAppTheme.test.ts` (35), `dancerAppChrome.test.tsx` (17), `tests/e2e/dancer-app/reachability.spec.ts` (14).
Protected files: none touched.

W1-finish session (this round):
- `api/types.ts` `DANCER_ERROR_CODES`: every gate + member code in INTERFACE "Round-2 additions" (22 + `unknown`); added `profile_mismatch`, `invalid_payload`, `invalid_type`, `invalid_text`, `invalid_whatsapp`, `invalid_list`.
- `api/errors.ts`: copy for every code; `FIELD_LABEL` (plain words for every save key) + `DETAIL_COPY`: when the DB's DETAIL names a field (`unknown_key`, `invalid_type`, `invalid_text`, `invalid_handle`, `invalid_url`, `invalid_list`) the copy names it and `DancerApiError.field` points at it; `copyFor(code, detail?)`, `fieldFor(code, detail?)`, `DancerApiError.detail`; PostgreSQL `permission denied for function ...` (42501) -> `not_signed_in` (signed-out copy).
- `api/rpc.ts`: the error path passes PostgREST's `details` through; `saveMyDancerProfile` drops `whatsapp` / `show_whatsapp_publicly` when `other_roles` is empty (`dropWhatsappIfNotAllowed`, exported); with no `current` and a WhatsApp key in the delta it reads `my_dancer_edit_v1` first; a delta emptied by the drop sends nothing.
- `api/fakeBackend.ts`: refuses the mere PRESENCE of a WhatsApp key from a pure dancer (before the diff, like the DB); sends DETAIL for `unknown_key`, `invalid_handle`, `invalid_url`.
- `shell/renderInShell.tsx`: `location()` reads the probe from the DOM instead of a module variable written during render (eslint `react-hooks/globals` error; pre-ship's scoped eslint gates it).
- `tests/client/dancerAppApi.test.tsx`: Round-2 code list, per-code wire test, 15 DETAIL cases, permission-denied case, fake presence cases, R6 block; the `fetchGate` arg assertion fixed (was red on the branch head: the wrapper calls `rpcLoose(fn)` with one argument).
- `src/modules/dancer-app/README.md`: pass `current` to saves; `copyFor(code, detail)`.
- Deleted `docs/session-handover-2026-10-15-dancer-w1.md` (the first session's context-gate note; superseded by this file, and R0's isolation check refuses docs outside `docs/handover/`).

## Decisions and INTERFACE deviations

Decisions (W1-finish, made without asking):
- Admin-only codes (`admin_only`, `invalid_email`, `invalid_note`, `invalid_argument`) are NOT in the Website map: the brief's list names gate/admin `area_closed`, `not_signed_in` only, and no Website wrapper calls an admin RPC (the admin repo's Beta-access screen owns those).
- `permission denied for function` maps to the `not_signed_in` code (one copy, one mapping) rather than a separate code.
- R6 when the caller gives no `current`: read the profile first rather than send keys the DB would refuse (one extra request only when a WhatsApp key is present). Screens should pass `current` (README says so).
- A DETAIL that is not a save key is ignored (plain copy, default field).


Decisions (made without asking):
- Organiser check: `AllowedRedirect` imports `accountHome` (lib/accountRouting) + `fetchOrganiserHome` / `fetchMyAccessRequests` + their query keys (selfServeApi), the exact helpers `Account.tsx` imports. Account.tsx's 3-line query adapter `settled` is module-private (protected file), so `redirectModel.queryFact` restates THAT adapter (not the organiser rule).
- Redirect fails closed beyond the gate: a failed or loading organiser read, a loading/unknown profile fact, `no_profile` and `error` all stay on today's page (today's Finish screen owns the message-us / Try-again paths).
- `RedirectIfAllowed` always renders today's page and adds the lazy redirect as a sibling, so a slow decision never blanks the screen.
- `/app` chunk named via the entry file name (`dancer-app.tsx`); vite config untouched.
- Error copy for `unknown_key` and a generic `unknown` added (save contract + network failures).
- `trackDancerEvent(name, props)` reads a signed-in identity the shell publishes in a layout effect (set before any screen effect fires; cleared on unmount / sign-out).
- `saveMyDancerProfile(delta, current?)`: an empty delta with `current` returns it without a request.
- e2e: `npm run test:e2e:smoke` does not exist; the gate is `npm run test:e2e` (e2e-smoke.yml).
- Mockups v8 are not in the repo; the look follows the brief's words (plum / coral).

INTERFACE deviations:
- `useDancerArea` calls `api/gateRpc.fetchGateRaw` (same RPC, same fake-backend slot, same fail-closed rule) instead of `rpc.fetchGate`, because the eager `RedirectIfAllowed` puts this hook in the catchall's every-route `AnimatedRoutes` chunk and `rpc.ts` + `errors.ts` cost +2.6 KB gz there (measured 4.0 -> 6.6 KB). With gateRpc: 4.0 -> 4.7 KB. `rpc.fetchGate` (with the error map) still exists for everyone else.
- `RedirectIfAllowed` lives in the AnimatedRoutes chunk (eager import), and its organiser half is a second small lazy chunk (`AllowedRedirect-*.js`, 0.8 KB gz), not inside `dancer-app`.

## Shapes surveyed (prod, read-only, counts only, 2026-10-15)
W1-finish, for R6 (dancer_profiles x claimed x active other profile type (not dancing / guest_dancer) x WhatsApp set): unclaimed+no other type+no WhatsApp 30; unclaimed+other type+no WhatsApp 132; claimed+other type+no WhatsApp 4; claimed+other type+WhatsApp 1. No claimed pure dancer exists yet (every new signup will be one): fixtures `fourFieldComplete` (pure) and `teacherWithWhatsapp` cover both sides of the rule.
First session:
152 live dancer_profiles; 15 with a dance role; 97 photo; 91 city; 17 auth users; dance_role CHECK = NULL | Leader | Follower | Lead and Follow; the four new RPCs are NOT on prod yet (0 of 4), so today the real gate read errors -> fails closed. All 18 plan section-3 shapes are fixtures in `api/fixtures.ts`.

## Red-first proof (mutants / unfixed code, then restored)
W1-finish, new tests run against the UNFIXED wrapper / fake (commit `2794f07` code): 7 failed / 92 passed.
- "R6 ... > pure dancer + current: sends the rest WITHOUT whatsapp / show_whatsapp_publicly": `AssertionError: expected "spy" to be called with arguments: [ 'save_my_dancer_profile_v2', ...(1) ]`
- "R6 ... > pure dancer + current: a delta of ONLY WhatsApp keys sends nothing and returns current": `promise rejected "DancerApiError: Something went wrong. ..." instead of resolving`
- "R6 ... > pure dancer, no current given: reads my_dancer_edit first, then saves without the keys": `expected [ 'save_my_dancer_profile_v2' ] to deeply equal [ 'my_dancer_edit_v1', ...(1) ]`
- "R6 ... > through the fake (refuses like the DB): a pure dancer save with a WhatsApp key still succeeds": failed (whatsapp_not_allowed)
- "fakeBackend ... > fake: a pure dancer sending an unchanged null number / an unchanged switch is refused whatsapp_not_allowed": `promise resolved "{ ...(28) }" instead of rejecting` (x2)
- plus the pre-existing branch red "fetchGate calls dancer_area_gate_v1 and parses {open, allowed}" (also red with the new tests stashed: 1 failed / 90 passed), fixed in the test.
- Error map: the per-code and DETAIL tables fail on the old map by construction (the 6 new codes had no copy -> TypeScript error + `unknown` fallthrough).
After the fix: `tests/client/dancerApp* tests/catchallClientPaths.test.ts` 290 passed.
First session:
- AppChrome + profileCompletion seams stashed: `dancerAppChrome.test.tsx` 8 failed, e.g. "AppChrome on /app/* > /app/home: no site header, bottom nav, footer or spacers", "the reminder banner > is hidden on /app".
- `useDancerArea` `enabled: signedIn` -> `true`: 3 failed, "RedirectIfAllowed ... > /account > signed out: today's page, NO gate request" (x3 pages).
- `DancerAreaGate` fail-open mutant: 1 failed, "gate matrix on /app/home > gate error (every attempt fails): fails CLOSED to /account".
- `catchallClientPaths.ts` stashed: 2 failed, "has exactly the <Route path> literals, minus \"*\"", "answers every dancer-app path and nothing else under /app".

## Contrast (WCAG 2.x, measured by tests/client/dancerAppTheme.test.ts)
text/bg 17.22; text/surface 15.62; text/surface-2 13.36; muted/bg 10.96; muted/surface 9.93; muted/surface-2 8.50; accent/bg 7.28; accent/surface 6.60; on-accent/accent 7.28; plum/bg 7.67; plum/surface 6.95; danger/bg 9.09; danger/surface 8.24; on-gradient/gradient-from 9.48; on-gradient/gradient-to 5.18; focus/bg 12.09 (min 3). Border/bg 1.88 is decorative (not a text pair).

## Chunk size / perf
`dancer-app` chunk: 3.8 KB raw / 1.6 KB gz JS + 0.9 KB gz CSS; `AllowedRedirect` 0.8 KB gz. Bare `npm run build` + `npm run check:bundle-budget`: exit 0, "All first-load JS budgets respected". Auth (catchall) first load 290.5 -> 291.3 KB, same 33 files (AnimatedRoutes 4.0 -> 4.7, root 12.2 -> 12.3); every other route unchanged. New row dancer-app 296.8 KB / 41 chunks / 3 pullers (budget 310).

## CI per-job table (sandbox, Node 22, W1-finish run on the final tree)
| Workflow / job | Step | Exit | Result |
|---|---|---|---|
| unit-tests / unit | `npm run test:unit` (branch) | 1 | 15 failed / 7186 passed / 26 skipped, 4 files: 3 `*.contract.test.ts` (live DB/network) + `integrityCouldNotRun.test.ts` |
| unit-tests / unit | same on clean `origin/main` 4a63921 (worktree) | 1 | the SAME 15 in the SAME 4 files: environment, none new |
| unit-tests / unit | `test:unit:timing` (EdgeTtl, via pre-ship) | 0 | passed |
| unit (new + touched) | `npx vitest run tests/client/dancerApp* tests/catchallClientPaths.test.ts` | 0 | 290 passed |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0, 0 | passed |
| typecheck (pre-ship ratchet) | tsc count | 0 | 96 errors, below baseline 106; none in dancer-app files |
| architecture-guard / integrity | `bin/check-integrity.sh` (after the job's `chmod +x bin/*.sh`; modes restored after) | 0 | 1535 files, 0 issues |
| architecture-guard / integrity | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0,0,0 | passed |
| architecture-guard / integrity | `AUDIT_STRICT=1 npm run check:images` | 0 | passed |
| architecture-guard / integrity | `check:image-widths:self-test`, `check:image-widths` | 0,0 | passed |
| architecture-guard / integrity | `check:plan-hygiene:self-test` | 0 | passed |
| architecture-guard / integrity | `check:workflow-artifact-policy:self-test` + guard | 0,0 | passed |
| architecture-guard / integrity | `check:mojibake:self-test` + the git-grep guard | 0,0 | passed |
| architecture-guard / integrity | `prove:entry-point:self-test`, `prove:entry-point` | 0,0 | passed |
| perf-budget | 3 canaries (bundle, first-load requests, chunk cycles) | 0,0,0 | passed |
| perf-budget | `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0,0,0,0 | all budgets respected |
| perf-budget / lighthouse | `check:lighthouse`, `check:doc-weight` | NOT RUN | needs a deployed preview |
| lint chain | `npm run lint` | 0 | 16 links green; trailing whole-tree eslint informational (red on main) |
| eslint (scoped, pre-ship) | touched files | 0 | 0 errors (after the renderInShell fix) |
| pre-ship | `npm run pre-ship` | 1 | every link green EXCEPT `test:unit` (the 15 environment reds above), so it SKIPS its e2e link; e2e run separately below |
| e2e-smoke | `npm run test:e2e` (the job's env) | 0 | 114 passed, 1 skipped, 1 flaky: `dancer-home.spec.ts` "unfinished organiser hitting /account/o" timed out on the cold server, passed on retry; then `--repeat-each=3 --retries=0` on that spec: 42/42 passed. `/account/o` is not a wrapped element |
| workflow-lint | BOM check (n/a: no workflow changed), `lint-workflow-masking`, notification self-test + guard | 0,0,0 | passed |
| db-contract-check | `check-migration-stamps`, `check-script-conventions` (+self-test) | 0,0,0 | passed; the live-DB contract steps need Supabase secrets: NOT RUN (no DB path changed) |
| R0 isolation | R0's `scripts/check-dancer-area-isolation.mjs` from `origin/arc/dancer-app-r0` (temp copy, driven with `root` = this checkout) | 0 | "dancer-area isolation: OK", 45 changed files, 26 protected files byte-identical; its `--self-test` 55 cases behave. First run was 1 (the stray session-handover doc), fixed by deleting it |
| pre-commit hook | `scripts/check-source-integrity.cjs` (hook not executable in the sandbox, run by hand) | 0 | 0 corrupted |
| real-data-verified, phone-qa-section | PR-body checks | n/a | no PR on this sub-branch (orchestrator's PR B1a carries them) |
| Vercel | - | NOT RUN | sub-branch, no PR / preview required; token present, not used |

## 390x844 walk
Placeholders only (Playwright at 390x844, screenshots `test-results/dancer-app-*.png`, not committed): shell, tabs and header render, no control under 44px, no horizontal scroll. Wave 2 walks the screens.

## Verified / Not verified
Verified: every route reachable inside the shell for an allowed person; `/app` -> `/app/home`; gate matrix (signed-out = zero gate requests in unit AND browser network log; closed+unlisted / error -> `/account`; listed / open -> in); RedirectIfAllowed matrix incl. incomplete -> `/app/welcome`, organiser / open request / legacy link / failed reads stay; chrome hidden on `/app/*` and present elsewhere; banner hidden on `/app`; theme scoped and AA; every Round-2 code reaches its own copy through the real wrapper (none falls to the generic sentence), DETAIL fields named; R6 drop (red-first) and the fake's presence refusal; fake diff-first; catchall list == route table; production build + budgets + first-load requests; full unit suite (no new reds vs main); lint chain; integrity job; full `test:e2e`; R0 isolation.
Not verified: the real RPCs (A1 not on prod: 0 of 4 functions; the gate fails closed today), so the exact DB wording of DETAIL / `permission denied` is from the INTERFACE text, not a live call; Lighthouse / doc-weight (needs a preview); live-DB contract checks (secrets); pre-ship as a single green run (blocked by the 15 environment reds); real phone; screens (placeholders; wave 2 walks them).

## What is left
Nothing in W1 scope. For the orchestrator: merge with R0 into `claude/dancer-app-r1a`; when A1 is on E2E, one live call per code to confirm the DETAIL / `permission denied` wording matches `codeFromMessage`.
