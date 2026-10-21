# Brief: og-media-host (Website fix, urgent but small)

Branch `claude/og-media-host` (off `main`). Repo 123constante/bachata-website (public; deploys on push
to main via Vercel). Model: Opus. Plan: author + independent review (+ one fix pass if needed).
A continuation, if any, reads `docs/handover-og-media-host.md` on this branch.

## The failure (found by the orchestrator on prod, 2026-10-21 ~13:50Z)
Since 12:05Z, links to event pages shared on WhatsApp/Facebook show NO picture.
- Admin migration 20261129670000 (merged #904) moved every stored media URL from
  `pub-07f606224cac4f2596903c44df723644.r2.dev` to `media.bachatacalendar.co.uk` (same R2 bucket).
  That includes `og_render.image_url` (the pre-baked 1200x630 share cards, 372 rows ready).
- `sameHostImage()` in `app/detailLoader.ts:318` and its copy in `middleware.ts:155` rewrite ANY host
  matching `/(^|\.)bachatacalendar\.co\.uk$/i` onto the request host. Before, baked cards were on r2.dev
  (not rewritten). Now `media.bachatacalendar.co.uk/events/og/...` becomes
  `www.bachatacalendar.co.uk/events/og/...`, which is a 404.
- Measured: `curl -A "WhatsApp/2.23" https://www.bachatacalendar.co.uk/event/el-grande` gives
  og:image `https://www.bachatacalendar.co.uk/events/og/event/01173937-...-46b1f42d630c.jpg` -> 404;
  the same path on `https://media.bachatacalendar.co.uk/` -> 200 image/jpeg.

## Do exactly this
1. In BOTH places, only move a URL onto the request host when its hostname is the site itself:
   the request hostname, `bachatacalendar.co.uk` or `www.bachatacalendar.co.uk`. Any other subdomain
   (`media.`) is returned unchanged. Prefer ONE shared helper if middleware can import it (check the
   Edge middleware bundle constraints; if it cannot, keep two copies and add a test that pins they agree).
   Keep the existing comment's reason (crawlers need the host they fetched for SITE pages) and add one
   line saying why the media host is excluded.
2. Search the whole repo (app/, src/, middleware.ts, api routes such as `app/routes/api.og.*`,
   scripts/) for any OTHER host check that treats `*.bachatacalendar.co.uk` as "our site" and would now
   mis-handle `media.` URLs (same-origin checks, image proxy allow-lists, CSP, `/_vercel/image`
   domains in vercel.json, SSRF guards in api.og.card / api.og.bake). List each in the PR: fine / fixed.
3. Tests, RED FIRST: a unit test that feeds a `https://media.bachatacalendar.co.uk/events/og/...jpg`
   baked URL through the og:image path (resolveOgCardImage with a stubbed RPC, and the middleware
   function) and expects it unchanged; plus `https://bachatacalendar.co.uk/x.jpg` and the www form are
   still moved to the request host. Show it failing on main, passing after.
4. `npm run build` must pass; run every CI job step from .github/workflows in your sandbox (command +
   exit code table). This repo is public, so its Actions are free and should also run.

## PR body must have
What changed (before/after in plain words), the failure above, red-first output, the host-check sweep
list, `Effect on requests reaching Vercel` (this changes which host crawlers fetch share images from:
media host = R2 directly, not Vercel), per-job CI table, Verified / Not verified.
Title: `fix(og): keep share images on the media host so link previews show a picture`.

## Boundaries
- Read and push with PLAIN git; never `gh api`. Commands without variables/loops/`$(...)` where a plain
  one works.
- Push ONCE at the end (each push costs a Vercel build). PARTIAL push only at the 30% context limit.
- Open the PR with `gh pr create` using GH_BOT_TOKEN; never the GitHub MCP create tool.
- Supabase prod is READ-ONLY. Never merge or approve, never `--no-verify`.
- Other workers own `claude/ended-event-cls` (PR #913: app/routes/event.tsx, MoreEventsSection) and
  `claude/review-ended-event-cls`. Do not touch those files.

## Output
Write `docs/handover-og-media-host.md` (done / left / next). Stop after the push and report.
