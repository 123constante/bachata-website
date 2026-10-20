# Brief: fix React hydration error #421 on /event/* (Website)

Repo: 123constante/bachata-website. Your branch: claude/hydration-421-fix (create from main). One slice, ONE push at the end (plus a PARTIAL push if you hit 30% context). Stop after the push and report. Do not open a merge, do not approve. Open a bot-authored PR only if your dispatch prompt says so.

## Read first
Findings from the finished investigation (read with plain git, never gh api):
`git fetch origin claude/hydration-421-trace` then `git show origin/claude/hydration-421-trace:docs/handover-hydration-421.md`. Read all of it, including the measurements.

## Owner decisions (already made, do not re-ask)
1. Use the "B + C" fix, NOT static imports. Keep the page-size budget (`npm run check:bundle-budget` must stay green; do not edit perf-budgets.json).
   - B: in `src/modules/event-page/bento/BentoPage.tsx` wrap each of the two lazy `<Suspense>` slots (RSVP; level-rating/derived-level badge) in a `React.memo` component (`RsvpSlot`, `LevelSlot`) that takes only primitive or referentially stable props and builds `snapshotQueryKey` and the badge element inside.
   - C: fire the three `import()` calls (RsvpBlock, LevelRatingPrompt, DerivedLevelBadge) at BentoPage module scope as a warm-up, the same pattern as `FestivalDetail` in `src/pages/EventPage.tsx` ("Pre-hydration chunk warm-up").
2. Add the regression test described in the findings: `tests/e2e/event-hydration-421.spec.ts` (Playwright, production build, 390x844, CDP CPU throttle 4x, 1000 ms `page.route` delay on lazy `/assets/*.js` chunks). Assert no console message matches `/Minified React error #4(18|21|23|25)|\[hydration\]/`. Run it on an ongoing and an ended event. ADD IT BY NAME to the `test:e2e` script list. Prove it fails on unfixed main first (red-first), then passes with the fix. B+C will not reach zero on a 1 s delay, so set the assertion at the level the fix reliably achieves and say in the PR which delay/CPU setting you used and the pass rate over 5 runs. If B+C cannot get a reliable green, STOP, push what you have as PARTIAL, and write what you measured; do not switch to static imports or edit the budget on your own.
3. Unit-level guard too if cheap: in the shape of `src/hooks/__tests__/useAuthHydration.test.tsx` (renderToString, hydrateRoot with the lazy factory pending, non-transition parent setState, resolve, assert onRecoverableError not called).

## Pinned: files you own
BentoPage.tsx, the new e2e spec, the new unit test, the `test:e2e` script line in package.json. Touch nothing else.

## Gates (CI without paying GitHub)
Read `.github/workflows` and run EVERY CI job step yourself in your sandbox; put per-job results with command and exit code in the PR body and a handover doc `docs/handover-hydration-421-fix.md` on your branch. GitHub Actions may be refused for billing: that is not a code failure. Run `npm run build` (a production build), not only the dev server.
Setup notes from the investigation: the container pre-sets `VITE_SUPABASE_URL` to a TEST project that makes every /event/<slug> 404; pass the prod URL and public anon key (Supabase MCP get_project_url / get_publishable_keys) on the command line. Server-side fetch needs `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`. Event for testing: `/event/ronald-alba-halloween-edition-sensual-vibes`, ended one `/event/the-camden-tuesdays`.

## Worker rules
Read and push with PLAIN git (fetch, show, push); never `gh api`. Write shell commands without variables, loops or `$(...)` where a plain command works. Supabase is read-only. Never `--no-verify`. Check the RSVP placeholder and level card at 390x844 for flicker before and after. Last push commit subject ends with `[worker-done dt_<your ticket>]`; if you must stop early, `PARTIAL [worker-done ...]` plus a handover (done / left / exact next steps). Stop at 30% context.

## Output
PR body with: before/after #421 counts (5 runs per setting), the Verified / Not verified block, per-job CI table. Say plainly what a sandbox cannot verify (real phone, real network, Vercel).
