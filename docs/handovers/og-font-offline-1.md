# Handover: og-font-offline-1 (OG cards render with no network for fonts)

Brief: `brief/og-font-offline-1:docs/briefs/og-font-offline-1.md`. Branch `claude/og-font-offline-1`. PR #1350.

## Done
1. **Fonts need no network.** `app/lib/ogCardRender.ts` imports the two Inter .ttf
   files as `./x.ttf?bytes`. The `?bytes` loader is `vite.fileBytes.ts`, registered
   in BOTH `vite.config.ts` and `vitest.config.ts`. It bakes the bytes into the
   SERVER bundle as base64. `materializeFont` decodes them, checks the TrueType magic,
   and writes them to `tmpdir()` (temp name + rename, so the write is atomic, and the
   name carries a content hash). There is no `fetch` for fonts. A plugin was needed
   because Vite's built-in `?inline` returns a file PATH under vitest, so a test could
   never have exercised the shipped decode path.
   - Red first: `tests/ogFontOffline.test.ts` (4 cases). Global fetch always rejects,
     and both cards are rendered for real. On main it fails 4/4; on this branch it
     passes 4/4.
   - Built bundle: both fonts are found in `build/server/.../server-build-*.js` only.
     A grep of all of `build/client` finds 0 matches, and the two `.ttf` client
     assets are gone. Every `check:bundle-budget` route stayed within budget: home
     207.4/215 KB, event 375.3/381, auth 293.9/310, dancer-app 372.4/374, parties
     266.9/325, classes 267.0/325, faq 233.0/245, landing prose 233.2/245, landing
     style 232.2/245. The chunk ratchets and request pins are unchanged.
   - Walked the BUILT server bundle (`createRequestHandler`) with every non-Supabase
     fetch failing. `/api/og/card` returned an inline 1200x630 JPEG with zero font
     fetches, where main would have thrown and redirected (render-error).
2. **Cover fetch**: `fetchImageBytes` waits at most 2.5s for headers per attempt and
   has a 5s deadline for the whole call, which is the same worst case as the old
   single 5s timeout, so a slow but healthy large flyer still has the full window. It
   retries ONCE (after 150ms) on a throw or a 5xx. It does not retry a 4xx, a redirect
   or an oversized body. It cancels the body of a non-ok response. A final failure
   still produces the branded `cover-unfetchable` card. The table-driven test
   `tests/ogCoverFetchRetry.test.ts` covers: ok, times out once then ok, times out
   twice, no cover url, the retry-policy rows, and the shared deadline.
3. **render-error 302 is `Cache-Control: no-store`** (it was `public, max-age=300`).
   The `X-OG-Fallback` markers are unchanged. `tests/ogCardFallbackMarker.test.ts` is
   updated.

## Left / for the owner
- **Root cause is environmental, not in this repo.** The Vercel log shows a
  ConnectTimeoutError from a Vercel function to 172.67.133.176:443, which is the
  Cloudflare address of www.bachatacalendar.co.uk. Something on the Vercel -> Cloudflare
  path (a Cloudflare WAF/bot rule or rate limit on Vercel egress IPs, or a Cloudflare
  incident) was stalling connects. I changed nothing in Cloudflare or Vercel (brief
  item 5). It is worth checking the Cloudflare Security Events for blocks or challenges
  on Vercel's IP ranges around 2026-11-04 14:00Z. The cover host
  (media.bachatacalendar.co.uk) is on the same edge, so covers can still fail in the
  same way. They now degrade to the branded card instead of the generic one.
- Review notes I deliberately did not act on:
  - (a) `cover-unfetchable` stays in the 1h SLOW tier. A transient cover blip now pins
    a coverless branded card for up to 1h. Consider lowering it if covers keep failing.
  - (b) `no-store` on render-error means a PERSISTENT render failure is not damped by
    a cache. If that ever shows up as load, use a short `max-age` (for example 30s)
    instead.
- Live behaviour on Vercel is not verified; only a deploy shows it. After merge, run
  `npm run check:og` and
  `curl -sI "https://www.bachatacalendar.co.uk/api/og/card?kind=event&id=43a0bcae-230b-4d1f-81dc-2e515216af21"`
  (Sensual Wednesday). It should return 200 image/jpeg with no `x-og-fallback`.
  Also re-scrape the URL with the Facebook Sharing Debugger so WhatsApp's cached
  preview refreshes.

## Environment notes (this cloud container)
- Node fetch cannot reach Supabase through the sandbox proxy. Because of that, 15
  live-DB contract tests in 4 files (eventViewCompat, occurrenceProgram,
  publicEventPageLineup, integrityCouldNotRun) fail identically on main and on this
  branch.
- The typecheck count is 109 on main and 109 on this branch in this container. The
  pre-ship baseline reads 106, so that drift exists on main too.
