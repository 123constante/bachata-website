# Handover: vercel-cpu-cuts-web

Branch `claude/vercel-cpu-cuts-web` (from `origin/main` 4bde699). Ticket dt_b1830f2dd875.
Full detail: `docs/ops/vercel-cpu-cuts-2026-11-04.md`.

## Landed (all three slices)
- **Slice 1** `/api/og/card`: healthy 200 adds `Vercel-CDN-Cache-Control: public, s-maxage=31536000, stale-while-revalidate=604800` (knob `EDGE_CACHE_OK`). Every outcome pinned in `app/routes/api.og.card.test.tsx` (red first: 5 healthy rows failed on main).
- **Slice 2** `/city/:slug`: tests only (`app/routes/home.headers.test.ts`, 36 rows incl. Cookie/Authorization = anonymous). **No code change** — nothing proven.
- **Slice 3** unknown-path 404: `edge404` carried gate → finaliser; `Vercel-CDN-Cache-Control: public, s-maxage=300`, browser `no-store`, noindex, no tag, no cookie (knob `EDGE_404`). Pinned in `app/catchallGate.test.ts` (red first: 7 failed on main). Slice 3b not done (no path list supplied).

## Untouched (as the brief requires)
`/event/:id`, `/organisers/:id`, `/api/revalidate`, `/api/og/bake`, `/api/io-health`, purge path (`cloudflarePurge.ts`, `cacheTags.ts`, workflows), `edgeCacheControl.ts`, `staticShellCacheHeaders`, `catchall.tsx` (still loader-free), `vercel.json`, calendar files. Sign-in shell (`/auth`, `/auth/callback`, `/account*`, `/finish-profile`) pinned 200-shell-identical. Note: `/profile` and `/onboarding` from the brief are NOT app paths (unknown 404s).

## Owner step (relay)
Cloudflare Cache Rule `OG cards`: `starts_with(http.request.uri.path, "/api/og/card")`, GET/HEAD, eligible, respect origin Cache-Control, status 200 capped at 7 days, query string included in full, placed above the HTML rule, applies to bots. Exact text in the ops doc, "Owner steps".

## Not verified
Live BEFORE survey (sandbox gets proxy 403 on production and api.vercel.com — orchestrator's 2026-11-04 measurements used instead); local prod-build smoke against real data; production behaviour after deploy; Cloudflare behaviour; UK vantage; 24 h Active CPU; real `s-maxage` at three times of day for `/city/london-gb`; whether Vercel still strips `s-maxage` from the card's client `Cache-Control` once the CDN directive is present (review finding 1).

## Next
- Queue `/event/:id` (biggest absolute cost) after its time bound + purge gaps.
- Queue: move `tests/seoSoft404Matrix.test.ts` to `gateCatchallOutcome`, drop the wrapper; root-loader-free guard.
- No `pr-body.mjs` exists in `scripts/` (the brief names it); PR body must be set by hand / orchestrator.
