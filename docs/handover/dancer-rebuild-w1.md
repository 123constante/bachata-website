# Handover: Dancer Rebuild W1 foundation (branch `arc/dancer-app-w1`)

Status: **scope BUILT, gates PARTLY run; NOT marked worker-done.** Stopped at the owner's
cloud context gate (30%). A continuation session runs the remaining gates (list at the
bottom) and then pushes the `[worker-done dt_b350f0aa2a48]` commit. No PR (the
orchestrator merges this sub-branch with R0 into `claude/dancer-app-r1a`).

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

## Decisions and INTERFACE deviations

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
152 live dancer_profiles; 15 with a dance role; 97 photo; 91 city; 17 auth users; dance_role CHECK = NULL | Leader | Follower | Lead and Follow; the four new RPCs are NOT on prod yet (0 of 4), so today the real gate read errors -> fails closed. All 18 plan section-3 shapes are fixtures in `api/fixtures.ts`.

## Red-first proof (mutants / unfixed code, then restored)
- AppChrome + profileCompletion seams stashed: `dancerAppChrome.test.tsx` 8 failed, e.g. "AppChrome on /app/* > /app/home: no site header, bottom nav, footer or spacers", "the reminder banner > is hidden on /app".
- `useDancerArea` `enabled: signedIn` -> `true`: 3 failed, "RedirectIfAllowed ... > /account > signed out: today's page, NO gate request" (x3 pages).
- `DancerAreaGate` fail-open mutant: 1 failed, "gate matrix on /app/home > gate error (every attempt fails): fails CLOSED to /account".
- `catchallClientPaths.ts` stashed: 2 failed, "has exactly the <Route path> literals, minus \"*\"", "answers every dancer-app path and nothing else under /app".

## Contrast (WCAG 2.x, measured by tests/client/dancerAppTheme.test.ts)
text/bg 17.22; text/surface 15.62; text/surface-2 13.36; muted/bg 10.96; muted/surface 9.93; muted/surface-2 8.50; accent/bg 7.28; accent/surface 6.60; on-accent/accent 7.28; plum/bg 7.67; plum/surface 6.95; danger/bg 9.09; danger/surface 8.24; on-gradient/gradient-from 9.48; on-gradient/gradient-to 5.18; focus/bg 12.09 (min 3). Border/bg 1.88 is decorative (not a text pair).

## Chunk size / perf
`dancer-app` chunk: 3.8 KB raw / 1.6 KB gz JS + 0.9 KB gz CSS; `AllowedRedirect` 0.8 KB gz. Bare `npm run build` + `npm run check:bundle-budget`: exit 0, "All first-load JS budgets respected". Auth (catchall) first load 290.5 -> 291.3 KB, same 33 files (AnimatedRoutes 4.0 -> 4.7, root 12.2 -> 12.3); every other route unchanged. New row dancer-app 296.8 KB / 41 chunks / 3 pullers (budget 310).

## CI per-job table (sandbox, Node 22.22.0)
| Job / step | Command | Exit | Result |
|---|---|---|---|
| unit (baseline, untouched main) | `npx vitest run --exclude "**/*EdgeTtl.test.ts"` | 1 | 15 failed / 6898 passed in 4 files, ALL pre-existing on main: 3 `*.contract.test.ts` (live DB/network) + `integrityCouldNotRun.test.ts` (sandbox). Orchestrator saw 44 in 7; environment. |
| unit (new + touched) | `npx vitest run tests/client/dancerApp* tests/catchallClientPaths.test.ts` | 0 | 237 passed |
| unit (full, branch) | `npm run test:unit` | NOT RUN | context gate |
| typecheck (touched files) | `npx tsc -p tsconfig.app.json --noEmit` filtered to touched files | 0 errors in touched files | repo has many pre-existing errors; typecheck.yml gates only the two guards below |
| rpc typing | `npm run check:rpc-typing` | 0 | passed |
| wallclock brand | `npm run check:wallclock-brand` | NOT RUN | |
| build | `npm run build` | 0 | built |
| perf-budget | `npm run check:bundle-budget` | 0 | all budgets respected |
| first-load requests | `npm run check:first-load-requests` | NOT RUN | |
| e2e | `npx playwright test tests/e2e/dancer-app/reachability.spec.ts --project=chromium` (e2e-smoke env) | 0 | 14 passed (first cold-server run: 12 passed, 2 timed out; both passed alone and in the full re-run) |
| e2e full gate | `npm run test:e2e` | NOT RUN | |
| lint chain | `npm run lint` | NOT RUN | |
| integrity | `check:images` (AUDIT_STRICT=1), `prove-entry-point-dispatch` | NOT RUN | |
| pre-ship | `npm run pre-ship` | NOT RUN | |
| R0 isolation | `scripts/check-dancer-area-isolation.mjs` from `arc/dancer-app-r0` | NOT RUN | |
| Vercel | - | NOT RUN | not attempted |

## 390x844 walk
Placeholders only (Playwright at 390x844, screenshots `test-results/dancer-app-*.png`, not committed): shell, tabs and header render, no control under 44px, no horizontal scroll. Wave 2 walks the screens.

## Verified / Not verified
Verified: every route reachable inside the shell for an allowed person; `/app` -> `/app/home`; gate matrix (signed-out = zero gate requests in unit AND browser network log; closed+unlisted / error -> `/account`; listed / open -> in); RedirectIfAllowed matrix incl. incomplete -> `/app/welcome`, organiser / open request / legacy link / failed reads stay; chrome hidden on `/app/*` and present elsewhere; banner hidden on `/app`; theme scoped (every selector tested) and AA; every error code has copy; fake backend diff-first; catchall list == route table; production build + budgets.
Not verified: full unit suite on the branch, lint chain, integrity job, pre-ship, wallclock guard, first-load-requests guard, full `test:e2e`, R0 isolation check, real gate RPC (not on prod), real phone.

## What is left (continuation session)
1. `npm run test:unit` (compare with the 15 pre-existing failures above), `npm run lint`, `npm run check:wallclock-brand`, `npm run check:first-load-requests`, `AUDIT_STRICT=1 npm run check:images`, `prove-entry-point-dispatch` (see the integrity job in `.github/workflows`), `npm run pre-ship`, `npm run test:e2e`, R0's isolation script if `arc/dancer-app-r0` has pushed.
2. Fix anything red on this branch, update this table, then commit with subject ending `[worker-done dt_b350f0aa2a48]` and push `arc/dancer-app-w1`.
