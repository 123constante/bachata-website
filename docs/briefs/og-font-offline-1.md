# Brief: OG cards render with no network round trip for fonts (production incident, 2026-11-04), Opus

Branch `claude/og-font-offline-1` (create from main; push ONLY here; push early with [skip preview] once coherent, final push without it; final subject ends `[worker-done <ticket>]`). Careful lane (public route). Under 30% context.

## What main lacks
Owner quote 2026-11-04: "I tried to paste the link of the event 'Sensual Wednesday' in WhatsApp and their flyer does not appear." Measured on live prod: EVERY event's `/api/og/card?kind=event&id=<uuid>` answers `302 -> /og-image.jpg` with header `x-og-fallback: render-error` (four events tried, including ones that rendered fine at 13:55Z). The Vercel runtime log for the current deployment says: `[og/card] render_failed [TypeError: fetch failed] { [cause]: ConnectTimeoutError: Connect Timeout Error (attempted addresses: 172.67.133.176:443, timeout: 10000ms) }`. 172.67.133.176 is the Cloudflare address of www.bachatacalendar.co.uk. The cause is `materializeFont` in `app/lib/ogCardRender.ts`, which fetches the two Inter .ttf files over the public internet from `https://www.bachatacalendar.co.uk/assets/...` on every cold start; when that connection stalls, the whole card throws and WhatsApp/Facebook/iMessage get the generic site picture (and the 302 is cached 300 s). Nothing in the file changed recently, so the trigger is environmental (Vercel function to Cloudflare edge connects timing out), but the design makes the OG image depend on a network round trip it does not need.

## Files
- `app/lib/ogCardRender.ts` (materializeFont, fontSemiPath, fontRegPath, the cover fetch near line 578)
- `app/routes/api.og.card.tsx`, `app/routes/api.og.bake.tsx` (callers; the fallback redirect)
- the two fonts in `app/lib/ogCardFonts/`
- tests next to them; `scripts/check-og-images.mjs` (needs a live deploy, run `npm run check:og` only if you can)

## Do
1. Remove the network dependency for fonts: bundle the two Inter .ttf files into the server build as bytes (for example Vite `?inline`/`?raw`/base64 import, or `fs.readFileSync` of a file the build copies next to the function, whichever provably works in the React Router 7 + Vercel build here), and write them to `tmpdir()` from those bytes. No `fetch` for fonts. Prove with a test where global `fetch` is replaced by a function that always rejects/times out: the font path still resolves and the card still renders. Red first: that test must fail on current main.
2. Cover fetch (`media.bachatacalendar.co.uk`, also Cloudflare): add a short timeout and ONE retry; on final failure keep the existing branded fallback card (`cover-unfetchable`), never the generic redirect. Table-driven test over: cover ok, cover times out once then ok, cover times out twice, no cover url.
3. A render failure must never be cached for 5 minutes as the generic image for a social crawler: on `render-error` send `Cache-Control: no-store` (or the shortest the guard allows) on the 302. Keep `X-OG-Fallback` markers; update whichever test pins the old header.
4. Run every step of the CI jobs that apply (read `.github/workflows`), including the OG guard unit tests and bundle budget (fonts in the server bundle must not enter any client chunk; `check:bundle-budget` must stay within budget, say the numbers). PR body: fill Verified on real data (shapes: event with cover, without cover, festival, hidden/archived) and Not verified (live behaviour on Vercel, which only a deploy shows).
5. Do not touch Cloudflare or Vercel config; if you think the root cause is a Cloudflare or Vercel rule, say so in the handover with the evidence, do not change it.
