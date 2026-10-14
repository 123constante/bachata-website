# Brief: hide the public /videographers page

Repo: 123constante/bachata-website (deploys to PRODUCTION on merge to main). ONE branch, push once. Never merge or approve. The orchestrator opens the PR as the bot (your GH_BOT_TOKEN resolves to the owner), so push the branch only and write `.git/pr-body.md`.

## Why
Owner decision 2026-10-13: "We are not ready for videographers yet." Today `/videographers` is a public routed page (`src/pages/Videographers.tsx`) that shows "No Videographers Yet" (prod has 2 rows, 0 active), it is in the sitemap (`app/routes/sitemap.tsx`), has SEO config (`src/lib/seo/buildSeoForRoute.ts`) and breadcrumb config (`src/lib/breadcrumbs/siteIa.ts`). Nobody can sign up as one: `src/pages/CreateVideographerProfile.tsx` is not routed.

## Do
1. One exported constant (for example `VIDEOGRAPHERS_PUBLIC_ENABLED = false`, in a small module such as `src/lib/featureFlags` if that is the existing pattern, else next to the route table). When false: `/videographers` renders the site's normal not-found page (HTTP-level 404 only if the framework build already does that for unknown routes; do not invent a new mechanism), it is removed from the sitemap, from the SEO map used for indexing and from any nav, footer, search directory or internal link (grep `videographers` across `src`, `app`, `public`, `scripts`; list every hit and what you did). The copy in the directory SEO description that names videographers may drop the word.
2. Keep all page code and the data query so flipping the constant back restores everything; do not delete files. Do not touch the DB, `src/integrations/supabase/types.ts`, or lineup/event-page display of people already credited as videographers on events (that is existing event content, leave it).
3. Tests, table-driven: route resolves to not-found when the flag is false and to the page when true; sitemap entries exclude `/videographers` when false; no navigation target points at `/videographers` when false (extend the existing "navigate targets routable" style test). Run the new tests against the UNFIXED code first and show them fail.
4. Gates: `npm run build`, `check:bundle-budget` (NO budget raised: the change should shrink or not move first-load), tsc error set equal to main, `npm run lint`, `npm run test:unit:offline` (`env -u NODE_PATH`, placeholder `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`). Prerendered routes: check whether `/videographers` is prerendered or listed in a first-load request pin or perf-budget route table and keep those checks consistent.
5. `.git/pr-body.md` MUST contain: `## Summary`; `## Phone QA` with the exact lines `- Sizes checked:` (name a size such as 390x844, say honestly if not reached), `- Walked:`, `- Not verified:`; `## Verified on real data` with the exact lines `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` all inside that section; an `Effect on requests reaching Vercel` section. Check with `PR_BODY="$(cat .git/pr-body.md)" node scripts/check-pr-real-data-verified.mjs` and `PR_FILES="<changed paths>" PR_BODY="$(cat .git/pr-body.md)" node scripts/check-pr-phone-qa.mjs`.

## Boundaries
Push only your branch. No new dependencies. Stop after the push and report.

## Final report (under 600 chars)
Branch + head sha, every `/videographers` reference found and handled, bundle numbers moved (should be none or smaller), gate results, NOT verified.
