# Brief: Dancer Rebuild W1 foundation (shell, theme, gate, api, seams 1-4) -- PR B1a sub-branch

Repo `123constante/bachata-website` (PUBLIC: no secret or email in any commit). Model Opus 5.5.
NEVER run `gh api` in this repo (it waits on an approval prompt forever); read other branches with
`git fetch origin <branch>` + `git show FETCH_HEAD:<path>`. Read `briefs/dancer-rebuild-COMMON.md` and
`briefs/dancer-rebuild-INTERFACE.md` (ALL of it; section 5 is yours to build) on
`arc/briefs-dancer-rebuild` FIRST, then the plan change table, sections 1, 2.2, 4.1, 4.3, 6 and
Appendix A. BRANCH: `arc/dancer-app-w1`, created FROM `main`. Push only this branch. Do NOT open a PR:
the orchestrator merges you with R0 (`arc/dancer-app-r0`, owns `tests/regression/today/**`,
`scripts/check-dancer-area-isolation.mjs`, `.github/workflows/unit-tests.yml`) into `claude/dancer-app-r1a`
(PR B1a), and wave 2 (five screen workers) starts from that tip. YOU PUSH FIRST: wave 2 is blocked on
you, so keep the scope exactly this and push as soon as it is green.

## Files you OWN
- `src/modules/dancer-app/**` EXCEPT `screens/**` (wave 2 owns the screens; you create `screens/` with
  one placeholder component per route that renders the route name inside the shell, so every route is
  reachable and the reachability test passes; wave 2 replaces the placeholders).
- Seams 1-4 exactly as INTERFACE section 5 lists them: `src/components/AnimatedRoutes.tsx`,
  `src/components/AppChrome.tsx`, `src/lib/profileCompletion.ts` (+ `ProfileCompletionChrome.tsx` only if
  strictly needed), `src/components/catchallClientPaths.ts` + `tests/catchallClientPaths.test.ts`,
  `public/robots.txt`, `package.json` (`test:e2e` spec list only, if the new e2e spec must be listed),
  `perf-budgets.json` (one row for the `dancer-app` lazy chunk), `src/lib/analytics.ts` (new
  `AnalyticsEventMap` entries only).
- `tests/client/dancerApp*.test.tsx`, `tests/e2e/dancer-app/reachability.spec.ts` (Playwright, mocked
  gate), `src/modules/dancer-app/README.md` (the folder contract for wave 2: what to import from where).
- `docs/handover/dancer-rebuild-w1.md`: YOUR handover.
Protected files (INTERFACE section 5) are NEVER touched. If you believe one must change, stop that part,
write why in the handover's "INTERFACE deviations", and continue.

## Build (INTERFACE section 5 is the spec; the mockups v8 are the look: logo "Bachata Calendar"
## top-left tapping to "/", "Events" top-right, bottom tabs Home / Nights / Me / Options, dancer theme
## plum/coral as one CSS custom-property set scoped to [data-profile="dancer"]; bold gradient cards
## style is wave 2's job, you ship the tokens)
1. `shell/`: `DancerAppShell.tsx` (header + bottom tabs + `<Outlet/>`; 44px targets; safe-area insets;
   the active tab from the location; profile-type label "Dancer"), `DancerAppRoutes.tsx` (the route table
   from INTERFACE; `/app` -> `/app/home`), `renderInShell.tsx` test util (router + auth + gate + fake
   backend providers in one call, used by every wave-2 test).
2. `theme/`: `dancer.css` + `tokens.ts`; contrast of every token pair measured (WCAG AA, numbers in the
   handover); the sheet is imported by the shell only (never globally).
3. `gate/`: `useDancerArea.ts` and `RedirectIfAllowed.tsx` per the INTERFACE contract. `RedirectIfAllowed`
   imports the organiser-type check from `src/pages/Account.tsx` (or the helper it uses) and NEVER copies
   it; if that check is not exported, export it from the module that owns it ONLY if that module is a
   seam; otherwise import the same underlying helper `Account.tsx` imports. Fail CLOSED on error and on
   `loading` render today's element.
