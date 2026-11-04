# Brief: independent review of Website PR #1362 (Vercel CPU cuts: og card, city pin tests, unknown-path 404 edge cache), one round

Brief-version: 2
Lane: careful
Model: Sonnet
Tier: review worker. You change NO product code and never approve or merge. You write one report file and push it to `claude/review-1362-r1` (a review branch: no PR is opened for it).

Final commit subject ends `[worker-done <ticket>]`. Under 30% context. One round: report findings, do not fix them.

## What main lacks
- an independent review of PR #1362 head bfe86ef (branch claude/vercel-cpu-cuts-web) covering the three risks below, with mutants run, not opinions -- docs/review/1362-r1.md

## Do
Read the PR diff (`git fetch origin claude/vercel-cpu-cuts-web`, `git diff origin/main...FETCH_HEAD`), `docs/ops/vercel-cpu-cuts-2026-11-04.md` and `docs/handover/vercel-cpu-cuts-web.md` on that branch.
1. Unknown-path 404 edge cache (slice 3): prove with tests, not reading, that `Vercel-CDN-Cache-Control` is set ONLY for the catchall `unknown` verdict. Try to break it: a real page route that falls through to catchall, a legacy-city path, a city subpath, a loader-thrown 404, 503/5xx, a path with a query string, a request carrying a cookie or Authorization header, a path that later becomes valid (an organiser or event created after a 404 was cached: how long can the 404 show for a real new page? 300 s: say whether that is acceptable and what purge covers it, or if the cache tag logic means a new page is blocked longer). It must never carry Set-Cookie (the `__vdpl` cookie) or a cache tag.
2. OG card (slice 1): the one-year `s-maxage` is keyed on `v=` (cover version). Prove or refute with a test that a title, date or venue edit with an unchanged cover leaves a stale card for up to a year, and whether Cloudflare caching (owner step) makes that worse. State whether the PR is safe to merge as is (flag off or knob), or needs a cache key change first.
3. Mutants: for each knob and each header assertion in the new tests (`app/routes/api.og.card.test.tsx`, `app/catchallGate.test.ts`, `app/routes/home.headers.test.ts`) flip or delete the production line and show a test goes red. List every mutant that survives.
4. Real-data check: with the repo's own fixtures only (no production access from the sandbox), list which real URL shapes from production CPU data were NOT exercised (city slugs, event ids, scanner paths like /wp-login.php, /.env, /robots.txt, /favicon.ico, /sitemap.xml: make sure real static files and SEO files never get the 404 treatment).
5. Verdict per slice: PASS / PASS-with-fixes / BLOCK, numbered findings with file:line, and the exact test or mutant that proves each. Write it to docs/review/1362-r1.md.

## Files
docs/review/1362-r1.md