4. `api/`: `rpc.ts` (wrappers via `rpcLoose`; names and shapes from INTERFACE section 3), `types.ts`,
   `errors.ts` (ONE map from every INTERFACE error code to copy; exported `copyFor(code)`),
   `fakeBackend.ts` (in-memory implementation of the four wrappers holding EVERY plan section-3 shape as a
   named fixture, with `saveMyDancerProfile` honouring diff-first semantics and raising the same codes so
   wave 2 tests mirror the server), `setFakeBackend()` used by `renderInShell`.
5. `analytics/events.ts` + the `AnalyticsEventMap` entries; a helper `trackDancerEvent(name, props)` that
   is a no-op when signed out (test it).
6. Seams: `/app/*` lazy chunk in `AnimatedRoutes.tsx` (one `lazyWithRetry` import, chunk name
   `dancer-app`); `RedirectIfAllowed` around the `/account`, `/account/dancer` and `/finish-profile`
   ELEMENTS; `AppChrome.tsx` hides GlobalHeader / BottomNav / footer / spacers on `/app/*` (keep
   `ProfileCompletionChrome` mounted: it carries `ProfileGateContext`); `BANNER_HIDDEN_ON += '/app'`;
   catchall paths + its test; robots `Disallow: /app/`; a `<meta name="robots" content="noindex">` on
   every `/app` route (via the existing head helper the pages use); perf-budgets row.
7. Tests (table-driven, red-first where bug-shaped): reachability (every route renders inside the shell
   for an allowed complete person; `/app` redirects); gate matrix (signed-out: NO request made, bounced
   to today's `/auth` by `AuthGuard`; signed-in closed+unlisted: `/app/home` bounced to `/account`;
   listed: in; open: in; error: bounced; organiser-type listed: `/account` still goes to `/account/o`);
   `RedirectIfAllowed` matrix incl. incomplete -> `/app/welcome`; banner hidden on `/app/*`; chrome hidden
   on `/app/*` and present elsewhere; `errors.ts` covers every code (a test that fails when a code is
   added to `types.ts` without copy); `fakeBackend` diff-first (untouched save returns without mutation);
   catchall list == route literals. The Playwright reachability spec runs against the dev server with
   the gate mocked at the network layer (`page.route` on the RPC URL).

## Gates (per-job table in the handover)
Unit (Node 22, the repo's runner), lint chain, typecheck, `npm run build` (production; report the
`dancer-app` chunk size and that first-load did not grow: perf-budget check), `npm run test:e2e:smoke`
if the sandbox can run Playwright (else the exact command + NOT RUN reason), the `integrity` job
(`check:images` with `AUDIT_STRICT=1`, `prove-entry-point-dispatch`), `npm run pre-ship`, every
applicable job in `.github/workflows/*.yml`, and R0's isolation check if `arc/dancer-app-r0` has pushed
by the time you finish (`git fetch origin arc/dancer-app-r0` and run the script from FETCH_HEAD).

## Failures this brief exists to prevent
A first-load request for signed-out visitors (assert zero gate fetches in the signed-out test and in the
Playwright spec's network log); the reminder banner rendering over the shell; an organiser-type person
redirected to `/app`; a gate that fails OPEN; a second copy of the organiser check; the dancer theme
leaking into the main site (scope selector test); a route not in the catchall list (the existing test
catches it: keep it green).

## Done means
Everything above green, README for wave 2, handover (decisions, INTERFACE deviations, contrast numbers,
chunk size, CI table, Verified / Not verified incl. "390x844 walk: placeholders only; wave 2 walks the
screens"). Commit, push ONCE with `[worker-done <ticket>]`, report head SHA. Stop after the push.
